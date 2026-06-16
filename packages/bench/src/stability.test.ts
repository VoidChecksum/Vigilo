import { describe, test, expect } from "bun:test"
import { summarizeRuns } from "./utils"

describe("summarizeRuns (W1-7 stability)", () => {
  test("#given identical runs #then stddev 0", () => {
    const r = summarizeRuns([0.5, 0.5, 0.5])
    expect(r.runs).toBe(3)
    expect(r.mean).toBeCloseTo(0.5)
    expect(r.stddev).toBeCloseTo(0)
    expect(r.min).toBe(0.5)
    expect(r.max).toBe(0.5)
  })

  test("#given varying runs #then correct mean/stddev/min/max", () => {
    const r = summarizeRuns([0.4, 0.6, 0.5]) // mean 0.5, population variance = (0.01+0.01+0)/3
    expect(r.mean).toBeCloseTo(0.5)
    expect(r.stddev).toBeCloseTo(Math.sqrt(0.02 / 3), 6)
    expect(r.min).toBe(0.4)
    expect(r.max).toBe(0.6)
  })

  test("#given a single run #then stddev 0, mean = value", () => {
    expect(summarizeRuns([0.73])).toEqual({ runs: 1, mean: 0.73, stddev: 0, min: 0.73, max: 0.73 })
  })

  test("#given no runs #then zeros (no NaN)", () => {
    expect(summarizeRuns([])).toEqual({ runs: 0, mean: 0, stddev: 0, min: 0, max: 0 })
  })
})
