import { describe, test, expect, afterEach } from "bun:test"
import { enforceToolRestrictions, UNSAFE_OVERRIDE_ENV } from "./agent-tool-restrictions"

describe("enforceToolRestrictions", () => {
  afterEach(() => {
    delete process.env[UNSAFE_OVERRIDE_ENV]
  })

  test("#given a restricted recon agent #then denied tools are forced false even if override enables them", () => {
    const result = enforceToolRestrictions("explorator", { write: true, edit: true, grep: true })
    expect(result).toMatchObject({ write: false, edit: false, grep: true })
  })

  test("#given speculator #then delegate/task tools cannot be granted", () => {
    const result = enforceToolRestrictions("speculator", { delegate_task: true, call_vigilo_agent: true })
    expect(result?.delegate_task).toBe(false)
    expect(result?.call_vigilo_agent).toBe(false)
  })

  test("#given a non-restricted agent #then tools pass through unchanged", () => {
    const tools = { write: true, edit: true }
    expect(enforceToolRestrictions("reentrancy-auditor", tools)).toEqual(tools)
  })

  test("#given undefined tools for a restricted agent #then restrictions are materialized", () => {
    const result = enforceToolRestrictions("explorator", undefined)
    expect(result?.write).toBe(false)
  })

  test("#given the bypass env flag #then overrides are allowed through", () => {
    process.env[UNSAFE_OVERRIDE_ENV] = "1"
    const tools = { write: true }
    expect(enforceToolRestrictions("explorator", tools)).toEqual(tools)
  })

  test("#given case-insensitive agent name #then restrictions still apply", () => {
    const result = enforceToolRestrictions("Explorator", { write: true })
    expect(result?.write).toBe(false)
  })
})
