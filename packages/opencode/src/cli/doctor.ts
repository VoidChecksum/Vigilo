import color from "picocolors"
import type { DoctorOptions, CheckResult } from "./types"
import {
  isOpenCodeInstalled,
  getOpenCodeVersion,
  isFoundryInstalled,
  getFoundryVersion,
  detectCurrentConfig,
} from "./config-manager"

const SYMBOLS = {
  pass: color.green("✓"),
  fail: color.red("✗"),
  warn: color.yellow("⚠"),
  skip: color.dim("○"),
}

async function checkOpenCode(): Promise<CheckResult> {
  const installed = await isOpenCodeInstalled()
  const version = await getOpenCodeVersion()

  if (!installed) {
    return {
      id: "opencode",
      name: "OpenCode Installation",
      status: "fail",
      message: "OpenCode not found",
      details: ["Install OpenCode: https://opencode.ai/docs"],
    }
  }

  return {
    id: "opencode",
    name: "OpenCode Installation",
    status: "pass",
    message: `OpenCode ${version ?? "installed"}`,
  }
}

async function checkVigiloPlugin(): Promise<CheckResult> {
  const config = detectCurrentConfig()

  if (!config.isInstalled) {
    return {
      id: "vigilo-plugin",
      name: "Vigilo Plugin",
      status: "fail",
      message: "Vigilo not registered in opencode.json",
      details: ["Run: bunx vigilo install"],
    }
  }

  return {
    id: "vigilo-plugin",
    name: "Vigilo Plugin",
    status: "pass",
    message: "Vigilo registered",
  }
}

async function checkFoundry(): Promise<CheckResult> {
  const installed = await isFoundryInstalled()
  const version = await getFoundryVersion()

  if (!installed) {
    return {
      id: "foundry",
      name: "Foundry",
      status: "warn",
      message: "Foundry not found (optional)",
      details: ["Install: curl -L https://foundry.paradigm.xyz | bash && foundryup"],
    }
  }

  return {
    id: "foundry",
    name: "Foundry",
    status: "pass",
    message: `Foundry ${version ?? "installed"}`,
  }
}

async function checkSolidityLsp(): Promise<CheckResult> {
  // Try multiple possible binary names (LSP servers don't support --version)
  const binaries = [
    "nomicfoundation-solidity-language-server",
    "solidity-language-server", 
    "vscode-solidity-server",
  ]

  const isWindows = process.platform === "win32"
  const whichCmd = isWindows ? "where" : "which"

  for (const bin of binaries) {
    try {
      const proc = Bun.spawn([whichCmd, bin], {
        stdout: "pipe",
        stderr: "pipe",
      })
      await proc.exited

      if (proc.exitCode === 0) {
        return {
          id: "solidity-lsp",
          name: "Solidity LSP",
          status: "pass",
          message: `${bin} available`,
        }
      }
    } catch {
    }
  }

  return {
    id: "solidity-lsp",
    name: "Solidity LSP",
    status: "warn",
    message: "Solidity LSP not found (optional)",
    details: ["Install: npm i -g @nomicfoundation/solidity-language-server"],
  }
}

function printResult(result: CheckResult, verbose: boolean): void {
  const symbol = SYMBOLS[result.status]
  const statusColor = result.status === "pass" ? color.green :
                      result.status === "fail" ? color.red :
                      result.status === "warn" ? color.yellow : color.dim

  console.log(`  ${symbol} ${result.name}: ${statusColor(result.message)}`)

  if (verbose && result.details) {
    for (const detail of result.details) {
      console.log(`      ${color.dim(detail)}`)
    }
  }
}

function printJsonResults(results: CheckResult[]): void {
  const output = {
    status: results.some(r => r.status === "fail") ? "fail" : "pass",
    checks: results,
  }
  console.log(JSON.stringify(output, null, 2))
}

export async function doctor(options: DoctorOptions): Promise<number> {
  const results: CheckResult[] = []

  if (!options.json) {
    console.log()
    console.log(color.bold(color.white(" Vigilo Doctor ")))
    console.log()
  }

  const checks = [
    { id: "installation", fn: checkOpenCode },
    { id: "installation", fn: checkVigiloPlugin },
    { id: "foundry", fn: checkFoundry },
    { id: "tools", fn: checkSolidityLsp },
  ]

  for (const check of checks) {
    if (options.category && check.id !== options.category) continue
    const result = await check.fn()
    results.push(result)
    if (!options.json) {
      printResult(result, options.verbose ?? false)
    }
  }

  if (options.json) {
    printJsonResults(results)
  } else {
    console.log()
    const failed = results.filter(r => r.status === "fail").length
    const warned = results.filter(r => r.status === "warn").length
    const passed = results.filter(r => r.status === "pass").length

    if (failed > 0) {
      console.log(color.red(`  ${failed} check(s) failed`))
    }
    if (warned > 0) {
      console.log(color.yellow(`  ${warned} warning(s)`))
    }
    console.log(color.green(`  ${passed} check(s) passed`))
    console.log()
  }

  return results.some(r => r.status === "fail") ? 1 : 0
}
