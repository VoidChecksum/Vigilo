import { PHASES } from "./types"
import type { Phase } from "./types"

/**
 * Code-defined audit phase pipeline: each phase declares its prerequisite phases.
 * This makes sequencing/gating DATA (and deterministically checkable) rather than
 * relying on prose instructions — the orchestrator can ask "can I run analysis yet?"
 * instead of trusting the model to follow the narrative order.
 */
export const PHASE_PIPELINE: Record<Phase, { requires: Phase[]; description: string }> = {
  scope: { requires: [], description: "Resolve audit scope and target files." },
  recon: { requires: ["scope"], description: "Code + docs reconnaissance (Explorator/Speculator)." },
  analysis: { requires: ["scope", "recon"], description: "Specialist auditors analyze (needs recon context)." },
  poc: { requires: ["analysis"], description: "Validate findings with runnable Foundry PoCs." },
  report: { requires: ["poc"], description: "Generate the submission-ready report." },
  complete: { requires: ["report"], description: "Audit complete." },
}

/** Prerequisite phases for `phase` that are not yet in `completed`. */
export function unmetPrerequisites(phase: Phase, completed: Phase[]): Phase[] {
  const done = new Set(completed)
  return PHASE_PIPELINE[phase].requires.filter((p) => !done.has(p))
}

/** True when every prerequisite of `phase` has been completed. */
export function canEnterPhase(phase: Phase, completed: Phase[]): boolean {
  return unmetPrerequisites(phase, completed).length === 0
}

/**
 * Phases that are eligible to run next: prerequisites met but not yet completed.
 * (Usually one, in canonical order — but returns all eligible for flexibility.)
 */
export function runnablePhases(completed: Phase[]): Phase[] {
  const done = new Set(completed)
  return PHASES.filter((p) => p !== "complete" && !done.has(p) && canEnterPhase(p, completed))
}
