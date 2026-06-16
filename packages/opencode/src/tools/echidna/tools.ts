import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { runCommand } from "../../shared/exec"
import { log } from "../../shared"
import { parseEchidnaJson } from "./utils"
import { ECHIDNA_DESCRIPTION, ECHIDNA_TIMEOUT_MS, DEFAULT_TEST_LIMIT } from "./constants"
import type { EchidnaTestResult } from "./types"

const INSTALL_HINT =
  "Echidna is not installed. Install it from a release:\n" +
  "  https://github.com/crytic/echidna/releases (extract the `echidna` binary onto PATH)\n" +
  "Echidna also needs crytic-compile (`pip install crytic-compile`) and a Solidity compiler."

function format(results: EchidnaTestResult[]): string {
  if (results.length === 0) return "Echidna ran but reported no properties."
  const falsified = results.filter((r) => !r.passed)
  const passed = results.filter((r) => r.passed)
  const lines: string[] = [`Echidna: ${passed.length} property(ies) held, ${falsified.length} falsified.`, ""]
  for (const f of falsified) {
    lines.push(`## ✗ ${f.name} (${f.status})`)
    if (f.callSequence.length) lines.push(`  Call sequence: ${f.callSequence.join(" → ")}`)
  }
  if (passed.length) lines.push("", `Held: ${passed.map((p) => p.name).join(", ")}`)
  return lines.join("\n")
}

export const echidna: ToolDefinition = tool({
  description: ECHIDNA_DESCRIPTION,
  args: {
    target: tool.schema.string().optional().describe("Solidity file to fuzz. Default: workspace root."),
    contract: tool.schema.string().optional().describe("Restrict to a contract."),
    test_limit: tool.schema.number().optional().describe(`Fuzzing transaction budget (default ${DEFAULT_TEST_LIMIT}).`),
    timeout: tool.schema.number().optional().describe("Wall-clock budget in seconds."),
  },
  async execute(args, context) {
    log("echidna", args)
    const cwd = ((context ?? {}) as { directory?: string }).directory ?? process.cwd()
    const target = args.target ?? "."

    const argv = ["echidna", target, "--format", "json", "--test-limit", String(args.test_limit ?? DEFAULT_TEST_LIMIT)]
    if (args.contract) argv.push("--contract", args.contract)

    const timeoutMs = args.timeout ? args.timeout * 1000 : ECHIDNA_TIMEOUT_MS
    const result = await runCommand({ argv, cwd, timeoutMs })

    if (result.timedOut) {
      return `Echidna timed out after ${timeoutMs}ms. Lower test_limit or restrict --contract.`
    }
    if (result.exitCode === 127 || result.error?.includes("ENOENT")) {
      return INSTALL_HINT
    }

    const parsed = parseEchidnaJson(result.stdout)
    if (!parsed.ok) {
      const stderr = result.stderr.trim()
      if (stderr.toLowerCase().includes("not found")) return INSTALL_HINT
      return `Echidna did not return parseable results (exit ${result.exitCode}).\n${parsed.error ?? ""}\n\n${stderr.slice(0, 2000)}`
    }
    return format(parsed.results)
  },
})

export const echidnaTools: Record<string, ToolDefinition> = { echidna }
