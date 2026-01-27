#!/usr/bin/env bun
import { Command } from "commander"
import { install } from "./install"
import { doctor } from "./doctor"
import type { InstallArgs } from "./types"
import type { DoctorOptions } from "./types"
import packageJson from "../../package.json" with { type: "json" }

const VERSION = packageJson.version

const program = new Command()

program
  .name("vigilo")
  .description("Web3 Smart Contract Security Auditing Agent for OpenCode")
  .version(VERSION, "-v, --version", "Show version number")

program
  .command("install")
  .description("Install and configure vigilo with interactive setup")
  .option("--no-tui", "Run in non-interactive mode (requires all options)")
  .option("--claude <value>", "Claude subscription: no, yes, max20")
  .option("--openai <value>", "OpenAI/ChatGPT subscription: no, yes (default: no)")
  .option("--gemini <value>", "Gemini integration: no, yes")
  .option("--copilot <value>", "GitHub Copilot subscription: no, yes")
  .option("--opencode-zen <value>", "OpenCode Zen access: no, yes (default: no)")
  .option("--foundry <value>", "Foundry installed: no, yes")
  .option("--skip-auth", "Skip authentication setup hints")
  .addHelpText("after", `
Examples:
  $ bunx vigilo install
  $ bunx vigilo install --no-tui --claude=max20 --openai=yes --gemini=no --copilot=no --foundry=yes
  $ bunx vigilo install --no-tui --claude=no --gemini=no --copilot=yes --opencode-zen=yes --foundry=no

Model Providers (Priority: Native > Copilot > OpenCode Zen):
  Claude        Native anthropic/ models (Opus, Sonnet, Haiku)
  OpenAI        Native openai/ models (GPT-5.2 for deep analysis)
  Gemini        Native google/ models (Gemini 3 Pro, Flash)
  Copilot       github-copilot/ models (fallback)
  OpenCode Zen  opencode/ models (opencode/claude-opus-4-5, etc.)
`)
  .action(async (options) => {
    const args: InstallArgs = {
      tui: options.tui !== false,
      claude: options.claude,
      openai: options.openai,
      gemini: options.gemini,
      copilot: options.copilot,
      opencodeZen: options.opencodeZen,
      foundry: options.foundry,
      skipAuth: options.skipAuth ?? false,
    }
    const exitCode = await install(args)
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Check vigilo installation health and diagnose issues")
  .option("--verbose", "Show detailed diagnostic information")
  .option("--json", "Output results in JSON format")
  .option("--category <category>", "Run only specific category")
  .addHelpText("after", `
Examples:
  $ bunx vigilo doctor
  $ bunx vigilo doctor --verbose
  $ bunx vigilo doctor --json
  $ bunx vigilo doctor --category foundry

Categories:
  installation     Check OpenCode and plugin installation
  foundry          Check Foundry installation
  tools            Check LSP and other tools
`)
  .action(async (options) => {
    const doctorOptions: DoctorOptions = {
      verbose: options.verbose ?? false,
      json: options.json ?? false,
      category: options.category,
    }
    const exitCode = await doctor(doctorOptions)
    process.exit(exitCode)
  })

program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log(`vigilo v${VERSION}`)
  })

program.parse()
