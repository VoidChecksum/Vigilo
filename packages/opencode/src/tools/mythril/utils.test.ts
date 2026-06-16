import { describe, test, expect } from "bun:test"
import { parseMythrilJson, normalizeSwc } from "./utils"

// Shape per Mythril's `-o json` (documented stable schema).
const sample = JSON.stringify({
  error: null,
  issues: [
    {
      title: "Integer Arithmetic Bugs",
      severity: "High",
      "swc-id": "101",
      description: "The arithmetic operator can overflow.\nIt is possible to cause ...",
      filename: "src/Token.sol",
      lineno: 42,
      function: "transfer(address,uint256)",
    },
    {
      title: "External Call To User-Supplied Address",
      severity: "Medium",
      "swc-id": "107",
      description: "A call to a user-supplied address is executed.",
      filename: "src/Token.sol",
      lineno: 88,
      function: "withdraw()",
    },
  ],
  success: true,
})

describe("normalizeSwc", () => {
  test("bare id → SWC- prefixed", () => expect(normalizeSwc("101")).toBe("SWC-101"))
  test("already prefixed → upper-cased", () => expect(normalizeSwc("swc-107")).toBe("SWC-107"))
  test("empty/undefined → null", () => {
    expect(normalizeSwc(undefined)).toBeNull()
    expect(normalizeSwc("")).toBeNull()
  })
})

describe("parseMythrilJson", () => {
  test("#given Mythril JSON #then normalizes issues", () => {
    const r = parseMythrilJson(sample)
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(2)
    expect(r.findings[0]).toMatchObject({
      title: "Integer Arithmetic Bugs",
      severity: "High",
      swc_id: "SWC-101",
      file: "src/Token.sol",
      line: 42,
      function: "transfer(address,uint256)",
    })
  })

  test("#given stdout noise around JSON #then still extracts", () => {
    const r = parseMythrilJson(`mythril: analyzing...\n${sample}\nDone.`)
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(2)
  })

  test("#given success:false with error #then not ok", () => {
    const r = parseMythrilJson(JSON.stringify({ success: false, error: "Solc experienced a fatal error" }))
    expect(r.ok).toBe(false)
    expect(r.error).toContain("Solc")
  })

  test("#given empty issues #then ok with no findings", () => {
    const r = parseMythrilJson(JSON.stringify({ error: null, issues: [], success: true }))
    expect(r.ok).toBe(true)
    expect(r.findings).toHaveLength(0)
  })

  test("#given non-JSON #then not ok", () => {
    expect(parseMythrilJson("Traceback ...").ok).toBe(false)
  })
})
