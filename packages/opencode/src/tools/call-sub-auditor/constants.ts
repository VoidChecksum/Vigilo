export const ALLOWED_AGENTS = [
  "reentrancy-auditor",
  "oracle-auditor", 
  "access-control-auditor",
  "flashloan-auditor",
  "logic-auditor",
  "defi-auditor",
  "cross-chain-auditor",
  "token-auditor",
] as const

export type AllowedAgent = (typeof ALLOWED_AGENTS)[number]

export const CALL_SUB_AUDITOR_DESCRIPTION = `Call other Vigilo auditors for cross-domain analysis (Swarm Pattern).

**IMPORTANT**: This tool enables auditor-to-auditor collaboration. 
- Sub-auditors use this to request analysis from other specialist auditors.
- Main orchestrator (Vigilo) should use delegate_agent instead.

Available auditors:
{agents}

Parameters:
- description: Short task description (3-5 words)
- prompt: Detailed analysis request for the other auditor
- subagent_type: Target auditor type (e.g., "reentrancy-auditor")
- run_in_background: REQUIRED. true=async, false=sync
- session_id: (optional) Continue existing session

**Swarm Usage Examples:**
- logic-auditor finds calculation error → calls reentrancy-auditor: "Can this be exploited via reentrancy callback?"
- oracle-auditor finds price manipulation → calls flashloan-auditor: "Can this be amplified with flash loan?"
- access-control-auditor finds privilege issue → calls logic-auditor: "What state can be corrupted with this access?"

**When to use swarm:**
- Cross-domain vulnerability analysis
- Validating attack chains across different vulnerability classes
- Getting specialist opinion on edge cases
`
