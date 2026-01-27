import type { PluginInput } from "@opencode-ai/plugin"

export type OpencodeClient = PluginInput["client"]

export interface SkillDefinition {
  name: string
  description: string
  template?: string
  agent?: string
}

export interface LoadedSkill {
  name: string
  path: string
  definition: SkillDefinition
  scope: "builtin" | "project" | "global"
  lazyContent?: {
    load: () => Promise<string>
  }
}

export interface AgentDefinition {
  name: string
  description: string
  model?: string
  tools?: string[]
  skills?: string[]
  color?: string
}

export interface AuditPhase {
  name: string
  status: "pending" | "in_progress" | "completed" | "failed"
  startTime?: Date
  endTime?: Date
  output?: string
}

export interface AuditContext {
  sessionID: string
  directory: string
  scope: string[]
  phases: AuditPhase[]
  findings: Finding[]
  recon?: {
    codeFindings?: string
    docsFindings?: string
    protocolType?: string
  }
}

export interface Finding {
  id: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  title: string
  description: string
  location: string
  auditor: string
  pocValidated?: boolean
  pocPath?: string
}

export interface VigiloConfig {
  agents?: Record<string, AgentDefinition>
  disabled_skills?: string[]
  disabled_agents?: string[]
}
