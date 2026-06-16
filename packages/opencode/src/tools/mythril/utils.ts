import type { MythrilFinding, MythrilParseResult } from "./types"

interface RawMythrilIssue {
  title?: string
  severity?: string
  "swc-id"?: string
  swc_id?: string
  description?: string
  filename?: string
  lineno?: number
  function?: string
}

interface RawMythrilOutput {
  success?: boolean
  error?: string | null
  issues?: RawMythrilIssue[]
}

/** Normalize a raw SWC id (Mythril emits e.g. "101") to "SWC-101". */
export function normalizeSwc(id: string | undefined): string | null {
  if (!id) return null
  const trimmed = String(id).trim()
  if (!trimmed) return null
  return /^swc-/i.test(trimmed) ? trimmed.toUpperCase() : `SWC-${trimmed}`
}

/**
 * Parse Mythril's `-o json` output. Tolerant of stdout noise: extracts
 * the first JSON object if the stream isn't pure JSON.
 */
export function parseMythrilJson(stdout: string): MythrilParseResult {
  const json = extractJsonObject(stdout)
  if (!json) return { ok: false, findings: [], error: "No JSON object found in Mythril output" }

  let parsed: RawMythrilOutput
  try {
    parsed = JSON.parse(json) as RawMythrilOutput
  } catch (e) {
    return { ok: false, findings: [], error: `Failed to parse Mythril JSON: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (parsed.success === false && parsed.error) {
    return { ok: false, findings: [], error: parsed.error }
  }

  const issues = parsed.issues ?? []
  const findings: MythrilFinding[] = issues.map((i) => ({
    title: i.title ?? "Unknown issue",
    severity: i.severity ?? "Low",
    swc_id: normalizeSwc(i["swc-id"] ?? i.swc_id),
    description: (i.description ?? "").trim(),
    file: i.filename ?? null,
    line: typeof i.lineno === "number" ? i.lineno : null,
    function: i.function ?? null,
  }))

  return { ok: true, findings }
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
