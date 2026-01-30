export const ALLOWED_AGENTS = ["explorator", "speculator"] as const

export type AllowedAgent = (typeof ALLOWED_AGENTS)[number]

export const CALL_VIGILO_AGENT_DESCRIPTION = `Call Vigilo reconnaissance agents for focused exploration tasks.

**IMPORTANT**: This tool is for subagents (auditors) to call explorator/speculator. Main agents should use delegate_task instead.

Available agents:
{agents}

Parameters:
- description: Short task description (3-5 words)
- prompt: Detailed task for the agent
- subagent_type: "explorator" or "speculator"
- run_in_background: REQUIRED. true=async, false=sync
- session_id: (optional) Continue existing session

Usage:
- explorator: Code reconnaissance - maps contract structure, execution flows, asset locations, protocol type
- speculator: Documentation reconnaissance - extracts protocol design, invariants, trust assumptions
`
