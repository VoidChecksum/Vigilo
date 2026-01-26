import type { CommandDefinition } from "../claude-code-command-loader"

export type BuiltinCommandName = "audit" | "poc" | "report"

export interface BuiltinCommandConfig {
  disabled_commands?: BuiltinCommandName[]
}

export type BuiltinCommands = Record<string, CommandDefinition>
