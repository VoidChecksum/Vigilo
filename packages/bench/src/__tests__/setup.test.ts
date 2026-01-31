import { describe, test, expect } from "bun:test"

describe("Vigilo Bench Test Setup", () => {
  test("should verify test infrastructure is working", () => {
    // #given
    const testValue = 42

    // #when
    const result = testValue * 2

    // #then
    expect(result).toBe(84)
  })

  test("should handle string assertions", () => {
    // #given
    const message = "Vigilo Bench"

    // #when
    const length = message.length

    // #then
    expect(length).toBe(12)
    expect(message).toContain("Vigilo")
  })

  test("should handle array operations", () => {
    // #given
    const items = [1, 2, 3, 4, 5]

    // #when
    const filtered = items.filter((x) => x > 2)

    // #then
    expect(filtered).toHaveLength(3)
    expect(filtered).toEqual([3, 4, 5])
  })

  test("should handle object assertions", () => {
    // #given
    const config = {
      name: "vigilo-bench",
      version: "0.1.0",
      enabled: true,
    }

    // #when / #then
    expect(config).toHaveProperty("name")
    expect(config.name).toBe("vigilo-bench")
    expect(config.enabled).toBe(true)
  })
})
