import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { runCommand, parseTestSummary } from "./utils"
import {
  FOUNDRY_BUILD_DESCRIPTION,
  FOUNDRY_TEST_DESCRIPTION,
  FOUNDRY_COVERAGE_DESCRIPTION,
  CAST_CALL_DESCRIPTION,
} from "./constants"
import { log } from "../../shared"

export const forge_build: ToolDefinition = tool({
  description: FOUNDRY_BUILD_DESCRIPTION,
  args: {
    optimize: tool.schema.boolean().optional().describe("Enable optimizer (default: false)"),
    optimizer_runs: tool.schema.number().optional().describe("Optimizer runs (default: 200)"),
  },
  async execute(args) {
    log("forge_build", args)

    const cmdArgs = ["forge", "build"]
    if (args.optimize) {
      cmdArgs.push("--optimize")
      if (args.optimizer_runs) {
        cmdArgs.push("--optimizer-runs", String(args.optimizer_runs))
      }
    }

    try {
      const { stdout, stderr, exitCode } = await runCommand(cmdArgs)

      return exitCode === 0
        ? `Build successful.\n\n${stdout}`
        : `Build failed (exit code: ${exitCode}).\n\nErrors:\n${stderr}\n\nOutput:\n${stdout}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Build failed: ${message}`
    }
  },
})

export const forge_test: ToolDefinition = tool({
  description: FOUNDRY_TEST_DESCRIPTION,
  args: {
    match_test: tool.schema.string().optional().describe("Test function pattern to match (e.g., 'test_Exploit')"),
    match_contract: tool.schema.string().optional().describe("Contract pattern to match"),
    verbosity: tool.schema.number().optional().describe("Verbosity level 1-5 (default: 3)"),
    gas_report: tool.schema.boolean().optional().describe("Show gas usage report"),
    fork_url: tool.schema.string().optional().describe("Fork from mainnet/testnet RPC URL"),
    fork_block: tool.schema.number().optional().describe("Fork at specific block number"),
  },
  async execute(args) {
    log("forge_test", args)

    const verbosity = args.verbosity ?? 3
    const vFlag = "-" + "v".repeat(Math.min(Math.max(verbosity, 1), 5))

    const cmdArgs = ["forge", "test", vFlag]

    if (args.match_test) {
      cmdArgs.push("--match-test", args.match_test)
    }
    if (args.match_contract) {
      cmdArgs.push("--match-contract", args.match_contract)
    }
    if (args.gas_report) {
      cmdArgs.push("--gas-report")
    }
    if (args.fork_url) {
      cmdArgs.push("--fork-url", args.fork_url)
      if (args.fork_block) {
        cmdArgs.push("--fork-block-number", String(args.fork_block))
      }
    }

    try {
      const { stdout, stderr, exitCode } = await runCommand(cmdArgs)
      const { passed, failed } = parseTestSummary(stdout)
      const summary = `\n\n**Summary**: ${passed} passed, ${failed} failed`

      return exitCode === 0
        ? `Tests passed.${summary}\n\n${stdout}`
        : `Tests failed (exit code: ${exitCode}).${summary}\n\nErrors:\n${stderr}\n\nOutput:\n${stdout}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Test execution failed: ${message}`
    }
  },
})

export const forge_coverage: ToolDefinition = tool({
  description: FOUNDRY_COVERAGE_DESCRIPTION,
  args: {
    report: tool.schema.enum(["summary", "lcov", "debug"]).optional().describe("Report format (default: summary)"),
    match_contract: tool.schema.string().optional().describe("Contract pattern to match"),
  },
  async execute(args) {
    log("forge_coverage", args)

    const cmdArgs = ["forge", "coverage"]
    if (args.report) {
      cmdArgs.push("--report", args.report)
    }
    if (args.match_contract) {
      cmdArgs.push("--match-contract", args.match_contract)
    }

    try {
      const { stdout, stderr, exitCode } = await runCommand(cmdArgs)

      return exitCode === 0
        ? `Coverage report:\n\n${stdout}`
        : `Coverage failed (exit code: ${exitCode}).\n\nErrors:\n${stderr}\n\nOutput:\n${stdout}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Coverage failed: ${message}`
    }
  },
})

export const cast_call: ToolDefinition = tool({
  description: CAST_CALL_DESCRIPTION,
  args: {
    to: tool.schema.string().describe("Target contract address"),
    sig: tool.schema.string().describe("Function signature (e.g., 'balanceOf(address)')"),
    args: tool.schema.array(tool.schema.string()).optional().describe("Function arguments"),
    rpc_url: tool.schema.string().optional().describe("RPC URL (default: from foundry.toml)"),
    block: tool.schema.number().optional().describe("Block number to query at"),
  },
  async execute(args) {
    log("cast_call", args)

    const cmdArgs = ["cast", "call", args.to, args.sig]

    if (args.args && args.args.length > 0) {
      cmdArgs.push(...args.args)
    }
    if (args.rpc_url) {
      cmdArgs.push("--rpc-url", args.rpc_url)
    }
    if (args.block) {
      cmdArgs.push("--block", String(args.block))
    }

    try {
      const { stdout, stderr, exitCode } = await runCommand(cmdArgs)

      return exitCode === 0
        ? `Result: ${stdout.trim()}`
        : `Call failed (exit code: ${exitCode}).\n\nErrors:\n${stderr}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Call failed: ${message}`
    }
  },
})

export const foundryTools: Record<string, ToolDefinition> = {
  forge_build,
  forge_test,
  forge_coverage,
  cast_call,
}
