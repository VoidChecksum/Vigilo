import type { AgentConfig } from "@opencode-ai/sdk"
import { AUDITOR_JUNIOR_BASE_PROMPT, BLOCKED_TOOLS, DEFAULT_MODEL } from "./constants"

export function createToolRestrictions(blockedTools: string[]): { permission: Record<string, "deny"> } {
  const permission: Record<string, "deny"> = {}
  for (const tool of blockedTools) {
    permission[tool] = "deny"
  }
  return { permission }
}

export interface CreateAuditorOptions {
  name: string
  description: string
  model?: string
  color: string
  prompt: string
  temperature?: number
  maxTokens?: number
  thinkingBudget?: number
}

export function createAuditor(options: CreateAuditorOptions): AgentConfig {
  const {
    name,
    description,
    model = DEFAULT_MODEL,
    color,
    prompt,
    temperature = 0.1,
    maxTokens = 64000,
    thinkingBudget = 16000,
  } = options

  const combinedPrompt = `${AUDITOR_JUNIOR_BASE_PROMPT}\n\n<Auditor_Instructions>\n${prompt}\n</Auditor_Instructions>`
  const toolsConfig = createToolRestrictions(BLOCKED_TOOLS)

  const base: AgentConfig = {
    name,
    description,
    mode: "subagent" as const,
    model,
    temperature,
    maxTokens,
    prompt: combinedPrompt,
    color,
    ...toolsConfig,
  }

  if (model.includes("gpt")) {
    return { ...base, reasoningEffort: "medium" } as AgentConfig
  }

  return {
    ...base,
    thinking: { type: "enabled", budgetTokens: thinkingBudget },
  } as AgentConfig
}
