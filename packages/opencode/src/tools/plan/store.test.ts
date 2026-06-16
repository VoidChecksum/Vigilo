import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AuditPlanStore, computeCurrentPhase } from "./store"

describe("computeCurrentPhase", () => {
  test("#given no completed #then scope", () => {
    expect(computeCurrentPhase([])).toBe("scope")
  })
  test("#given scope+recon #then analysis", () => {
    expect(computeCurrentPhase(["scope", "recon"])).toBe("analysis")
  })
  test("#given all work phases #then complete", () => {
    expect(computeCurrentPhase(["scope", "recon", "analysis", "poc", "report"])).toBe("complete")
  })
  test("#given out-of-order completion #then first gap", () => {
    expect(computeCurrentPhase(["scope", "analysis"])).toBe("recon")
  })
})

describe("AuditPlanStore", () => {
  let dir: string
  let store: AuditPlanStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vigilo-plan-"))
    store = new AuditPlanStore(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  test("#given init #then creates plan at scope phase", () => {
    const p = store.init({ protocol_name: "Acme", session: "s1" }, "2026-01-01T00:00:00Z")
    expect(p.current_phase).toBe("scope")
    expect(p.session_ids).toEqual(["s1"])
    expect(p.protocol_name).toBe("Acme")
    expect(store.exists()).toBe(true)
  })

  test("#given init twice #then resumes and appends session (no duplicate)", () => {
    store.init({ session: "s1" }, "2026-01-01T00:00:00Z")
    const p = store.init({ session: "s2" }, "2026-01-02T00:00:00Z")
    expect(p.session_ids).toEqual(["s1", "s2"])
    expect(p.started_at).toBe("2026-01-01T00:00:00Z") // preserved across resume
    const again = store.init({ session: "s2" }, "x")
    expect(again.session_ids).toEqual(["s1", "s2"]) // no dup
  })

  test("#given completePhase #then advances current_phase deterministically", () => {
    store.init({}, "t")
    expect(store.completePhase("scope").current_phase).toBe("recon")
    expect(store.completePhase("recon").current_phase).toBe("analysis")
    const p = store.completePhase("scope") // idempotent
    expect(p.completed_phases.filter((x) => x === "scope")).toHaveLength(1)
    expect(p.current_phase).toBe("analysis")
  })

  test("#given recordFinding #then upserts by id and is queryable", () => {
    store.init({}, "t")
    store.recordFinding({ id: "VIG-001", severity: "high", status: "poc-pending" })
    store.recordFinding({ id: "VIG-001", status: "validated", severity: "high" })
    store.recordFinding({ id: "VIG-002", severity: "high", status: "needs-review" })

    expect(store.queryFindings()).toHaveLength(2)
    expect(store.queryFindings({ status: "validated" })).toHaveLength(1)
    // "which high findings are still unverified?"
    const unverified = store
      .queryFindings({ severity: "high" })
      .filter((f) => f.status !== "validated")
    expect(unverified.map((f) => f.id)).toEqual(["VIG-002"])
  })

  test("#given a legacy audit-state.json (no findings field) #then reads + normalizes", () => {
    mkdirSync(join(dir, ".vigilo"), { recursive: true })
    writeFileSync(
      join(dir, ".vigilo", "audit-state.json"),
      JSON.stringify({ current_phase: "analysis", completed_phases: ["scope", "recon"] })
    )
    const p = store.read()!
    expect(p.current_phase).toBe("analysis")
    expect(p.findings).toEqual([])
    // recording a finding upgrades the legacy file in place
    store.recordFinding({ id: "X", severity: "low", status: "draft" })
    expect(JSON.parse(readFileSync(join(dir, ".vigilo", "audit-state.json"), "utf-8")).findings).toHaveLength(1)
  })

  test("#given corrupt json #then read returns null (no throw)", () => {
    mkdirSync(join(dir, ".vigilo"), { recursive: true })
    writeFileSync(join(dir, ".vigilo", "audit-state.json"), "{ not json")
    expect(store.read()).toBeNull()
  })
})
