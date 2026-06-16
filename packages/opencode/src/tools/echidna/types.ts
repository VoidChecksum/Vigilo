export interface EchidnaArgs {
  /** Solidity file to fuzz. Defaults to the workspace root. */
  target?: string
  /** Restrict to a contract (echidna `--contract`). */
  contract?: string
  /** Number of fuzzing transactions (echidna `--test-limit`). */
  test_limit?: number
  /** Wall-clock budget (seconds) for the runner timeout. */
  timeout?: number
}

export interface EchidnaTestResult {
  /** Property/assertion name (e.g. "echidna_balance_invariant"). */
  name: string
  /** echidna status: passed | failed | solved | shrinking | error | … */
  status: string
  /** True only when the property held (status === "passed"). */
  passed: boolean
  /** The falsifying call sequence (`fn(arg0, arg1)` in order), when failed. */
  callSequence: string[]
}

export interface EchidnaParseResult {
  ok: boolean
  results: EchidnaTestResult[]
  error?: string
}
