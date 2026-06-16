export interface MythrilArgs {
  /** Solidity file or directory to analyze. Defaults to the workspace root. */
  target?: string
  /** Max transaction depth Mythril explores (higher = deeper but slower). */
  max_depth?: number
  /** Per-analysis execution timeout in seconds (Mythril's own budget). */
  execution_timeout?: number
}

export interface MythrilFinding {
  title: string
  /** High | Medium | Low (Mythril severities). */
  severity: string
  /** SWC id without the prefix as Mythril emits it (e.g. "101"); normalized to "SWC-101". */
  swc_id: string | null
  description: string
  file: string | null
  line: number | null
  function: string | null
}

export interface MythrilParseResult {
  ok: boolean
  findings: MythrilFinding[]
  error?: string
}
