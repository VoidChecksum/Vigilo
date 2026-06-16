import type { SlitherFinding, SlitherParseResult } from "./types"

interface RawSlitherElement {
  source_mapping?: {
    filename_relative?: string
    filename_short?: string
    lines?: number[]
  }
}

interface RawSlitherDetector {
  check?: string
  impact?: string
  confidence?: string
  description?: string
  elements?: RawSlitherElement[]
}

interface RawSlitherOutput {
  success?: boolean
  error?: string | null
  results?: { detectors?: RawSlitherDetector[] }
}

/**
 * Parse Slither's `--json -` output into normalized findings. Tolerant of the
 * surrounding noise Slither prints to stdout/stderr: extracts the first JSON
 * object if the stream isn't pure JSON.
 */
export function parseSlitherJson(stdout: string): SlitherParseResult {
  const json = extractJsonObject(stdout)
  if (!json) {
    return { ok: false, findings: [], error: "No JSON object found in Slither output" }
  }

  let parsed: RawSlitherOutput
  try {
    parsed = JSON.parse(json) as RawSlitherOutput
  } catch (e) {
    return {
      ok: false,
      findings: [],
      error: `Failed to parse Slither JSON: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  if (parsed.success === false) {
    return { ok: false, findings: [], error: parsed.error || "Slither reported failure" }
  }

  const detectors = parsed.results?.detectors ?? []
  const findings: SlitherFinding[] = detectors.map((d) => {
    const el = d.elements?.find((e) => e.source_mapping?.filename_relative || e.source_mapping?.filename_short)
    const sm = el?.source_mapping
    return {
      check: d.check ?? "unknown",
      impact: d.impact ?? "Informational",
      confidence: d.confidence ?? "Medium",
      description: (d.description ?? "").trim(),
      file: sm?.filename_relative ?? sm?.filename_short ?? null,
      lines: sm?.lines ?? [],
    }
  })

  return { ok: true, findings }
}

/** Return the substring from the first balanced top-level `{...}` JSON object. */
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
