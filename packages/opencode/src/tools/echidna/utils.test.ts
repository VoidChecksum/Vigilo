import { describe, test, expect } from "bun:test"
import { parseEchidnaJson } from "./utils"

// Mirrors REAL echidna 2.3.2 `--format json`: human log lines first, then one JSON
// report object with a `tests` array (name/status/transactions[].function).
const real =
  `[2026-01-01] [Worker 0] Test echidna_no_overflow falsified!\n` +
  `  Call sequence:\n  T.deposit() ...\n` +
  JSON.stringify({
    coverage: { "0xabc": [[0, 1, 4]] },
    error: null,
    success: false,
    tests: [
      {
        contract: "T",
        name: "echidna_no_overflow",
        status: "failed",
        transactions: [
          { function: "deposit", arguments: [], contract: "T" },
          { function: "withdraw", arguments: [], contract: "T" },
        ],
      },
      { contract: "T", name: "echidna_solvency", status: "passed", transactions: [] },
    ],
  })

describe("parseEchidnaJson", () => {
  test("#given mixed logs + JSON #then extracts tests with status + call sequence", () => {
    const r = parseEchidnaJson(real)
    expect(r.ok).toBe(true)
    expect(r.results).toHaveLength(2)

    const failed = r.results.find((t) => t.name === "echidna_no_overflow")!
    expect(failed.passed).toBe(false)
    expect(failed.status).toBe("failed")
    expect(failed.callSequence).toEqual(["deposit()", "withdraw()"])

    const ok = r.results.find((t) => t.name === "echidna_solvency")!
    expect(ok.passed).toBe(true)
    expect(ok.callSequence).toEqual([])
  })

  test("#given no JSON object #then not ok", () => {
    expect(parseEchidnaJson("just logs, no json").ok).toBe(false)
  })

  test("#given empty tests #then ok with none", () => {
    expect(parseEchidnaJson(JSON.stringify({ tests: [], success: true })).results).toHaveLength(0)
  })
})
