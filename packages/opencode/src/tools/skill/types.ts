import type { SkillScope, LoadedSkill } from "../../features/opencode-skill-loader/types"
import type { SkillMcpManager } from "../../features/skill-mcp-manager"

export interface SkillArgs {
  name: string
}

export interface SkillInfo {
  name: string
  description: string
  location?: string
  scope: SkillScope
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
}

export interface SkillLoadOptions {
  opencodeOnly?: boolean
  skills?: LoadedSkill[]
  mcpManager?: SkillMcpManager
  getSessionID?: () => string
}
