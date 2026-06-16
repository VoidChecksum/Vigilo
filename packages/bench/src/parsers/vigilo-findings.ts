import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import matter from "gray-matter";
import type { VigiloFinding, Severity, FindingStatus } from "../types.js";

function normalizeSeverity(value: string): Severity {
  const name = value.trim().toLowerCase();
  if (name === "critical") return "critical";
  if (name === "high") return "high";
  if (name === "medium") return "medium";
  if (name === "low") return "low";
  return "informational";
}

const VALID_STATUSES: FindingStatus[] = [
  "draft",
  "poc-pending",
  "validated",
  "needs-review",
  "invalidated",
];

function normalizeStatus(value: unknown): FindingStatus | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase() as FindingStatus;
  return VALID_STATUSES.includes(v) ? v : undefined;
}

/** Split a `target` like "src/Vault.sol:42-58" into { file, lines }. */
function parseTarget(target: unknown): { file?: string; lines?: string } {
  if (typeof target !== "string" || !target.trim()) return {};
  const m = target.trim().match(/^(.*?\.\w+)(?::(.+))?$/);
  if (m) return { file: m[1], lines: m[2] };
  return { file: target.trim() };
}

/**
 * Parse a single finding file. Prefers the canonical YAML frontmatter contract;
 * falls back to filename / heading / inline-field heuristics for legacy files.
 */
export function parseFinding(
  rawContent: string,
  filePath: string,
  dirSeverity: Severity,
  dirAuditor: string
): VigiloFinding {
  const fileName = basename(filePath, ".md");

  let data: Record<string, unknown> = {};
  let body = rawContent;
  try {
    const parsed = matter(rawContent);
    data = (parsed.data ?? {}) as Record<string, unknown>;
    body = parsed.content ?? rawContent;
  } catch {
    // Malformed frontmatter — treat the whole file as body.
    data = {};
    body = rawContent;
  }

  const hasFrontmatter = Object.keys(data).length > 0;

  // Title: frontmatter → first H1 → filename.
  const headingTitle = body.split("\n").find((l) => l.startsWith("# "));
  const title =
    (typeof data.title === "string" && data.title.trim()) ||
    (headingTitle && headingTitle.replace(/^#\s+/, "").trim()) ||
    fileName;

  const severity =
    typeof data.severity === "string" ? normalizeSeverity(data.severity) : dirSeverity;

  const auditor =
    (typeof data.auditor === "string" && data.auditor.trim()) || dirAuditor;

  // ID: globally-unique frontmatter id wins; else legacy auditor/severity-prefixed id.
  let id: string;
  if (typeof data.id === "string" && data.id.trim()) {
    id = data.id.trim();
  } else {
    const idMatch = fileName.match(/^[A-Za-z]-(\d+)/);
    const legacy = idMatch ? `${severity[0].toUpperCase()}-${idMatch[1]}` : fileName;
    id = `${auditor}/${legacy}`;
  }

  // File/lines: frontmatter target → inline File/Location/Contract field.
  const fromTarget = parseTarget(data.target);
  let file = fromTarget.file;
  if (!file) {
    for (const line of body.split("\n")) {
      const fileMatch = line.match(/(?:File|Location|Contract):\s*[`"]?([^\s`"]+\.sol)/i);
      if (fileMatch) {
        file = fileMatch[1];
        break;
      }
    }
  }

  const num = (v: unknown): number | undefined =>
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : undefined;

  return {
    id,
    title,
    severity,
    auditor,
    description: hasFrontmatter ? body : rawContent,
    file,
    filePath,
    status: normalizeStatus(data.status),
    vuln_class: typeof data.vuln_class === "string" ? data.vuln_class : undefined,
    confidence: num(data.confidence),
    lines: fromTarget.lines,
    duplicate_of:
      typeof data.duplicate_of === "string" && data.duplicate_of.trim() ? data.duplicate_of.trim() : null,
    likelihood: typeof data.likelihood === "string" ? data.likelihood : undefined,
    impact: typeof data.impact === "string" ? data.impact : undefined,
  };
}

/** A finding counts as "submitted" unless it was invalidated or marked a duplicate. */
export function isSubmittedFinding(f: VigiloFinding): boolean {
  if (f.status === "invalidated") return false;
  if (f.duplicate_of) return false;
  return true;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

/**
 * Heuristic same-root-cause key: a finding's vulnerability class on a specific
 * file. Only meaningful when BOTH signals are present.
 */
export function findingDedupKey(f: VigiloFinding): string | null {
  const cls = (f.vuln_class ?? "").trim().toLowerCase();
  const file = (f.file ?? "").trim().toLowerCase();
  if (!cls || !file) return null;
  return `${cls}|${file}`;
}

function isStronger(a: VigiloFinding, b: VigiloFinding): boolean {
  const ra = SEVERITY_RANK[a.severity] ?? 0;
  const rb = SEVERITY_RANK[b.severity] ?? 0;
  if (ra !== rb) return ra > rb;
  return (a.confidence ?? 0) > (b.confidence ?? 0);
}

/**
 * Collapse same-root-cause findings (same `vuln_class` on the same file), keeping
 * the strongest by severity then confidence. Findings lacking a strong dedup
 * signal (no `vuln_class` or no `file`) pass through untouched, so this never
 * over-merges. Utility helper; not currently wired into any command — report
 * aggregation and scoring do not call it.
 */
export function dedupeFindings(findings: VigiloFinding[]): VigiloFinding[] {
  const byKey = new Map<string, VigiloFinding>();
  const passthrough: VigiloFinding[] = [];

  for (const f of findings) {
    const key = findingDedupKey(f);
    if (key === null) {
      passthrough.push(f);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing || isStronger(f, existing)) byKey.set(key, f);
  }

  return [...byKey.values(), ...passthrough];
}

export function parseVigiloFindings(findingsDir: string): VigiloFinding[] {
  const findings: VigiloFinding[] = [];

  if (!existsSync(findingsDir)) return findings;

  const severityDirs = readdirSync(findingsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const sevDir of severityDirs) {
    const severity = normalizeSeverity(sevDir);
    const sevPath = resolve(findingsDir, sevDir);

    const auditorDirs = readdirSync(sevPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (auditorDirs.length === 0) {
      const mdFiles = readdirSync(sevPath).filter((f) => f.endsWith(".md"));
      for (const mdFile of mdFiles) {
        const filePath = resolve(sevPath, mdFile);
        const content = readFileSync(filePath, "utf-8");
        findings.push(parseFinding(content, filePath, severity, "unknown"));
      }
    } else {
      for (const auditorDir of auditorDirs) {
        const auditorPath = resolve(sevPath, auditorDir);
        const mdFiles = readdirSync(auditorPath).filter((f) => f.endsWith(".md"));
        for (const mdFile of mdFiles) {
          const filePath = resolve(auditorPath, mdFile);
          const content = readFileSync(filePath, "utf-8");
          findings.push(parseFinding(content, filePath, severity, auditorDir));
        }
      }
    }
  }

  // Exclude invalidated findings and duplicates — they are not submitted findings.
  return findings.filter(isSubmittedFinding);
}
