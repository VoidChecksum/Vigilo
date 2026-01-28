/**
 * Unified system directive prefix for vigilo internal messages.
 * All system-generated messages should use this prefix for consistent filtering.
 *
 * Format: [SYSTEM DIRECTIVE: VIGILO - {TYPE}]
 */

export const SYSTEM_DIRECTIVE_PREFIX = "[SYSTEM DIRECTIVE: VIGILO"

/**
 * Creates a system directive header with the given type.
 * @param type - The directive type (e.g., "TODO CONTINUATION", "RALPH LOOP")
 * @returns Formatted directive string like "[SYSTEM DIRECTIVE: VIGILO - TODO CONTINUATION]"
 */
export function createSystemDirective(type: string): string {
  return `${SYSTEM_DIRECTIVE_PREFIX} - ${type}]`
}

/**
 * Checks if a message starts with the vigilo system directive prefix.
 * Used by keyword-detector and other hooks to skip system-generated messages.
 * @param text - The message text to check
 * @returns true if the message is a system directive
 */
export function isSystemDirective(text: string): boolean {
  return text.trimStart().startsWith(SYSTEM_DIRECTIVE_PREFIX)
}

export const SystemDirectiveTypes = {
  TODO_CONTINUATION: "TODO CONTINUATION",
  RALPH_LOOP: "RALPH LOOP",
  BOULDER_CONTINUATION: "BOULDER CONTINUATION",
  DELEGATION_REQUIRED: "DELEGATION REQUIRED",
  SINGLE_TASK_ONLY: "SINGLE TASK ONLY",
  COMPACTION_CONTEXT: "COMPACTION CONTEXT",
  CONTEXT_WINDOW_MONITOR: "CONTEXT WINDOW MONITOR",
  PROMETHEUS_READ_ONLY: "PROMETHEUS READ-ONLY",
} as const

export type SystemDirectiveType = (typeof SystemDirectiveTypes)[keyof typeof SystemDirectiveTypes]
