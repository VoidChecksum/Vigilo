import type { EchidnaParseResult, EchidnaTestResult } from "./types"

interface RawTx {
  function?: string
  // echidna's encoding of argument values varies across versions, so keep it untyped.
  arguments?: unknown[]
}

interface RawEchidnaTest {
  name?: string
  status?: string
  transactions?: RawTx[]
}

interface RawEchidnaOutput {
  success?: boolean
  error?: string | null
  tests?: RawEchidnaTest[]
}

/**
 * Parse echidna `--format json` output. Echidna prints human progress lines first and
 * then a single JSON report, so we extract the first balanced top-level object. A test
 * whose status is not "passed" was FALSIFIED — echidna found a call sequence that breaks
 * the property (a candidate bug); the sequence is returned.
 */
export function parseEchidnaJson(stdout: string): EchidnaParseResult {
  const json = extractJsonObject(stdout)
  if (!json) return { ok: false, results: [], error: "No JSON object found in echidna output" }

  let data: RawEchidnaOutput
  try {
    data = JSON.parse(json) as RawEchidnaOutput
  } catch (e) {
    return { ok: false, results: [], error: `Invalid echidna JSON: ${e instanceof Error ? e.message : String(e)}` }
  }

  const results: EchidnaTestResult[] = (data.tests ?? []).map((t) => {
    const status = (t.status ?? "unknown").toLowerCase()
    return {
      name: t.name ?? "unknown",
      status,
      passed: status === "passed",
      // Render each call with its concrete arguments — for a fuzzing
      // falsification the argument values ARE the reproducible exploit input.
      callSequence: (t.transactions ?? [])
        .filter((tx) => tx.function)
        .map((tx) => `${tx.function}(${(tx.arguments ?? []).map((a) => String(a)).join(", ")})`),
    }
  })

  return { ok: true, results }
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
