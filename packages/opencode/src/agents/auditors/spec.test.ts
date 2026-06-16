import { describe, test, expect } from "bun:test"
import { AUDITOR_SPECS, AUDITOR_FACTORIES, AUDITOR_METADATA, createAllAuditors } from "./index"

describe("auditor roster spec", () => {
  test("#then the 8 specialist auditors are registered once each", () => {
    expect(AUDITOR_SPECS).toHaveLength(8)
    const names = AUDITOR_SPECS.map((s) => s.name)
    expect(new Set(names).size).toBe(8) // no duplicates
  })

  test("#then derived factory/metadata maps match the spec list exactly", () => {
    expect(Object.keys(AUDITOR_FACTORIES).sort()).toEqual(AUDITOR_SPECS.map((s) => s.name).sort())
    expect(Object.keys(AUDITOR_METADATA).sort()).toEqual(AUDITOR_SPECS.map((s) => s.name).sort())
    for (const s of AUDITOR_SPECS) {
      expect(AUDITOR_FACTORIES[s.name]).toBe(s.factory)
      expect(AUDITOR_METADATA[s.name]).toBe(s.metadata)
    }
  })

  test("#then every factory produces an agent config and metadata is well-formed", () => {
    for (const s of AUDITOR_SPECS) {
      const config = s.factory("anthropic/claude-sonnet-4-5")
      expect(typeof config).toBe("object")
      expect(s.metadata.category).toBeTruthy()
      expect(s.metadata.cost).toBeTruthy()
    }
  })

  test("#then createAllAuditors builds one config per spec", () => {
    const all = createAllAuditors("anthropic/claude-sonnet-4-5")
    expect(Object.keys(all).sort()).toEqual(AUDITOR_SPECS.map((s) => s.name).sort())
  })
})
