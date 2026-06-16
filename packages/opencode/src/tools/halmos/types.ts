export interface HalmosArgs {
  /** Only run functions matching this prefix/name (e.g. "check_"). */
  function?: string
  /** Restrict to a contract. */
  contract?: string
  /** Per-run wall-clock budget (seconds) passed through to the runner timeout. */
  timeout?: number
}

export interface HalmosTestResult {
  file: string
  contract: string
  /** Test function signature, e.g. "check_add(uint256,uint256)". */
  name: string
  /** True when halmos proved the property (no counterexample). */
  passed: boolean
  /** When failed: the concrete inputs that violate the property (variable -> value). */
  counterexample?: Record<string, string>
}

export interface HalmosParseResult {
  ok: boolean
  results: HalmosTestResult[]
  error?: string
}
