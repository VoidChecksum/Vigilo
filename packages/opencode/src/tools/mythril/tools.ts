import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { join } from "node:path"
import { runCommand } from "../../shared/exec"
import { log } from "../../shared"
import { KnowledgeGraphStore, ingestMythrilFindings } from "../kg"
import { parseMythrilJson } from "./utils"
import {
  MYTHRIL_DESCRIPTION,
  MYTHRIL_TIMEOUT_MS,
  MYTHRIL_DEFAULT_EXEC_TIMEOUT_S,
  mythrilImpactRank,
} from "./constants"
import type { MythrilFinding } from "./types"

const INSTALL_HINT =
  "Mythril is not installed. Install it with:\n" +
  "  pipx install mythril   (recommended)\n" +
  "  pip install mythril\n" +
  "Mythril also needs a Solidity compiler; solc/solc-select or Foundry on PATH is used automatically."

function formatFindings(findings: MythrilFinding[]): string {
  if (findings.length === 0) return "Mythril completed: no issues found."
  const sorted = [...findings].sort((a, b) => mythrilImpactRank(a.severity) - mythrilImpactRank(b.severity))
  const lines: string[] = [`Mythril found ${sorted.length} issue(s):`, ""]
  let lastSev = ""
  for (const f of sorted.slice(0, 100)) {
    if (f.severity !== lastSev) {
      lines.push(`## ${f.severity} severity`)
      lastSev = f.severity
    }
    const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "(no location)"
    const swc = f.swc_id ? ` [${f.swc_id}]` : ""
    lines.push(`- ${f.title}${swc} — ${loc}${f.function ? ` (${f.function})` : ""}`)
    const desc = f.description.split("\n")[0].slice(0, 300)
    if (desc) lines.push(`  ${desc}`)
  }
  if (sorted.length > 100) lines.push("", `… ${sorted.length - 100} more omitted.`)
  return lines.join("\n")
}

export const mythril: ToolDefinition = tool({
  description: MYTHRIL_DESCRIPTION,
  args: {
    target: tool.schema.string().optional().describe("Solidity file to analyze (prefer a single contract). Default: workspace root."),
    max_depth: tool.schema.number().optional().describe("Max transaction depth (default: Mythril's own)."),
    execution_timeout: tool.schema.number().optional().describe(`Symbolic-execution budget in seconds (default ${MYTHRIL_DEFAULT_EXEC_TIMEOUT_S}).`),
  },
  async execute(args, context) {
    log("mythril", args)
    const ctx = (context ?? {}) as { directory?: string; sessionID?: string }
    const cwd = ctx.directory ?? process.cwd()
    const target = args.target ?? "."
    const execTimeout = args.execution_timeout ?? MYTHRIL_DEFAULT_EXEC_TIMEOUT_S

    const argv = ["myth", "analyze", target, "-o", "json", "--execution-timeout", String(execTimeout)]
    if (args.max_depth) argv.push("--max-depth", String(args.max_depth))

    const result = await runCommand({ argv, cwd, timeoutMs: MYTHRIL_TIMEOUT_MS })

    if (result.timedOut) {
      return `Mythril timed out after ${MYTHRIL_TIMEOUT_MS}ms. Analyze a single contract or lower execution_timeout/max_depth.`
    }
    if (result.exitCode === 127 || result.error?.includes("ENOENT")) {
      return INSTALL_HINT
    }

    const parsed = parseMythrilJson(result.stdout)
    if (!parsed.ok) {
      const stderr = result.stderr.trim()
      if (stderr.toLowerCase().includes("not found") || stderr.toLowerCase().includes("command not found")) {
        return INSTALL_HINT
      }
      return `Mythril did not return parseable results (exit ${result.exitCode}).\n${parsed.error ?? ""}\n\n${stderr.slice(0, 2000)}`
    }

    let ingestNote = ""
    if (parsed.findings.length > 0) {
      try {
        const kg = new KnowledgeGraphStore(join(cwd, ".vigilo", "kg"))
        const { findings } = ingestMythrilFindings(kg, parsed.findings, {
          auditor: "mythril",
          session: ctx.sessionID ?? "unknown",
        })
        ingestNote = `\n\n_(${findings} finding(s) recorded to the knowledge graph as STATIC_SUGGESTED — query with kg_query / kg_chain.)_`
      } catch (e) {
        log("mythril: kg ingest failed", { error: e instanceof Error ? e.message : String(e) })
      }
    }

    return formatFindings(parsed.findings) + ingestNote
  },
})

export const mythrilTools: Record<string, ToolDefinition> = { mythril }
