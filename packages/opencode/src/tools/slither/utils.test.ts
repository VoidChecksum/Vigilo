import { describe, test, expect } from "bun:test"
import { parseSlitherJson } from "./utils"

const sample = JSON.stringify({
  success: true,
  error: null,
  results: {
    detectors: [
      {
        check: "reentrancy-eth",
        impact: "High",
        confidence: "Medium",
        description: "Reentrancy in Vault.withdraw()\n\tExternal calls:\n\t- (success) = msg.sender.call",
        elements: [
          {
            type: "function",
            name: "withdraw",
            source_mapping: { filename_relative: "src/Vault.sol", lines: [42, 43, 44] },
          },
        ],
      },
      {
        check: "solc-version",
        impact: "Informational",
        confidence: "High",
        description: "Pragma version too recent",
        elements: [{ source_mapping: { filename_short: "src/Vault.sol", lines: [1] } }],
      },
    ],
  },
})

describe("parseSlitherJson", () => {
  test("#given pure JSON #then parses detectors into normalized findings", () => {
    const r = parseSlitherJson(sample)
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(2)
    const reentrancy = r.findings[0]
    expect(reentrancy.check).toBe("reentrancy-eth")
    expect(reentrancy.impact).toBe("High")
    expect(reentrancy.file).toBe("src/Vault.sol")
    expect(reentrancy.lines[0]).toBe(42)
  })

  test("#given JSON wrapped in stdout noise #then still extracts the object", () => {
    const noisy = `Compiling...\nINFO:Detectors:\n${sample}\nINFO:Slither:done`
    const r = parseSlitherJson(noisy)
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(2)
  })

  test("#given a string with braces inside JSON strings #then balances correctly", () => {
    const tricky = JSON.stringify({
      success: true,
      results: { detectors: [{ check: "x", impact: "Low", confidence: "Low", description: "has { brace } in text", elements: [] }] },
    })
    const r = parseSlitherJson(tricky)
    expect(r.ok).toBe(true)
    expect(r.findings[0].file).toBeNull()
  })

  test("#given success:false #then returns error", () => {
    const r = parseSlitherJson(JSON.stringify({ success: false, error: "compilation failed" }))
    expect(r.ok).toBe(false)
    expect(r.error).toContain("compilation failed")
  })

  test("#given non-JSON output #then returns not-ok", () => {
    const r = parseSlitherJson("Traceback (most recent call last): slither crashed")
    expect(r.ok).toBe(false)
  })
})
