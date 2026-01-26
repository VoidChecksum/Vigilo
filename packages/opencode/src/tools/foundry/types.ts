export interface ForgeBuildArgs {
  optimize?: boolean
  optimizer_runs?: number
}

export interface ForgeTestArgs {
  match_test?: string
  match_contract?: string
  verbosity?: number
  gas_report?: boolean
  fork_url?: string
  fork_block?: number
}

export interface ForgeCoverageArgs {
  report?: "summary" | "lcov" | "debug"
  match_contract?: string
}

export interface CastCallArgs {
  to: string
  sig: string
  args?: string[]
  rpc_url?: string
  block?: number
}
