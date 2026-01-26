import type { CommandDefinition } from "../claude-code-command-loader"
import type { BuiltinCommandName, BuiltinCommands } from "./types"
import { AUDIT_TEMPLATE } from "./templates/audit"
import { POC_TEMPLATE } from "./templates/poc"
import { REPORT_TEMPLATE } from "./templates/report"

const BUILTIN_COMMAND_DEFINITIONS: Record<BuiltinCommandName, Omit<CommandDefinition, "name">> = {
  audit: {
    description: "(builtin) Start smart contract security audit workflow",
    template: `<command-instruction>
${AUDIT_TEMPLATE}
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>`,
    argumentHint: "[scope.txt] [--platform=code4rena|sherlock|cantina|immunefi] [--skip-poc]",
  },
  poc: {
    description: "(builtin) Generate and validate PoC for a finding",
    template: `<command-instruction>
${POC_TEMPLATE}
</command-instruction>

<finding-path>
$ARGUMENTS
</finding-path>`,
    argumentHint: "<finding-path.md> [--validate-only]",
  },
  report: {
    description: "(builtin) Generate submission-ready audit reports",
    template: `<command-instruction>
${REPORT_TEMPLATE}
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>`,
    argumentHint: "[--platform=code4rena|sherlock|cantina|immunefi] [--finding=H-01] [--summary]",
  },
}

export function loadBuiltinCommands(
  disabledCommands?: BuiltinCommandName[]
): BuiltinCommands {
  const disabled = new Set(disabledCommands ?? [])
  const commands: BuiltinCommands = {}

  for (const [name, definition] of Object.entries(BUILTIN_COMMAND_DEFINITIONS)) {
    if (!disabled.has(name as BuiltinCommandName)) {
      const { argumentHint: _argumentHint, ...openCodeCompatible } = definition
      commands[name] = { ...openCodeCompatible, name } as CommandDefinition
    }
  }

  return commands
}
