import {
  AGENT_MODEL_REQUIREMENTS,
  type FallbackEntry,
} from "../shared/model-requirements"
import type { InstallConfig } from "./types"

interface ProviderAvailability {
  native: {
    claude: boolean
    openai: boolean
    gemini: boolean
  }
  opencodeZen: boolean
  copilot: boolean
  isMaxPlan: boolean
}

interface AuditorConfig {
  model: string
  variant?: string
}

export interface GeneratedVigiloConfig {
  auditors?: Record<string, AuditorConfig>
  foundry?: boolean
  [key: string]: unknown
}

const ULTIMATE_FALLBACK = "opencode/big-pickle"

function toProviderAvailability(config: InstallConfig): ProviderAvailability {
  return {
    native: {
      claude: config.hasClaude,
      openai: config.hasOpenAI,
      gemini: config.hasGemini,
    },
    opencodeZen: config.hasOpencodeZen,
    copilot: config.hasCopilot,
    isMaxPlan: config.isMax20,
  }
}

function isProviderAvailable(provider: string, avail: ProviderAvailability): boolean {
  const mapping: Record<string, boolean> = {
    anthropic: avail.native.claude,
    openai: avail.native.openai,
    google: avail.native.gemini,
    "github-copilot": avail.copilot,
    opencode: avail.opencodeZen,
  }
  return mapping[provider] ?? false
}

function transformModelForProvider(provider: string, model: string): string {
  if (provider === "github-copilot") {
    return model
      .replace("claude-opus-4-5", "claude-opus-4.5")
      .replace("claude-sonnet-4-5", "claude-sonnet-4.5")
      .replace("claude-haiku-4-5", "claude-haiku-4.5")
      .replace("claude-sonnet-4", "claude-sonnet-4")
  }
  return model
}

function resolveModelFromChain(
  fallbackChain: FallbackEntry[],
  avail: ProviderAvailability
): { model: string; variant?: string } | null {
  for (const entry of fallbackChain) {
    for (const provider of entry.providers) {
      if (isProviderAvailable(provider, avail)) {
        const transformedModel = transformModelForProvider(provider, entry.model)
        return {
          model: `${provider}/${transformedModel}`,
          variant: entry.variant,
        }
      }
    }
  }
  return null
}

function getVigiloFallbackChain(_isMaxPlan: boolean): FallbackEntry[] {
  return AGENT_MODEL_REQUIREMENTS.vigilo.fallbackChain
}

export function generateModelConfig(config: InstallConfig): GeneratedVigiloConfig {
  const avail = toProviderAvailability(config)
  const hasAnyProvider =
    avail.native.claude ||
    avail.native.openai ||
    avail.native.gemini ||
    avail.opencodeZen ||
    avail.copilot

  if (!hasAnyProvider) {
    return {
      foundry: config.hasFoundry,
      auditors: Object.fromEntries(
        Object.keys(AGENT_MODEL_REQUIREMENTS).map((role) => [role, { model: ULTIMATE_FALLBACK }])
      ),
    }
  }

  const auditors: Record<string, AuditorConfig> = {}

  for (const [role, req] of Object.entries(AGENT_MODEL_REQUIREMENTS)) {
    const fallbackChain =
      role === "vigilo" ? getVigiloFallbackChain(avail.isMaxPlan) : req.fallbackChain

    const resolved = resolveModelFromChain(fallbackChain, avail)
    if (resolved) {
      const variant = resolved.variant ?? req.variant
      auditors[role] = variant ? { model: resolved.model, variant } : { model: resolved.model }
    } else {
      auditors[role] = { model: ULTIMATE_FALLBACK }
    }
  }

  return {
    foundry: config.hasFoundry,
    auditors,
  }
}
