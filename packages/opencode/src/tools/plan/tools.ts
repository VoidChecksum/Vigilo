import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { log } from "../../shared"
import { AuditPlanStore } from "./store"
import { PHASES, isPhase } from "./types"
import { runnablePhases, unmetPrerequisites } from "./pipeline"
import type { AuditPlan } from "./types"

interface ToolCtx {
  directory?: string
  sessionID?: string
}

function planStore(context: unknown): { store: AuditPlanStore; session?: string } {
  const ctx = (context ?? {}) as ToolCtx
  return {
    store: new AuditPlanStore(ctx.directory ?? process.cwd()),
    session: ctx.sessionID,
  }
}

function summarize(p: AuditPlan): string {
  const byStatus = new Map<string, number>()
  for (const f of p.findings) byStatus.set(f.status, (byStatus.get(f.status) ?? 0) + 1)
  const statusLine =
    p.findings.length === 0
      ? "none yet"
      : [...byStatus.entries()].map(([s, n]) => `${s}=${n}`).join(", ")
  const next = runnablePhases(p.completed_phases)
  return [
    `Phase: ${p.current_phase}  (completed: ${p.completed_phases.join(", ") || "none"})`,
    next.length ? `Runnable next: ${next.join(", ")}` : `No further phases runnable (audit done or blocked).`,
    p.protocol_name ? `Protocol: ${p.protocol_name}${p.protocol_type ? ` (${p.protocol_type})` : ""}` : null,
    `Findings: ${p.findings.length} — ${statusLine}`,
    `Sessions: ${p.session_ids.length}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export const plan_init: ToolDefinition = tool({
  description:
    "Initialize or resume the typed audit plan (.vigilo/audit-state.json). Call once at audit " +
    "start: creates the plan at the `scope` phase, or resumes an existing one (appending this " +
    "session). Use instead of hand-editing audit-state.json.",
  args: {
    protocol_name: tool.schema.string().optional().describe("Protocol/project name."),
    protocol_type: tool.schema.string().optional().describe("e.g. 'Vault/ERC4626', 'Lending'."),
    platform: tool.schema.string().optional().describe("Target platform (code4rena, sherlock, …)."),
    scope_file: tool.schema.string().optional().describe("Scope file path."),
  },
  async execute(args, context) {
    log("plan_init", args)
    const { store, session } = planStore(context)
    const resuming = store.exists()
    const plan = store.init({ ...args, session }, new Date().toISOString())
    return `${resuming ? "Resumed" : "Initialized"} audit plan.\n${summarize(plan)}`
  },
})

export const plan_status: ToolDefinition = tool({
  description:
    "Report the current audit-plan state: current phase, completed phases, and finding counts " +
    "by lifecycle status. Use to decide what to do next or to resume.",
  args: {},
  async execute(_args, context) {
    log("plan_status", {})
    const { store } = planStore(context)
    const plan = store.read()
    if (!plan) return "No audit plan yet. Call plan_init first."
    return summarize(plan)
  },
})

export const plan_complete_phase: ToolDefinition = tool({
  description:
    "Mark an audit phase complete and advance to the next. Phases (in order): " +
    `${PHASES.join(" -> ")}. Advances deterministically and reports when a phase is completed ` +
    "before its prerequisites (out-of-order progression).",
  args: {
    phase: tool.schema.enum(PHASES as unknown as [string, ...string[]]).describe("The phase just completed."),
  },
  async execute(args, context) {
    log("plan_complete_phase", args)
    if (!isPhase(args.phase)) return `Invalid phase "${args.phase}". Valid: ${PHASES.join(", ")}`
    const { store } = planStore(context)
    // Check prerequisites against the state BEFORE completing so we can flag
    // out-of-order completion (e.g. 'report' done while 'analysis' never was).
    const prior = store.read()
    const unmet = unmetPrerequisites(args.phase, prior?.completed_phases ?? [])
    const plan = store.completePhase(args.phase)
    const warn = unmet.length
      ? ` (warning: completed out of order — unmet prerequisites: ${unmet.join(", ")})`
      : ""
    return `Completed '${args.phase}'. Now on '${plan.current_phase}'.${warn}`
  },
})

export const plan_record_finding: ToolDefinition = tool({
  description:
    "Record (or update) a finding in the audit plan for lifecycle tracking. Lets the orchestrator " +
    "answer questions like 'which High findings are still unverified' and resume reliably. " +
    "Status should track the finding contract (draft / poc-pending / validated / needs-review / invalidated).",
  args: {
    id: tool.schema.string().describe("Globally-unique finding id (e.g. VIG-001)."),
    severity: tool.schema.string().describe("critical | high | medium | low | informational."),
    status: tool.schema.string().describe("draft | poc-pending | validated | needs-review | invalidated."),
    title: tool.schema.string().optional(),
    target: tool.schema.string().optional().describe("file:line-range."),
    auditor: tool.schema.string().optional(),
  },
  async execute(args, context) {
    log("plan_record_finding", args)
    const { store } = planStore(context)
    store.recordFinding(args)
    return `Recorded finding ${args.id} (${args.severity}, ${args.status}).`
  },
})

export const plan_query: ToolDefinition = tool({
  description:
    "Query plan findings by status and/or severity — e.g. all unverified High findings before " +
    "moving from analysis to PoC. Returns JSON.",
  args: {
    status: tool.schema.string().optional(),
    severity: tool.schema.string().optional(),
  },
  async execute(args, context) {
    log("plan_query", args)
    const { store } = planStore(context)
    const findings = store.queryFindings(args)
    if (findings.length === 0) return "No matching findings."
    return `${findings.length} finding(s):\n${JSON.stringify(findings, null, 2)}`
  },
})

export const planTools: Record<string, ToolDefinition> = {
  plan_init,
  plan_status,
  plan_complete_phase,
  plan_record_finding,
  plan_query,
}
