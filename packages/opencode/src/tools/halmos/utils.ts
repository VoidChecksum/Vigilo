import type { HalmosParseResult, HalmosTestResult } from "./types"

interface RawModelVar {
  variable_name?: string
  value?: unknown
}

interface RawHalmosTest {
  name?: string
  exitcode?: number
  models?: { model?: Record<string, RawModelVar> }[]
}

interface RawHalmosOutput {
  exitcode?: number
  test_results?: Record<string, RawHalmosTest[]>
}

/**
 * Parse halmos `--json-output` results. A test with a non-zero exitcode means halmos
 * found a COUNTEREXAMPLE — i.e. a symbolic property violation (a candidate bug); a zero
 * exitcode means the property was proven over the explored paths.
 */
export function parseHalmosJson(content: string): HalmosParseResult {
  let data: RawHalmosOutput
  try {
    // Counterexample `value`s are uint256 and routinely exceed JS's safe-integer
    // range, so a plain JSON.parse silently ROUNDS them (wrong exploit input).
    // Quote integer `value` fields first so they survive as exact strings.
    const safe = content.replace(/("value"\s*:\s*)(-?\d+)(\s*[,}])/g, '$1"$2"$3')
    data = JSON.parse(safe) as RawHalmosOutput
  } catch (e) {
    return { ok: false, results: [], error: `Invalid halmos JSON: ${e instanceof Error ? e.message : String(e)}` }
  }

  const results: HalmosTestResult[] = []
  const testResults = data.test_results ?? {}

  for (const [contractPath, tests] of Object.entries(testResults)) {
    const sep = contractPath.lastIndexOf(":")
    const file = sep === -1 ? contractPath : contractPath.slice(0, sep)
    const contract = sep === -1 ? contractPath : contractPath.slice(sep + 1)

    for (const t of tests ?? []) {
      const passed = (t.exitcode ?? 0) === 0
      let counterexample: Record<string, string> | undefined
      const model = t.models?.[0]?.model
      if (!passed && model) {
        counterexample = {}
        for (const v of Object.values(model)) {
          if (v?.variable_name !== undefined) counterexample[v.variable_name] = String(v.value)
        }
      }
      results.push({ file, contract, name: t.name ?? "unknown", passed, counterexample })
    }
  }

  return { ok: true, results }
}
