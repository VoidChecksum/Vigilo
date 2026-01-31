import type { AgentConfig } from "@opencode-ai/sdk"

export type AuditorFactory = (model: string) => AgentConfig

export type AuditorCategory = "recon" | "specialist" | "utility"

export type AuditorCost = "FAST" | "DEEP" | "EXPENSIVE"

export interface AuditorTrigger {
  protocolType: string
  trigger: string
}

export interface AuditorPromptMetadata {
  category: AuditorCategory
  cost: AuditorCost
  triggers: AuditorTrigger[]
  useWhen?: string[]
  avoidWhen?: string[]
  dedicatedSection?: string
  promptAlias?: string
}

export type BuiltinAuditorName =
  | "vigilo"
  | "quaestor"
  | "explorator"
  | "speculator"
  | "faber"
  | "reentrancy-auditor"
  | "oracle-auditor"
  | "access-control-auditor"
  | "flashloan-auditor"
  | "logic-auditor"
  | "defi-auditor"
  | "cross-chain-auditor"
  | "token-auditor"

export type AuditorOverrideConfig = Partial<AgentConfig> & {
  prompt_append?: string
  variant?: string
  disable?: boolean
}

export type AuditorOverrides = Partial<Record<BuiltinAuditorName, AuditorOverrideConfig>>

export interface AuditorDefinition {
  name: string
  description: string
  model: string
  color: string
  tools: string[]
  skills: string[]
  prompt: string
}

export interface LoadedAuditor {
  name: string
  path: string
  definition: AuditorDefinition
  metadata?: AuditorPromptMetadata
}

export interface AvailableAuditor {
  name: string
  description: string
  metadata?: AuditorPromptMetadata
}

export interface AvailableSkill {
  name: string
  description: string
}
