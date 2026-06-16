export type SlitherImpact = "High" | "Medium" | "Low" | "Informational" | "Optimization"

export interface SlitherArgs {
  /** Path to analyze (file, directory, or "."). Defaults to the workspace root. */
  target?: string
  /** Exclude findings in dependencies/libraries (node_modules, lib/). Default true. */
  exclude_dependencies?: boolean
  /** Only report findings at this impact level or higher. */
  min_impact?: SlitherImpact
}

export interface SlitherFinding {
  check: string
  impact: SlitherImpact | string
  confidence: string
  description: string
  file: string | null
  lines: number[]
}

export interface SlitherParseResult {
  ok: boolean
  findings: SlitherFinding[]
  /** Populated when slither itself reported a failure or output could not be parsed. */
  error?: string
}
