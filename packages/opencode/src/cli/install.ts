import * as p from "@clack/prompts"
import color from "picocolors"
import type { InstallArgs, InstallConfig, BooleanArg, AuditModel, DetectedConfig } from "./types"
import {
  addPluginToOpenCodeConfig,
  writeVigiloConfig,
  isOpenCodeInstalled,
  getOpenCodeVersion,
  isFoundryInstalled,
  getFoundryVersion,
  detectCurrentConfig,
} from "./config-manager"
import packageJson from "../../package.json" with { type: "json" }

const VERSION = packageJson.version

const SYMBOLS = {
  check: color.green("[OK]"),
  cross: color.red("[X]"),
  arrow: color.cyan("->"),
  bullet: color.dim("*"),
  info: color.blue("[i]"),
  warn: color.yellow("[!]"),
  star: color.yellow("*"),
}

const MODEL_OPTIONS = {
  sonnet: "anthropic/claude-sonnet-4-5",
  opus: "anthropic/claude-opus-4-5",
} as const

function formatConfigSummary(config: InstallConfig): string {
  const lines: string[] = []

  lines.push(color.bold(color.white("Configuration Summary")))
  lines.push("")

  const foundryStatus = config.hasFoundry ? SYMBOLS.check : color.dim("○")
  const foundryLabel = config.hasFoundry ? color.white("Foundry") : color.dim("Foundry")
  lines.push(`  ${foundryStatus} ${foundryLabel}`)

  lines.push("")
  lines.push(color.dim("─".repeat(40)))
  lines.push("")

  lines.push(color.bold(color.white("Audit Model")))
  lines.push(`  ${SYMBOLS.info} ${color.cyan(config.auditModel)}`)

  return lines.join("\n")
}

function printHeader(isUpdate: boolean): void {
  const mode = isUpdate ? "Update" : "Install"
  console.log()
  console.log(color.bgMagenta(color.white(` Vigilo ${mode} `)))
  console.log()
}

function printStep(step: number, total: number, message: string): void {
  const progress = color.dim(`[${step}/${total}]`)
  console.log(`${progress} ${message}`)
}

function printSuccess(message: string): void {
  console.log(`${SYMBOLS.check} ${message}`)
}

function printError(message: string): void {
  console.log(`${SYMBOLS.cross} ${color.red(message)}`)
}

function printInfo(message: string): void {
  console.log(`${SYMBOLS.info} ${message}`)
}

function printWarning(message: string): void {
  console.log(`${SYMBOLS.warn} ${color.yellow(message)}`)
}

function printBox(content: string, title?: string): void {
  const lines = content.split("\n")
  const maxWidth = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, "").length), title?.length ?? 0) + 4
  const border = color.dim("─".repeat(maxWidth))

  console.log()
  if (title) {
    console.log(color.dim("┌─") + color.bold(` ${title} `) + color.dim("─".repeat(maxWidth - title.length - 4)) + color.dim("┐"))
  } else {
    console.log(color.dim("┌") + border + color.dim("┐"))
  }

  for (const line of lines) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, "")
    const padding = maxWidth - stripped.length
    console.log(color.dim("│") + ` ${line}${" ".repeat(padding - 1)}` + color.dim("│"))
  }

  console.log(color.dim("└") + border + color.dim("┘"))
  console.log()
}

function validateNonTuiArgs(args: InstallArgs): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (args.foundry === undefined) {
    errors.push("--foundry is required (values: no, yes)")
  } else if (!["no", "yes"].includes(args.foundry)) {
    errors.push(`Invalid --foundry value: ${args.foundry} (expected: no, yes)`)
  }

  if (args.model !== undefined && !["sonnet", "opus"].includes(args.model)) {
    errors.push(`Invalid --model value: ${args.model} (expected: sonnet, opus)`)
  }

  return { valid: errors.length === 0, errors }
}

function argsToConfig(args: InstallArgs): InstallConfig {
  const modelKey = args.model ?? "sonnet"
  return {
    hasFoundry: args.foundry === "yes",
    auditModel: MODEL_OPTIONS[modelKey],
  }
}

function detectedToInitialValues(detected: DetectedConfig): { foundry: BooleanArg; model: AuditModel } {
  const modelKey = detected.auditModel.includes("opus") ? "opus" : "sonnet"
  return {
    foundry: detected.hasFoundry ? "yes" : "no",
    model: modelKey as AuditModel,
  }
}

async function runTuiMode(detected: DetectedConfig): Promise<InstallConfig | null> {
  const initial = detectedToInitialValues(detected)

  const foundryInstalled = await isFoundryInstalled()
  const foundryVersion = foundryInstalled ? await getFoundryVersion() : null

  let foundry: BooleanArg
  if (foundryInstalled) {
    p.log.success(`Foundry detected: ${foundryVersion}`)
    foundry = "yes"
  } else {
    const foundryAnswer = await p.select({
      message: "Do you have Foundry installed?",
      options: [
        { value: "no" as const, label: "No", hint: "You can install it later" },
        { value: "yes" as const, label: "Yes", hint: "forge, cast, anvil available" },
      ],
      initialValue: initial.foundry,
    })

    if (p.isCancel(foundryAnswer)) {
      p.cancel("Installation cancelled.")
      return null
    }
    foundry = foundryAnswer
  }

  const model = await p.select({
    message: "Select default audit model:",
    options: [
      { value: "sonnet" as const, label: "Claude Sonnet 4.5", hint: "Recommended - cost-effective" },
      { value: "opus" as const, label: "Claude Opus 4.5", hint: "Deep analysis - more expensive" },
    ],
    initialValue: initial.model,
  })

  if (p.isCancel(model)) {
    p.cancel("Installation cancelled.")
    return null
  }

  return {
    hasFoundry: foundry === "yes",
    auditModel: MODEL_OPTIONS[model],
  }
}

