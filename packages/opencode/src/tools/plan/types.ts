/** Ordered audit phases. `complete` is terminal. */
export const PHASES = ["scope", "recon", "analysis", "poc", "report", "complete"] as const
export type Phase = (typeof PHASES)[number]

export function isPhase(s: string): s is Phase {
  return (PHASES as readonly string[]).includes(s)
}

/** Next phase after `p` in canonical order (stays at `complete` once reached). */
export function nextPhase(p: Phase): Phase {
  const i = PHASES.indexOf(p)
  return i < 0 || i >= PHASES.length - 1 ? "complete" : PHASES[i + 1]
}

/** A finding tracked in the plan for lifecycle/resume queries. */
export interface PlanFinding {
  id: string
  severity: string
  /** Lifecycle status — aligns with the finding contract (validated, needs-review, …). */
  status: string
  title?: string
  target?: string
  auditor?: string
}

/**
 * Typed audit plan persisted at `.vigilo/audit-state.json`. This is the single
 * source of truth for phase progress, session resume, and finding lifecycle —
 * replacing hand-edited JSON with deterministic, queryable state.
 */
export interface AuditPlan {
  protocol_name?: string
  protocol_type?: string
  platform?: string
  scope_file?: string
  started_at: string
  session_ids: string[]
  current_phase: Phase
  completed_phases: Phase[]
  findings: PlanFinding[]
}

export interface PlanInit {
  protocol_name?: string
  protocol_type?: string
  platform?: string
  scope_file?: string
  session?: string
}
