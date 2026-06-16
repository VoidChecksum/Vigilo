import { describe, test, expect } from "bun:test"
import { PHASE_PIPELINE, unmetPrerequisites, canEnterPhase, runnablePhases } from "./pipeline"

describe("audit phase pipeline (W2-1)", () => {
  test("#then every phase has a prerequisite spec", () => {
    for (const p of ["scope", "recon", "analysis", "poc", "report", "complete"] as const) {
      expect(PHASE_PIPELINE[p]).toBeDefined()
    }
  })

  test("#given nothing done #then only scope is runnable", () => {
    expect(runnablePhases([])).toEqual(["scope"])
    expect(canEnterPhase("scope", [])).toBe(true)
    expect(canEnterPhase("analysis", [])).toBe(false)
  })

  test("#given scope+recon #then analysis runnable, poc blocked", () => {
    expect(canEnterPhase("analysis", ["scope", "recon"])).toBe(true)
    expect(canEnterPhase("poc", ["scope", "recon"])).toBe(false)
    expect(runnablePhases(["scope", "recon"])).toEqual(["analysis"])
  })

  test("#given analysis incomplete #then poc reports the missing prerequisite", () => {
    expect(unmetPrerequisites("poc", ["scope", "recon"])).toEqual(["analysis"])
    expect(unmetPrerequisites("analysis", ["scope"])).toEqual(["recon"])
  })

  test("#given all work phases done #then nothing runnable (complete excluded)", () => {
    expect(runnablePhases(["scope", "recon", "analysis", "poc", "report"])).toEqual([])
    expect(canEnterPhase("complete", ["scope", "recon", "analysis", "poc", "report"])).toBe(true)
  })
})