async function runNonTuiInstall(args: InstallArgs): Promise<number> {
  const validation = validateNonTuiArgs(args)
  if (!validation.valid) {
    printHeader(false)
    printError("Validation failed:")
    for (const err of validation.errors) {
      console.log(`  ${SYMBOLS.bullet} ${err}`)
    }
    console.log()
    printInfo("Usage: bunx vigilo install --no-tui --foundry=<no|yes> [--model=<sonnet|opus>]")
    console.log()
    return 1
  }

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  printHeader(isUpdate)

  const totalSteps = 3
  let step = 1

  printStep(step++, totalSteps, "Checking OpenCode installation...")
  const installed = await isOpenCodeInstalled()
  const version = await getOpenCodeVersion()
  if (!installed) {
    printWarning("OpenCode binary not found. Plugin will be configured, but you'll need to install OpenCode to use it.")
    printInfo("Visit https://opencode.ai/docs for installation instructions")
  } else {
    printSuccess(`OpenCode ${version ?? ""} detected`)
  }

  const config = argsToConfig(args)

  printStep(step++, totalSteps, "Adding vigilo plugin...")
  const pluginResult = await addPluginToOpenCodeConfig(VERSION)
  if (!pluginResult.success) {
    printError(`Failed: ${pluginResult.error}`)
    return 1
  }
  printSuccess(`Plugin ${isUpdate ? "verified" : "added"} ${SYMBOLS.arrow} ${color.dim(pluginResult.configPath)}`)

  printStep(step++, totalSteps, "Writing vigilo configuration...")
  const vigiloResult = writeVigiloConfig(config)
  if (!vigiloResult.success) {
    printError(`Failed: ${vigiloResult.error}`)
    return 1
  }
  printSuccess(`Config written ${SYMBOLS.arrow} ${color.dim(vigiloResult.configPath)}`)

  printBox(formatConfigSummary(config), isUpdate ? "Updated Configuration" : "Installation Complete")

  if (!config.hasFoundry) {
    console.log()
    printWarning("Foundry not configured. Some features may be limited.")
    printInfo("Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup")
    console.log()
  }

  console.log(`${SYMBOLS.star} ${color.bold(color.green(isUpdate ? "Configuration updated!" : "Installation complete!"))}`)
  console.log(`  Run ${color.cyan("opencode")} to start!`)
  console.log()

  printBox(
    `Start auditing with ${color.cyan("/audit")} command.\n` +
    `Generate PoC with ${color.cyan("/poc")} command.`,
    "Quick Start"
  )

  return 0
}

export async function install(args: InstallArgs): Promise<number> {
  if (!args.tui) {
    return runNonTuiInstall(args)
  }

  const detected = detectCurrentConfig()
  const isUpdate = detected.isInstalled

  p.intro(color.bgMagenta(color.white(isUpdate ? " Vigilo Update " : " Vigilo Install ")))

  if (isUpdate) {
    const initial = detectedToInitialValues(detected)
    p.log.info(`Existing configuration detected: Model=${initial.model}`)
  }

  const s = p.spinner()
  s.start("Checking OpenCode installation")

  const installed = await isOpenCodeInstalled()
  const version = await getOpenCodeVersion()
  if (!installed) {
    s.stop(`OpenCode binary not found ${color.yellow("[!]")}`)
    p.log.warn("OpenCode binary not found. Plugin will be configured, but you'll need to install OpenCode to use it.")
    p.note("Visit https://opencode.ai/docs for installation instructions", "Installation Guide")
  } else {
    s.stop(`OpenCode ${version ?? "installed"} ${color.green("[OK]")}`)
  }

  const config = await runTuiMode(detected)
  if (!config) return 1

  s.start("Adding vigilo to OpenCode config")
  const pluginResult = await addPluginToOpenCodeConfig(VERSION)
  if (!pluginResult.success) {
    s.stop(`Failed to add plugin: ${pluginResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  s.stop(`Plugin added to ${color.cyan(pluginResult.configPath)}`)

  s.start("Writing vigilo configuration")
  const vigiloResult = writeVigiloConfig(config)
  if (!vigiloResult.success) {
    s.stop(`Failed to write config: ${vigiloResult.error}`)
    p.outro(color.red("Installation failed."))
    return 1
  }
  s.stop(`Config written to ${color.cyan(vigiloResult.configPath)}`)

  if (!config.hasFoundry) {
    p.log.warn("Foundry not configured. Some features may be limited.")
    p.note("curl -L https://foundry.paradigm.xyz | bash && foundryup", "Install Foundry")
  }

  p.note(formatConfigSummary(config), isUpdate ? "Updated Configuration" : "Installation Complete")

  p.log.success(color.bold(isUpdate ? "Configuration updated!" : "Installation complete!"))
  p.log.message(`Run ${color.cyan("opencode")} to start!`)

  p.note(
    `Start auditing with ${color.cyan("/audit")} command.\n` +
    `Generate PoC with ${color.cyan("/poc")} command.`,
    "Quick Start"
  )

  p.outro(color.green("Vigilo is ready!"))

  return 0
}
