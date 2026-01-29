import type { AllowedAgent } from "./constants"

export interface CallVigiloAgentArgs {
  description: string
  prompt: string
  subagent_type: AllowedAgent
  run_in_background: boolean
  session_id?: string
}
