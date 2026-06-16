import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { runCommand } from "../../shared/exec"
import { log } from "../../shared"
import { parseHalmosJson } from "./utils"
import { HALMOS_DESCRIPTION, HALMOS_TIMEOUT_MS } from "./constants"
import type { HalmosTestResult } from "./types"

const INSTALL_HINT =
  "Halmos is not installed. Install it with:\n" +
  "  pipx install halmos   (or: pip install halmos)\n" +
  "Halmos also requires Foundry (forge) on PATH."

function format(results: HalmosTestResult[]): string {
  const failed = results.filter((r) => !r.passed)
  const passed = results.filter((r) => r.passed)
  if (results.length === 0) return "Halmos ran but found no `check_*`/`test_*` functions."

  const lines: string[] = [
    `Halmos: ${passed.length} property(ies) proven, ${failed.length} with counterexamples.`,
    "",
  ]
  for (const f of failed) {
    lines.push(`## ✗ ${f.name} — ${f.contract} (${f.file})`)
    if (f.counterexample && Object.keys(f.counterexample).length > 0) {
      for (const [k, v] of Object.entries(f.counterexample)) lines.push(`  ${k} = ${v}`)
    }
  }
  if (passed.length > 0) {
    lines.push("", `Proven: ${passed.map((p) => p.name).join(", ")}`)
  }
  return lines.join("\n")
}

export const halmos: ToolDefinition = tool({
  description: HALMOS_DESCRIPTION,
  args: {
    function: tool.schema.string().optional().describe("Only run functions matching this prefix/name (e.g. 'check_')."),
    contract: tool.schema.string().optional().describe("Restrict to a contract."),
    timeout: tool.schema.number().optional().describe("Wall-clock budget in seconds."),
  },
  async execute(args, context) {
    log("halmos", args)
    const ctx = (context ?? {}) as { directory?: string }
    const cwd = ctx.directory ?? process.cwd()
    const jsonPath = join(cwd, ".vigilo", `halmos-${Date.now()}.json`)

    try {
      mkdirSync(dirname(jsonPath), { recursive: true })
    } catch {
      /* best effort */
    }

    const argv = ["halmos", "--json-output", jsonPath]
    if (args.function) argv.push("--function", args.function)
    if (args.contract) argv.push("--contract", args.contract)

    const timeoutMs = args.timeout ? args.timeout * 1000 : HALMOS_TIMEOUT_MS
    const result = await runCommand({ argv, cwd, timeoutMs })

    if (result.timedOut) {
      return `Halmos timed out after ${timeoutMs}ms. Narrow with --function/--contract or raise timeout.`
    }
    if (result.exitCode === 127 || result.error?.includes("ENOENT")) {
      return INSTALL_HINT
    }

    let content: string
    try {
      content = readFileSync(jsonPath, "utf-8")
    } catch {
      const stderr = result.stderr.trim()
      if (stderr.toLowerCase().includes("not found")) return INSTALL_HINT
      return `Halmos produced no JSON output (exit ${result.exitCode}).\n\n${stderr.slice(0, 2000)}`
    } finally {
      try {
        rmSync(jsonPath, { force: true })
      } catch {
        /* best effort */
      }
    }

    const parsed = parseHalmosJson(content)
    if (!parsed.ok) return `Failed to parse halmos output: ${parsed.error}`
    return format(parsed.results)
  },
})

export const halmosTools: Record<string, ToolDefinition> = { halmos }
