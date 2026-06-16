import { describe, test, expect } from "bun:test"
import { join } from "node:path"
import { runCommand } from "../../shared/exec"
import { parseSlitherJson } from "./utils"

// Real-binary integration: runs only when `slither` is on PATH (skipped in CI/dev
// without it). Validates that the parser handles ACTUAL Slither output — and exercises
// the sandboxed runner against a real external tool end-to-end.
const slitherBin = Bun.which("slither")
const repoRoot = join(import.meta.dir, "..", "..", "..", "..", "..")
const fixture = "tests/semgrep-fixtures/vulnerable/ArbitraryDelegatecall.sol"

describe.skipIf(!slitherBin)("slither integration (real binary)", () => {
  test("#given a real vulnerable fixture #then the parser yields well-formed findings", async () => {
    const r = await runCommand({
      argv: ["slither", fixture, "--json", "-", "--exclude-dependencies"],
      cwd: repoRoot,
      timeoutMs: 180_000,
    })
    // Slither exits non-zero when it finds issues; parse stdout regardless.
    const parsed = parseSlitherJson(r.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.findings.length).toBeGreaterThan(0)
    expect(parsed.findings.every((f) => f.check && f.impact)).toBe(true)
    // The delegatecall fixture must surface the controlled-delegatecall detector.
    expect(parsed.findings.some((f) => f.check === "controlled-delegatecall")).toBe(true)
  }, 200_000)
})
