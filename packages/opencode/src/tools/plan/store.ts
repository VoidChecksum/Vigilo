import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { AuditPlan, Phase, PlanFinding, PlanInit } from "./types"
import { PHASES, nextPhase, isPhase } from "./types"

/**
 * Typed store for the audit plan at `.vigilo/audit-state.json`. Formalizes the
 * previously prose-edited state: deterministic phase advancement, session
 * tracking for resume, and a queryable finding lifecycle (e.g. "which High
 * findings are still unverified").
 */
export class AuditPlanStore {
  private readonly path: string

  constructor(workspaceDir: string) {
    this.path = join(workspaceDir, ".vigilo", "audit-state.json")
  }

  exists(): boolean {
    return existsSync(this.path)
  }

  /** Read the plan, tolerating older files that lack newer fields. */
  read(): AuditPlan | null {
    if (!existsSync(this.path)) return null
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf-8")) as Partial<AuditPlan>
      return normalize(raw)
    } catch {
      return null
    }
  }

  /** Create a new plan, or resume an existing one (appending the session id). */
  init(input: PlanInit, nowIso: string): AuditPlan {
    const existing = this.read()
    if (existing) {
      if (input.session && !existing.session_ids.includes(input.session)) {
        existing.session_ids.push(input.session)
      }
      // Fill in any metadata provided on resume without clobbering existing values.
      existing.protocol_name ??= input.protocol_name
      existing.protocol_type ??= input.protocol_type
      existing.platform ??= input.platform
      existing.scope_file ??= input.scope_file
      this.write(existing)
      return existing
    }
    const plan: AuditPlan = {
      protocol_name: input.protocol_name,
      protocol_type: input.protocol_type,
      platform: input.platform,
      scope_file: input.scope_file,
      started_at: nowIso,
      session_ids: input.session ? [input.session] : [],
      current_phase: "scope",
      completed_phases: [],
      findings: [],
    }
    this.write(plan)
    return plan
  }

  /** Mark a phase complete and advance `current_phase` to the next incomplete one. */
  completePhase(phase: Phase): AuditPlan {
    const plan = this.read() ?? this.init({}, new Date().toISOString())
    if (!plan.completed_phases.includes(phase)) plan.completed_phases.push(phase)
    plan.current_phase = computeCurrentPhase(plan.completed_phases)
    this.write(plan)
    return plan
  }

  /** Insert or update a finding by id. */
  recordFinding(finding: PlanFinding): AuditPlan {
    const plan = this.read() ?? this.init({}, new Date().toISOString())
    const idx = plan.findings.findIndex((f) => f.id === finding.id)
    if (idx === -1) plan.findings.push(finding)
    else plan.findings[idx] = { ...plan.findings[idx], ...finding }
    this.write(plan)
    return plan
  }

  queryFindings(filter?: { status?: string; severity?: string }): PlanFinding[] {
    const plan = this.read()
    if (!plan) return []
    return plan.findings.filter((f) => {
      if (filter?.status && f.status !== filter.status) return false
      if (filter?.severity && f.severity !== filter.severity) return false
      return true
    })
  }

  private write(plan: AuditPlan): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.path, JSON.stringify(plan, null, 2) + "\n")
  }
}

/** `current_phase` = first phase not in `completed`, or `complete` if all done. */
export function computeCurrentPhase(completed: Phase[]): Phase {
  for (const p of PHASES) {
    if (p === "complete") break
    if (!completed.includes(p)) return p
  }
  return "complete"
}

function normalize(raw: Partial<AuditPlan>): AuditPlan {
  const completed = (raw.completed_phases ?? []).filter(isPhase)
  const current =
    raw.current_phase && isPhase(raw.current_phase) ? raw.current_phase : computeCurrentPhase(completed)
  return {
    protocol_name: raw.protocol_name,
    protocol_type: raw.protocol_type,
    platform: raw.platform,
    scope_file: raw.scope_file,
    started_at: raw.started_at ?? new Date(0).toISOString(),
    session_ids: Array.isArray(raw.session_ids) ? raw.session_ids : [],
    current_phase: current,
    completed_phases: completed,
    findings: Array.isArray(raw.findings) ? raw.findings : [],
  }
}

export { nextPhase }
