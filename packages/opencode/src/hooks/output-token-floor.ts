/**
 * Output-token floor hook.
 *
 * Several providers (notably Anthropic) default the per-request output budget to
 * ~4096 tokens. Vigilo's largest deliverables — full audit reports and Foundry
 * PoCs — are written in single large tool/message bodies, so a 4096 ceiling
 * silently TRUNCATES them mid-content (a dropped finding, an unterminated test).
 *
 * This hook raises `maxOutputTokens` to a configured floor for every chat
 * request, but never above the model's actual output limit (`model.limit.output`),
 * so it can't push a request past a model's real capacity. It's the OpenCode-
 * native analogue of Decepticon's `DEFAULT_LLM_MAX_TOKENS = 16384` fix.
 */

/** Default minimum output-token budget. Modern Claude models support far more; */
/** smaller-capacity models are clamped down to their real limit (see below). */
export const DEFAULT_OUTPUT_TOKEN_FLOOR = 16384

interface ChatParamsInput {
  sessionID: string
  agent: string
  model?: { limit?: { output?: number } }
}

interface ChatParamsOutput {
  temperature: number
  topP: number
  topK: number
  maxOutputTokens: number | undefined
  options: Record<string, unknown>
}

export function createOutputTokenFloorHook(floor: number = DEFAULT_OUTPUT_TOKEN_FLOOR) {
  const chatParams = async (input: ChatParamsInput, output: ChatParamsOutput): Promise<void> => {
    if (!Number.isFinite(floor) || floor <= 0) return

    // Never request more than the model can actually produce.
    const modelMax = input.model?.limit?.output
    const target =
      typeof modelMax === "number" && modelMax > 0 ? Math.min(floor, modelMax) : floor

    if (output.maxOutputTokens === undefined || output.maxOutputTokens < target) {
      output.maxOutputTokens = target
    }
  }

  return { "chat.params": chatParams }
}
