import { z } from "zod"

const PermissionValue = z.enum(["ask", "allow", "deny"])

const BashPermission = z.union([
  PermissionValue,
  z.record(z.string(), PermissionValue),
])

const AgentPermissionSchema = z.object({
  edit: PermissionValue.optional(),
  bash: BashPermission.optional(),
  webfetch: PermissionValue.optional(),
  doom_loop: PermissionValue.optional(),
  external_directory: PermissionValue.optional(),
})

export const BuiltinAuditorNameSchema = z.enum([
  "vigilo",
  "code-analyzer",
  "docs-analyzer",
  "reentrancy-auditor",
  "oracle-auditor",
  "access-control-auditor",
  "flashloan-auditor",
  "logic-auditor",
  "defi-auditor",
  "cross-chain-auditor",
  "token-auditor",
])

export const BuiltinSkillNameSchema = z.enum([
  "poc",
  "report",
  "audit",
])

export const HookNameSchema = z.enum([
  "todo-continuation-enforcer",
  "context-window-monitor",
  "session-recovery",
  "tool-output-truncator",
  "think-mode",
  "anthropic-context-window-limit-recovery",
  "rules-injector",
  "background-notification",
  "thinking-block-validator",
  "edit-error-recovery",
  "delegate-task-retry",
])

export const BuiltinCommandNameSchema = z.enum([
  "audit",
  "poc",
  "report",
])

export const AuditorOverrideConfigSchema = z.object({
  model: z.string().optional(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  prompt: z.string().optional(),
  prompt_append: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  disable: z.boolean().optional(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  permission: AgentPermissionSchema.optional(),
})

export const AuditorOverridesSchema = z.object({
  vigilo: AuditorOverrideConfigSchema.optional(),
  "code-analyzer": AuditorOverrideConfigSchema.optional(),
  "docs-analyzer": AuditorOverrideConfigSchema.optional(),
  "reentrancy-auditor": AuditorOverrideConfigSchema.optional(),
  "oracle-auditor": AuditorOverrideConfigSchema.optional(),
  "access-control-auditor": AuditorOverrideConfigSchema.optional(),
  "flashloan-auditor": AuditorOverrideConfigSchema.optional(),
  "logic-auditor": AuditorOverrideConfigSchema.optional(),
  "defi-auditor": AuditorOverrideConfigSchema.optional(),
  "cross-chain-auditor": AuditorOverrideConfigSchema.optional(),
  "token-auditor": AuditorOverrideConfigSchema.optional(),
})

export const ExperimentalConfigSchema = z.object({
  aggressive_truncation: z.boolean().optional(),
  auto_resume: z.boolean().optional(),
  truncate_all_tool_outputs: z.boolean().optional(),
})

export const SkillSourceSchema = z.union([
  z.string(),
  z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
    glob: z.string().optional(),
  }),
])

export const SkillDefinitionSchema = z.object({
  description: z.string().optional(),
  template: z.string().optional(),
  from: z.string().optional(),
  model: z.string().optional(),
  agent: z.string().optional(),
  subtask: z.boolean().optional(),
  "argument-hint": z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  "allowed-tools": z.array(z.string()).optional(),
  disable: z.boolean().optional(),
})

export const SkillEntrySchema = z.union([
  z.boolean(),
  SkillDefinitionSchema,
])

export const SkillsConfigSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), SkillEntrySchema).and(z.object({
    sources: z.array(SkillSourceSchema).optional(),
    enable: z.array(z.string()).optional(),
    disable: z.array(z.string()).optional(),
  }).partial()),
])

export const BackgroundTaskConfigSchema = z.object({
  defaultConcurrency: z.number().min(1).optional(),
  providerConcurrency: z.record(z.string(), z.number().min(0)).optional(),
  modelConcurrency: z.record(z.string(), z.number().min(0)).optional(),
  staleTimeoutMs: z.number().min(60000).optional(),
})

export const TmuxLayoutSchema = z.enum([
  'main-horizontal',
  'main-vertical',
  'tiled',
  'even-horizontal',
  'even-vertical',
])

export const TmuxConfigSchema = z.object({
  enabled: z.boolean().default(false),
  layout: TmuxLayoutSchema.default('main-vertical'),
  main_pane_size: z.number().min(20).max(80).default(60),
  main_pane_min_width: z.number().min(40).default(120),
  agent_pane_min_width: z.number().min(20).default(40),
})

export const VigiloConfigSchema = z.object({
  $schema: z.string().optional(),
  foundry: z.boolean().optional(),
  auditors: AuditorOverridesSchema.optional(),
  disabled_auditors: z.array(BuiltinAuditorNameSchema).optional(),
  disabled_skills: z.array(BuiltinSkillNameSchema).optional(),
  disabled_hooks: z.array(HookNameSchema).optional(),
  disabled_commands: z.array(BuiltinCommandNameSchema).optional(),
  experimental: ExperimentalConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  tmux: TmuxConfigSchema.optional(),
})

export type VigiloConfig = z.infer<typeof VigiloConfigSchema>
export type AuditorOverrideConfig = z.infer<typeof AuditorOverrideConfigSchema>
export type AuditorOverrides = z.infer<typeof AuditorOverridesSchema>
export type BackgroundTaskConfig = z.infer<typeof BackgroundTaskConfigSchema>
export type BuiltinAuditorName = z.infer<typeof BuiltinAuditorNameSchema>
export type HookName = z.infer<typeof HookNameSchema>
export type BuiltinCommandName = z.infer<typeof BuiltinCommandNameSchema>
export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
export type ExperimentalConfig = z.infer<typeof ExperimentalConfigSchema>
export type SkillsConfig = z.infer<typeof SkillsConfigSchema>
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>
export type TmuxConfig = z.infer<typeof TmuxConfigSchema>
export type TmuxLayout = z.infer<typeof TmuxLayoutSchema>
