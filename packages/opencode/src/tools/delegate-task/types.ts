export interface DelegateTaskArgs {
  description: string
  prompt: string
  subagent_type?: string
  category?: string
  run_in_background: boolean
  session_id?: string
  command?: string
  load_skills: string[]
}
