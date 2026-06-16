import { describe, test, expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { readdirSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// -----------------------------------------------------------------------------
// Regression tests for Vigilo's custom Solidity Semgrep ruleset.
//
// These pin the behaviour of `.semgrep/vigilo-rules.yml` so a Semgrep upgrade
// (or an accidental edit to the rules) can't silently break detection or start
// producing false positives. They SKIP gracefully when `semgrep` is not on PATH.
// -----------------------------------------------------------------------------

// This file lives at <repo>/tests/semgrep-fixtures/semgrep-rules.test.ts, so the
// repo root is two directories up. Resolve everything from here so the test runs
// correctly regardless of the caller's working directory.
const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(FIXTURES_DIR, "..", "..")
const RULES_FILE = join(REPO_ROOT, ".semgrep", "vigilo-rules.yml")
const VULN_DIR = join(FIXTURES_DIR, "vulnerable")
const SAFE_DIR = join(FIXTURES_DIR, "safe")

// Map each vulnerable fixture to the rule id(s) it MUST trigger. Keep this in
// sync with .semgrep/vigilo-rules.yml and tests/semgrep-fixtures/README.md.
const EXPECTED: Record<string, string[]> = {
  "Reentrancy.sol": ["reentrancy-external-call-before-state"],
  "ReentrancyCompound.sol": ["reentrancy-external-call-before-state"],
  "UncheckedTransfer.sol": ["unchecked-transfer-return"],
  "TxOriginAuth.sol": ["tx-origin-authentication"],
  "UnprotectedSelfdestruct.sol": ["unprotected-selfdestruct"],
  "ArbitraryDelegatecall.sol": ["arbitrary-delegatecall"],
  "BlockTimestamp.sol": ["block-timestamp-manipulation"],
  "UninitializedStoragePointer.sol": ["uninitialized-storage-pointer"],
  "MissingZeroAddressCheck.sol": ["missing-zero-address-check"],
  "UnsafeApprove.sol": ["unsafe-erc20-approve"],
  "HardcodedGas.sol": ["hardcoded-gas-amount"],
  "UnprotectedLowLevelCallValue.sol": ["unprotected-low-level-call-value"],
}

function hasSemgrep(): boolean {
  const res = spawnSync("semgrep", ["--version"], { encoding: "utf8" })
  return res.status === 0
}

const SEMGREP_AVAILABLE = hasSemgrep()

if (!SEMGREP_AVAILABLE) {
  console.warn(
    "[semgrep-rules.test] semgrep not found on PATH - skipping rule regression tests. " +
      "Install it (e.g. `pipx install semgrep`) to run them locally.",
  )
}

interface SemgrepResult {
  check_id: string
  path: string
}

/**
 * Run semgrep over an explicit list of .sol files and return the findings.
 *
 * Files are passed explicitly (not as a directory) on purpose: semgrep
 * otherwise limits a scan to git-tracked files, which would silently skip
 * freshly-added / uncommitted fixtures during local development.
 */
function runSemgrep(files: string[]): SemgrepResult[] {
  const res = spawnSync(
    "semgrep",
    ["--config", RULES_FILE, "--json", "--quiet", "--disable-version-check", ...files],
    { encoding: "utf8", cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 },
  )

  // semgrep exits 1 when it finds something; that's expected for the vulnerable
  // fixtures. A missing-binary / crash shows up as null status or no stdout.
  if (res.status === null || !res.stdout) {
    throw new Error(
      `semgrep did not produce output (status=${res.status}): ${res.stderr ?? ""}`,
    )
  }

  const parsed = JSON.parse(res.stdout) as {
    results: SemgrepResult[]
    errors: Array<{ message?: string }>
  }

  // A rule parse error disables the whole rule, so treat any rule error as fatal.
  if (parsed.errors && parsed.errors.length > 0) {
    const msgs = parsed.errors.map((e) => e.message ?? JSON.stringify(e)).join("\n")
    throw new Error(`semgrep reported rule errors:\n${msgs}`)
  }

  return parsed.results
}

function ruleId(checkId: string): string {
  // check_id looks like "...vigilo-rules.reentrancy-external-call-before-state"
  return checkId.split(".").pop() ?? checkId
}

function listSol(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sol"))
    .map((f) => join(dir, f))
}

describe("vigilo-rules.yml regression", () => {
  test.skipIf(!SEMGREP_AVAILABLE)("rules file exists", () => {
    expect(existsSync(RULES_FILE)).toBe(true)
  })

  test.skipIf(!SEMGREP_AVAILABLE)(
    "every vulnerable fixture triggers its expected rule",
    () => {
      const files = listSol(VULN_DIR)
      expect(files.length).toBeGreaterThan(0)

      const findings = runSemgrep(files)

      // Group triggered rule ids by fixture file name.
      const byFile = new Map<string, Set<string>>()
      for (const f of findings) {
        const name = f.path.split("/").pop() ?? f.path
        if (!byFile.has(name)) byFile.set(name, new Set())
        byFile.get(name)!.add(ruleId(f.check_id))
      }

      // Every fixture present on disk must have an expectation declared, so new
      // fixtures can't be added without pinning them here.
      for (const path of files) {
        const name = path.split("/").pop()!
        expect(EXPECTED[name], `no expectation declared for ${name}`).toBeDefined()
      }

      // Every expected rule must actually fire for its fixture.
      for (const [name, expectedRules] of Object.entries(EXPECTED)) {
        const triggered = byFile.get(name) ?? new Set<string>()
        for (const rule of expectedRules) {
          expect(
            triggered.has(rule),
            `expected ${name} to trigger "${rule}", got: [${[...triggered].join(", ")}]`,
          ).toBe(true)
        }
      }
    },
  )

  test.skipIf(!SEMGREP_AVAILABLE)(
    "safe fixtures trigger zero findings (no false positives)",
    () => {
      const files = listSol(SAFE_DIR)
      expect(files.length).toBeGreaterThan(0)

      const findings = runSemgrep(files)
      const summary = findings
        .map((f) => `${f.path.split("/").pop()}: ${ruleId(f.check_id)}`)
        .join(", ")

      expect(findings.length, `unexpected findings in safe fixtures: ${summary}`).toBe(0)
    },
  )
})
