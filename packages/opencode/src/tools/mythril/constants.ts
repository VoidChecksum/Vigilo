export const MYTHRIL_DESCRIPTION = `Run Mythril symbolic-execution analysis on a Solidity contract and return normalized findings.

Mythril uses symbolic execution + SMT solving to find integer over/underflow, reentrancy,
unchecked calls, unprotected selfdestruct/delegatecall, and more — complementing Slither's
pattern matching with deeper path exploration (good corroborating evidence for a finding).
Each finding carries its SWC id. Runs through Vigilo's sandboxed runner (pinned cwd, timeout,
output cap, scrubbed env). Symbolic execution is slow — prefer a single contract and a bounded
\`execution_timeout\`. Returns an install hint if Mythril is missing.`

/** Mythril can run long; cap it generously (the runner enforces a hard wall-clock limit too). */
export const MYTHRIL_TIMEOUT_MS = 900_000

/** Default symbolic-execution budget handed to Mythril itself (seconds). */
export const MYTHRIL_DEFAULT_EXEC_TIMEOUT_S = 300

const SEVERITY_ORDER = ["High", "Medium", "Low"]

export function mythrilImpactRank(sev: string): number {
  const i = SEVERITY_ORDER.indexOf(sev)
  return i === -1 ? SEVERITY_ORDER.length : i
}
