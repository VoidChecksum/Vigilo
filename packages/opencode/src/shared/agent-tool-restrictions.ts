/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

import { findCaseInsensitive } from "./case-insensitive"

const EXPLORATION_AGENT_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  delegate_task: false,
  call_vigilo_agent: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  explorator: EXPLORATION_AGENT_DENYLIST,

  speculator: EXPLORATION_AGENT_DENYLIST,
}

export function getAgentToolRestrictions(agentName: string): Record<string, boolean> {
  return findCaseInsensitive(AGENT_RESTRICTIONS, agentName) ?? {}
}

export function hasAgentToolRestrictions(agentName: string): boolean {
  const restrictions = findCaseInsensitive(AGENT_RESTRICTIONS, agentName)
  return restrictions !== undefined && Object.keys(restrictions).length > 0
}

/** Env flag a power user can set to bypass safety-critical tool restrictions. */
export const UNSAFE_OVERRIDE_ENV = "VIGILO_ALLOW_UNSAFE_OVERRIDES"

/**
 * Re-assert an agent's safety-critical tool restrictions over a (possibly
 * user-overridden) tools map. Recon agents are read-only; a `vigilo.json` override
 * must not be able to silently grant them write/edit/delegate. Denied tools are
 * forced back to their safe value unless {@link UNSAFE_OVERRIDE_ENV} is set to "1".
 */
export function enforceToolRestrictions(
  agentName: string,
  tools: Record<string, boolean> | undefined
): Record<string, boolean> | undefined {
  const restrictions = getAgentToolRestrictions(agentName)
  if (Object.keys(restrictions).length === 0) return tools
  if (process.env[UNSAFE_OVERRIDE_ENV] === "1") return tools
  return { ...(tools ?? {}), ...restrictions }
}
