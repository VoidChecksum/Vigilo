import { createBuiltinAgents, listAvailableAgents } from "../agents"
import { loadBuiltinCommands } from "../features/builtin-commands"
import {
  discoverOpencodeGlobalSkills,
  discoverOpencodeProjectSkills,
} from "../features/opencode-skill-loader"
import type { VigiloConfig } from "../plugin-config"
import { log } from "../shared"
import { getOpenCodeConfigPaths } from "../shared/opencode-config-dir"
import type { ModelCacheState } from "../plugin-state"
import type { AuditorOverrides } from "../agents/types"

export interface ConfigHandlerDeps {
  ctx: { directory: string; client?: unknown }
  pluginConfig: VigiloConfig
  modelCacheState: ModelCacheState
}

export function createConfigHandler(deps: ConfigHandlerDeps) {
  const { ctx, pluginConfig, modelCacheState } = deps

  return async (config: Record<string, unknown>) => {
    type ProviderConfig = {
      options?: { headers?: Record<string, string> }
      models?: Record<string, { limit?: { context?: number } }>
    }
    const providers = config.provider as Record<string, ProviderConfig> | undefined

    const anthropicBeta = providers?.anthropic?.options?.headers?.["anthropic-beta"]
    modelCacheState.anthropicContext1MEnabled = anthropicBeta?.includes("context-1m") ?? false

    if (providers) {
      for (const [providerID, providerConfig] of Object.entries(providers)) {
        const models = providerConfig?.models
        if (models) {
          for (const [modelID, modelConfig] of Object.entries(models)) {
            const contextLimit = modelConfig?.limit?.context
            if (contextLimit) {
              modelCacheState.modelContextLimitsCache.set(
                `${providerID}/${modelID}`,
                contextLimit
              )
            }
          }
        }
      }
    }

    if (!(config.model as string | undefined)?.trim()) {
      let fallbackModel: string | undefined

      for (const auditorConfig of Object.values(pluginConfig.auditors ?? {})) {
        const model = (auditorConfig as { model?: string })?.model
        if (model && typeof model === "string" && model.trim()) {
          fallbackModel = model.trim()
          break
        }
      }

      if (fallbackModel) {
        config.model = fallbackModel
        log(`No default model specified, using fallback from config: ${fallbackModel}`)
      } else {
        const paths = getOpenCodeConfigPaths({ binary: "opencode", version: null })
        throw new Error(
          "Vigilo requires a default model.\n\n" +
            `Add this to ${paths.configJsonc}:\n\n` +
            '  "model": "anthropic/claude-sonnet-4-5"\n\n' +
            "(Replace with your preferred provider/model)"
        )
      }
    }

    const [
      discoveredOpencodeGlobalSkills,
      discoveredOpencodeProjectSkills,
    ] = await Promise.all([
      discoverOpencodeGlobalSkills(),
      discoverOpencodeProjectSkills(),
    ])

    const allDiscoveredSkills = [
      ...discoveredOpencodeProjectSkills,
      ...discoveredOpencodeGlobalSkills,
    ]

    const builtinAgents = await createBuiltinAgents({
      disabledAgents: pluginConfig.disabled_auditors,
      agentOverrides: pluginConfig.auditors as AuditorOverrides,
      systemDefaultModel: config.model as string,
      client: ctx.client,
    })

    log("Agents loaded", {
      systemDefaultModel: config.model,
      agents: listAvailableAgents(builtinAgents),
    })

    type AgentConfig = Record<string, Record<string, unknown> | undefined>
    const configAgent = config.agent as AgentConfig | undefined

    if (builtinAgents.vigilo) {
      ;(config as { default_agent?: string }).default_agent = "vigilo"
    }

    config.agent = {
      ...builtinAgents,
      ...configAgent,
      build: { ...(configAgent?.build ?? {}), mode: "subagent", hidden: true },
      plan: { ...(configAgent?.plan ?? {}), mode: "subagent", hidden: true },
    }

    const agentResult = config.agent as AgentConfig

    config.tools = {
      ...(config.tools as Record<string, unknown>),
      "grep_app_*": false,
      LspHover: false,
      LspCodeActions: false,
      LspCodeActionResolve: false,
    }

    type AgentWithPermission = { permission?: Record<string, unknown> }

    if (agentResult.vigilo) {
      const agent = agentResult.vigilo as AgentWithPermission
      agent.permission = { ...agent.permission, delegate_task: "allow", question: "allow" }
    }

    config.permission = {
      ...(config.permission as Record<string, unknown>),
      webfetch: "allow",
      external_directory: "allow",
      delegate_task: "deny",
    }

    const builtinCommands = loadBuiltinCommands()
    const systemCommands = (config.command as Record<string, unknown>) ?? {}

    config.command = {
      ...builtinCommands,
      ...systemCommands,
    }
  }
}
