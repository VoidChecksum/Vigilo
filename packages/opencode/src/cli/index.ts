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
  .option("--foundry <value>", "Foundry installed: no, yes")
  .option("--model <value>", "Audit model: sonnet, opus (default: sonnet)")
  .option("--skip-auth", "Skip authentication setup hints")
  .addHelpText("after", `
Examples:
  $ bunx vigilo install
  $ bunx vigilo install --no-tui --foundry=yes --model=sonnet
  $ bunx vigilo install --no-tui --foundry=no --model=opus

Models:
  sonnet    Claude Sonnet 4.5 (Recommended - cost-effective)
  opus      Claude Opus 4.5 (Deep analysis - more expensive)
`)
  .action(async (options) => {
    const args: InstallArgs = {
      tui: options.tui !== false,
      foundry: options.foundry,
      model: options.model,
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
