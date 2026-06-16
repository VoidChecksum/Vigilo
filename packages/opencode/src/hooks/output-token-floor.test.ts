import { describe, test, expect } from "bun:test"
import { createOutputTokenFloorHook, DEFAULT_OUTPUT_TOKEN_FLOOR } from "./output-token-floor"

function makeOutput(maxOutputTokens: number | undefined) {
  return { temperature: 0, topP: 1, topK: 0, maxOutputTokens, options: {} }
}

const input = (modelOutputLimit?: number) => ({
  sessionID: "s1",
  agent: "vigilo",
  model: modelOutputLimit !== undefined ? { limit: { output: modelOutputLimit } } : undefined,
})

describe("output-token-floor hook", () => {
  describe("#given an undefined maxOutputTokens", () => {
    test("#then it is raised to the floor", async () => {
      const hook = createOutputTokenFloorHook(16384)
      const out = makeOutput(undefined)
      await hook["chat.params"](input(200_000), out)
      expect(out.maxOutputTokens).toBe(16384)
    })
  })

  describe("#given a too-low maxOutputTokens (provider 4096 default)", () => {
    test("#then it is raised to the floor", async () => {
      const hook = createOutputTokenFloorHook(16384)
      const out = makeOutput(4096)
      await hook["chat.params"](input(64_000), out)
      expect(out.maxOutputTokens).toBe(16384)
    })
  })

  describe("#given a maxOutputTokens already above the floor", () => {
    test("#then it is left unchanged", async () => {
      const hook = createOutputTokenFloorHook(16384)
      const out = makeOutput(32_000)
      await hook["chat.params"](input(64_000), out)
      expect(out.maxOutputTokens).toBe(32_000)
    })
  })

  describe("#given a model whose output limit is below the floor", () => {
    test("#then the target is clamped to the model limit (never exceeds capacity)", async () => {
      const hook = createOutputTokenFloorHook(16384)
      const out = makeOutput(undefined)
      await hook["chat.params"](input(8192), out)
      expect(out.maxOutputTokens).toBe(8192)
    })
  })

  describe("#given no model limit info", () => {
    test("#then it falls back to the floor", async () => {
      const hook = createOutputTokenFloorHook(16384)
      const out = makeOutput(undefined)
      await hook["chat.params"](input(undefined), out)
      expect(out.maxOutputTokens).toBe(16384)
    })
  })

  describe("#given an invalid floor", () => {
    test("#then it leaves output untouched", async () => {
      const hook = createOutputTokenFloorHook(0)
      const out = makeOutput(4096)
      await hook["chat.params"](input(64_000), out)
      expect(out.maxOutputTokens).toBe(4096)
    })
  })

  test("#then the default floor is 16384", () => {
    expect(DEFAULT_OUTPUT_TOKEN_FLOOR).toBe(16384)
  })
})
