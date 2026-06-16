import type { SlitherImpact } from "./types"

export const SLITHER_DESCRIPTION = `Run Slither static analysis on the Solidity contracts in scope and return normalized findings.

Slither is the primary static analyzer for Solidity audits — it detects reentrancy, unchecked
calls, access-control gaps, arithmetic issues, and dozens of other patterns. Findings are returned
grouped by impact (High → Optimization) with the file:line of each. Use this during recon and to
corroborate manual findings (tool consensus raises confidence).

Requires the \`slither\` binary (\`pipx install slither-analyzer\`). Runs through Vigilo's sandboxed
runner (pinned cwd, timeout, output cap, scrubbed env). Returns an install hint if slither is missing.`

/** Slither can be slow on large projects; give it a generous budget. */
export const SLITHER_TIMEOUT_MS = 600_000

/** Impact levels ordered most → least severe (index = rank). */
export const SLITHER_IMPACT_ORDER: SlitherImpact[] = [
  "High",
  "Medium",
  "Low",
  "Informational",
  "Optimization",
]

export function impactRank(impact: string): number {
  const i = SLITHER_IMPACT_ORDER.indexOf(impact as SlitherImpact)
  return i === -1 ? SLITHER_IMPACT_ORDER.length : i
}
