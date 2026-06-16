import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { join } from "node:path"
import { runCommand } from "../../shared/exec"
import { log } from "../../shared"
import { KnowledgeGraphStore, ingestSlitherFindings } from "../kg"
import { parseSlitherJson } from "./utils"
import { SLITHER_DESCRIPTION, SLITHER_TIMEOUT_MS, SLITHER_IMPACT_ORDER, impactRank } from "./constants"
import type { SlitherFinding } from "./types"

const INSTALL_HINT =
  "Slither is not installed. Install it with:\n" +
  "  pipx install slither-analyzer   (recommended)\n" +
  "  pip install slither-analyzer\n" +
  "Slither also needs a Solidity compiler; Foundry/solc on PATH is used automatically."

function formatFindings(findings: SlitherFinding[], minRank: number): string {
  const shown = findings
    .filter((f) => impactRank(f.impact) <= minRank)
    .sort((a, b) => impactRank(a.impact) - impactRank(b.impact))

  if (shown.length === 0) {
    return "Slither completed: no findings at the requested impact level."
  }

  const MAX = 100
  const truncated = shown.length > MAX
  const lines: string[] = [`Slither found ${shown.length} issue(s):`, ""]

  let lastImpact = ""
  for (const f of shown.slice(0, MAX)) {
    if (f.impact !== lastImpact) {
      lines.push(`## ${f.impact} impact`)
      lastImpact = f.impact
    }
    const loc = f.file ? `${f.file}${f.lines.length ? `:${f.lines[0]}` : ""}` : "(no location)"
    const desc = f.description.split("\n")[0].slice(0, 300)
    lines.push(`- [${f.check}] ${loc} (confidence: ${f.confidence})`)
    if (desc) lines.push(`  ${desc}`)
  }

  if (truncated) {
    lines.push("", `… ${shown.length - MAX} more findings omitted (raise min_impact to narrow).`)
  }
  return lines.join("\n")
}

export const slither: ToolDefinition = tool({
  description: SLITHER_DESCRIPTION,
  args: {
    target: tool.schema
      .string()
      .optional()
      .describe("Path to analyze (file, dir, or '.'). Default: workspace root."),
    exclude_dependencies: tool.schema
      .boolean()
      .optional()
      .describe("Exclude findings in dependencies/libraries (default: true)."),
    min_impact: tool.schema
      .enum(["High", "Medium", "Low", "Informational", "Optimization"])
      .optional()
      .describe("Only report findings at this impact level or higher (default: Low)."),
  },
  async execute(args, context) {
    log("slither", args)

    const ctx = (context ?? {}) as { directory?: string; sessionID?: string }
    const cwd = ctx.directory ?? process.cwd()
    const target = args.target ?? "."
    const excludeDeps = args.exclude_dependencies !== false
    const minRank = impactRank(args.min_impact ?? "Low")

    const argv = ["slither", target, "--json", "-"]
    if (excludeDeps) argv.push("--exclude-dependencies")

    const result = await runCommand({ argv, cwd, timeoutMs: SLITHER_TIMEOUT_MS })

    if (result.timedOut) {
      return `Slither timed out after ${SLITHER_TIMEOUT_MS}ms. Narrow the target or analyze a single contract.`
    }
    if (result.exitCode === 127 || result.error?.includes("ENOENT")) {
      return INSTALL_HINT
    }

    const parsed = parseSlitherJson(result.stdout)
    if (!parsed.ok) {
      // Slither emits diagnostics on stderr; surface them when JSON is unusable.
      const stderr = result.stderr.trim()
      if (stderr.toLowerCase().includes("not found") || stderr.toLowerCase().includes("command not found")) {
        return INSTALL_HINT
      }
      return `Slither did not return parseable results (exit ${result.exitCode}).\n${parsed.error ?? ""}\n\n${stderr.slice(0, 2000)}`
    }

    // Close the tooling->memory loop: land static findings in the knowledge graph
    // (best-effort; a KG failure must not break the analysis result).
    let ingestNote = ""
    if (parsed.findings.length > 0) {
      try {
        const kg = new KnowledgeGraphStore(join(cwd, ".vigilo", "kg"))
        const { findings } = ingestSlitherFindings(kg, parsed.findings, {
          auditor: "slither",
          session: ctx.sessionID ?? "unknown",
        })
        ingestNote = `\n\n_(${findings} finding(s) recorded to the knowledge graph as STATIC_SUGGESTED — query with kg_query / kg_chain.)_`
      } catch (e) {
        log("slither: kg ingest failed", { error: e instanceof Error ? e.message : String(e) })
      }
    }

    return formatFindings(parsed.findings, minRank) + ingestNote
  },
})

export const slitherTools: Record<string, ToolDefinition> = { slither }

export { SLITHER_IMPACT_ORDER }
