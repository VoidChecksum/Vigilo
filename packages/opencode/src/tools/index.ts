import type { ToolDefinition } from "@opencode-ai/plugin"

export { foundryTools, forge_build, forge_test, forge_coverage, cast_call } from "./foundry"
export type { ForgeBuildArgs, ForgeTestArgs, ForgeCoverageArgs, CastCallArgs } from "./foundry"

export { createDelegateTask } from "./delegate-task"
export type { DelegateTaskToolOptions, DelegateTaskArgs } from "./delegate-task"

export { createCallVigiloAgent } from "./call-vigilo-agent"
export type { CallVigiloAgentArgs } from "./call-vigilo-agent"

export { createBackgroundOutput, createBackgroundCancel } from "./background-task"
export type { BackgroundOutputArgs, BackgroundCancelArgs } from "./background-task"

import { ast_grep_search, ast_grep_replace } from "./ast-grep"
export { ast_grep_search, ast_grep_replace }

import {
  lsp_goto_definition,
  lsp_find_references,
  lsp_symbols,
  lsp_diagnostics,
  lsp_prepare_rename,
  lsp_rename,
} from "./lsp"

export {
  lsp_goto_definition,
  lsp_find_references,
  lsp_symbols,
  lsp_diagnostics,
  lsp_prepare_rename,
  lsp_rename,
  LSPClient,
  lspManager,
  withLspClient,
  findServerForExtension,
  getLanguageId,
  isServerInstalled,
  getAllServers,
} from "./lsp"

export type {
  LSPServerConfig,
  ResolvedServer,
  ServerLookupResult,
  Location,
  LocationLink,
  DocumentSymbol,
  SymbolInfo,
  Diagnostic,
  WorkspaceEdit,
} from "./lsp"

import { glob } from "./glob"
import { grep } from "./grep"
import { interactive_bash, startBackgroundCheck } from "./interactive-bash"
import { skill, createSkillTool } from "./skill"
import { createSkillMcpTool } from "./skill-mcp"
import { slashcommand, createSlashcommandTool, discoverCommandsSync } from "./slashcommand"

export { glob } from "./glob"
export { grep } from "./grep"
export { interactive_bash, startBackgroundCheck } from "./interactive-bash"
export { skill, createSkillTool } from "./skill"
export { createSkillMcpTool } from "./skill-mcp"
export { slashcommand, createSlashcommandTool, discoverCommandsSync } from "./slashcommand"
export * from "./session-manager"

export const builtinTools: Record<string, ToolDefinition> = {
  lsp_goto_definition,
  lsp_find_references,
  lsp_symbols,
  lsp_diagnostics,
  lsp_prepare_rename,
  lsp_rename,
  ast_grep_search,
  ast_grep_replace,
  glob,
  grep,
  interactive_bash,
  skill,
  slashcommand,
}
