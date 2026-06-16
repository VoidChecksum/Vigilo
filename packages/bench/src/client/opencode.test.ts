import { describe, test, expect } from "bun:test"
import { addMessageUsage, sumSessionUsage, parseLLMResponse, type UsageTotals } from "./opencode"

const zero: UsageTotals = { cost: 0, tokens: 0 }

describe("parseLLMResponse", () => {
  const verdict = '{"is_match":true,"is_partial_match":false,"explanation":"x","severity_from_junior_auditor":"high","severity_from_truth":"high","index_of_finding_from_junior_auditor":0}'
  test("#given a fenced ```json block #then parses it", () => {
    const r = parseLLMResponse("Sure!\n```json\n" + verdict + "\n```\nDone.")
    expect(r?.is_match).toBe(true)
    expect(r?.index_of_finding_from_junior_auditor).toBe(0)
  })
  test("#given raw JSON #then parses it", () => {
    expect(parseLLMResponse(verdict)?.is_match).toBe(true)
  })
  test("#given JSON wrapped in prose (no fence) #then extracts the bare object", () => {
    const r = parseLLMResponse("Here is my verdict: " + verdict + " — hope that helps")
    expect(r?.is_match).toBe(true)
  })
  test("#given non-JSON (e.g. a summary template) #then returns null", () => {
    expect(parseLLMResponse("## Goal\n- none\n## Progress\n- none")).toBeNull()
  })
})

describe("sumSessionUsage", () => {
  test("#given a session's messages #then sums audit cost + tokens", () => {
    const messages = [
      { info: { cost: 0.1, tokens: { input: 100, output: 50 } } },
      { info: { cost: 0.2, tokens: { input: 200, output: 80, reasoning: 20 } } },
      { info: undefined }, // user message / no usage
    ]
    const r = sumSessionUsage(messages)
    expect(r.cost).toBeCloseTo(0.3)
    expect(r.tokens).toBe(100 + 50 + 200 + 80 + 20)
  })
  test("#given no messages #then zero", () => {
    expect(sumSessionUsage([])).toEqual({ cost: 0, tokens: 0 })
    expect(sumSessionUsage(undefined as never)).toEqual({ cost: 0, tokens: 0 })
  })
})

describe("addMessageUsage", () => {
  test("#given a message with cost + tokens #then accumulates (input+output+reasoning)", () => {
    const r = addMessageUsage(zero, { cost: 0.5, tokens: { input: 100, output: 50, reasoning: 10 } })
    expect(r).toEqual({ cost: 0.5, tokens: 160 })
  })

  test("#given successive messages #then totals add up", () => {
    let acc = zero
    acc = addMessageUsage(acc, { cost: 0.25, tokens: { input: 10, output: 5 } })
    acc = addMessageUsage(acc, { cost: 0.25, tokens: { input: 20, output: 5 } })
    expect(acc.cost).toBeCloseTo(0.5)
    expect(acc.tokens).toBe(40)
  })

  test("#given undefined info or fields #then unchanged / zero-safe", () => {
    expect(addMessageUsage(zero, undefined)).toEqual(zero)
    expect(addMessageUsage(zero, {})).toEqual(zero)
    expect(addMessageUsage(zero, { tokens: { input: 7 } })).toEqual({ cost: 0, tokens: 7 })
  })
})
