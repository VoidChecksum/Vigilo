import { describe, test, expect } from "bun:test"
import { parseHalmosJson } from "./utils"

// Mirrors REAL halmos 0.3.3 `--json-output` (captured from an overflow check).
// NOTE: kept as a RAW JSON string — uint256 values exceed JS's safe-integer range,
// so a JS object literal would round them before the parser ever sees them.
const real = `{
  "exitcode": 1,
  "test_results": {
    "test/Spec.t.sol:Spec": [
      {
        "name": "check_add(uint256,uint256)",
        "exitcode": 1,
        "models": [
          { "model": {
            "p_b_uint256_1a10aca_00": { "variable_name": "b", "value": 18014398509481977 },
            "p_a_uint256_70f838f_00": { "variable_name": "a", "value": 115792089237316195423570985008687907853269984665640564039457575000713874898947 }
          }, "is_valid": true }
        ]
      },
      { "name": "check_identity(uint256)", "exitcode": 0, "models": [] }
    ]
  }
}`

describe("parseHalmosJson", () => {
  test("#given real halmos output #then maps pass/fail + counterexample", () => {
    const r = parseHalmosJson(real)
    expect(r.ok).toBe(true)
    expect(r.results).toHaveLength(2)

    const add = r.results.find((x) => x.name.startsWith("check_add"))!
    expect(add.passed).toBe(false)
    expect(add.contract).toBe("Spec")
    expect(add.file).toBe("test/Spec.t.sol")
    // Exact uint256 values preserved (no float rounding).
    expect(add.counterexample).toEqual({
      b: "18014398509481977",
      a: "115792089237316195423570985008687907853269984665640564039457575000713874898947",
    })

    const id = r.results.find((x) => x.name.startsWith("check_identity"))!
    expect(id.passed).toBe(true)
    expect(id.counterexample).toBeUndefined()
  })

  test("#given empty test_results #then ok, no results", () => {
    expect(parseHalmosJson(JSON.stringify({ exitcode: 0, test_results: {} }))).toEqual({ ok: true, results: [] })
  })

  test("#given invalid JSON #then not ok", () => {
    expect(parseHalmosJson("boom").ok).toBe(false)
  })
})
