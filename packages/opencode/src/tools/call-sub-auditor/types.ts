import type { AllowedAgent } from "./constants"

export interface CallSubAuditorArgs {
  description: string
  prompt: string
  subagent_type: AllowedAgent
  run_in_background: boolean
  session_id?: string
}
