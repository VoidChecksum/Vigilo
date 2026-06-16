import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseFinding, parseVigiloFindings, isSubmittedFinding, dedupeFindings, findingDedupKey } from "./vigilo-findings";
import type { VigiloFinding } from "../types";

describe("parseFinding (canonical contract)", () => {
  test("#given YAML frontmatter #then uses contract fields", () => {
    const content = `---
id: VIG-001
title: Reentrancy in Vault.withdraw
severity: High
status: validated
auditor: reentrancy-auditor
target: src/Vault.sol:42-58
vuln_class: SWC-107
confidence: 90
---

# Reentrancy
External call before state update.
`;
    const f = parseFinding(content, "/x/H-01-reentrancy.md", "low", "dir-auditor");
    expect(f.id).toBe("VIG-001"); // global id wins, not auditor-prefixed
    expect(f.title).toBe("Reentrancy in Vault.withdraw");
    expect(f.severity).toBe("high"); // frontmatter overrides the dir severity
    expect(f.auditor).toBe("reentrancy-auditor");
    expect(f.file).toBe("src/Vault.sol");
    expect(f.lines).toBe("42-58");
    expect(f.vuln_class).toBe("SWC-107");
    expect(f.confidence).toBe(90);
    expect(f.status).toBe("validated");
    expect(f.description).not.toContain("id: VIG-001"); // frontmatter stripped from body
  });

  test("#given legacy file (no frontmatter) #then falls back to heuristics", () => {
    const content = `# Unchecked transfer\n\nFile: src/Token.sol\nSome description.`;
    const f = parseFinding(content, "/x/H-03-unchecked.md", "high", "token-auditor");
    expect(f.title).toBe("Unchecked transfer");
    expect(f.severity).toBe("high");
    expect(f.id).toBe("token-auditor/H-03");
    expect(f.file).toBe("src/Token.sol");
    expect(f.status).toBeUndefined();
  });

  test("#given invalid status / malformed numbers #then degrades gracefully", () => {
    const content = `---\ntitle: X\nstatus: bogus\nconfidence: notanumber\n---\nbody`;
    const f = parseFinding(content, "/x/L-01.md", "low", "a");
    expect(f.status).toBeUndefined();
    expect(f.confidence).toBeUndefined();
  });
});

describe("parseVigiloFindings (filtering)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "vigilo-findings-"));
    const high = join(dir, "high");
    mkdirSync(high, { recursive: true });
    writeFileSync(join(high, "VIG-001.md"), `---\nid: VIG-001\ntitle: Real\nseverity: High\nstatus: validated\n---\nbody`);
    writeFileSync(join(high, "VIG-002.md"), `---\nid: VIG-002\ntitle: Dropped\nseverity: High\nstatus: invalidated\n---\nbody`);
    writeFileSync(join(high, "VIG-003.md"), `---\nid: VIG-003\ntitle: Dup\nseverity: High\nduplicate_of: VIG-001\n---\nbody`);
    writeFileSync(join(high, "H-09-legacy.md"), `# Legacy finding\nFile: src/A.sol`);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("#then includes submitted findings and excludes invalidated + duplicates", () => {
    const findings = parseVigiloFindings(dir);
    const ids = findings.map((f) => f.id).sort();
    expect(ids).toContain("VIG-001");
    expect(ids).toContain("unknown/H-09"); // legacy, no auditor subdir
    expect(ids).not.toContain("VIG-002"); // invalidated
    expect(ids).not.toContain("VIG-003"); // duplicate
    expect(findings).toHaveLength(2);
  });

  test("isSubmittedFinding excludes invalidated and duplicates", () => {
    expect(isSubmittedFinding({ status: "invalidated" } as never)).toBe(false);
    expect(isSubmittedFinding({ duplicate_of: "VIG-001" } as never)).toBe(false);
    expect(isSubmittedFinding({ status: "validated", duplicate_of: null } as never)).toBe(true);
  });
});

describe("dedupeFindings", () => {
  const f = (over: Partial<VigiloFinding>): VigiloFinding => ({
    id: over.id ?? "x",
    title: over.title ?? "t",
    severity: over.severity ?? "low",
    auditor: over.auditor ?? "a",
    description: "",
    filePath: "/x",
    ...over,
  });

  test("#given same vuln_class+file #then keeps the strongest by severity", () => {
    const out = dedupeFindings([
      f({ id: "A", vuln_class: "SWC-107", file: "src/Vault.sol", severity: "medium" }),
      f({ id: "B", vuln_class: "SWC-107", file: "src/Vault.sol", severity: "high" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("B"); // high beats medium
  });

  test("#given equal severity #then keeps the higher confidence", () => {
    const out = dedupeFindings([
      f({ id: "A", vuln_class: "SWC-107", file: "src/V.sol", severity: "high", confidence: 70 }),
      f({ id: "B", vuln_class: "SWC-107", file: "src/V.sol", severity: "high", confidence: 90 }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["B"]);
  });

  test("#given different class or file #then does NOT merge", () => {
    const out = dedupeFindings([
      f({ id: "A", vuln_class: "SWC-107", file: "src/V.sol", severity: "high" }),
      f({ id: "B", vuln_class: "SWC-101", file: "src/V.sol", severity: "high" }),
      f({ id: "C", vuln_class: "SWC-107", file: "src/Other.sol", severity: "high" }),
    ]);
    expect(out).toHaveLength(3);
  });

  test("#given missing class or file #then passes through (never over-merges)", () => {
    const out = dedupeFindings([
      f({ id: "A", severity: "high" }), // no vuln_class/file
      f({ id: "B", severity: "high" }),
      f({ id: "C", vuln_class: "SWC-107", severity: "high" }), // no file
    ]);
    expect(out).toHaveLength(3);
    expect(findingDedupKey(f({ id: "A" }))).toBeNull();
    expect(findingDedupKey(f({ vuln_class: "SWC-107", file: "src/V.sol" }))).toBe("swc-107|src/v.sol");
  });
});
