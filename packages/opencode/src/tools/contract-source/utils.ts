import type { ContractSourceFile, ParsedContractSource } from "./types"

interface EtherscanResult {
  SourceCode?: string
  ABI?: string
  ContractName?: string
  CompilerVersion?: string
  Proxy?: string
  Implementation?: string
}

interface EtherscanResponse {
  status?: string
  message?: string
  result?: EtherscanResult[] | string
}

/**
 * Parse an Etherscan-compatible `getsourcecode` response into normalized source files.
 *
 * The `SourceCode` field has three documented shapes:
 *  1. Plain Solidity (single file).
 *  2. A standard-JSON-input object wrapped in DOUBLE braces `{{ ... }}` (Etherscan quirk)
 *     with a `sources` map of `path -> { content }`.
 *  3. A single-brace JSON object mapping `path -> { content }` (older multi-file form).
 */
export function parseEtherscanResponse(raw: string): ParsedContractSource {
  let resp: EtherscanResponse
  try {
    resp = JSON.parse(raw) as EtherscanResponse
  } catch (e) {
    return { ok: false, verified: false, files: [], error: `Invalid explorer JSON: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (typeof resp.result === "string") {
    // Etherscan returns an error message as a string result (e.g. rate limit / bad key).
    return { ok: false, verified: false, files: [], error: resp.result }
  }
  const result = resp.result?.[0]
  if (!result) {
    return { ok: false, verified: false, files: [], error: resp.message || "Empty explorer result" }
  }

  const sourceCode = (result.SourceCode ?? "").trim()
  const name = result.ContractName || undefined
  const compiler = result.CompilerVersion || undefined
  const proxy = result.Proxy === "1"
  const implementation = result.Implementation && /^0x[0-9a-fA-F]{40}$/.test(result.Implementation) ? result.Implementation : null

  if (!sourceCode) {
    return { ok: true, verified: false, name, compiler, proxy, implementation, files: [], error: "Contract source is not verified on the explorer" }
  }

  const files = parseSourceCodeField(sourceCode, name ?? "Contract")
  return { ok: files.length > 0, verified: files.length > 0, name, compiler, proxy, implementation, files }
}

/** Parse the `SourceCode` field into files (handles all three shapes above). */
export function parseSourceCodeField(sourceCode: string, contractName: string): ContractSourceFile[] {
  const trimmed = sourceCode.trim()

  // Shape 2: double-brace-wrapped standard JSON input.
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    const inner = trimmed.slice(1, -1) // strip ONE outer brace layer
    const files = filesFromJson(inner)
    if (files) return files
  }

  // Shape 3: single-brace JSON (standard-input or a bare path->{content} map).
  if (trimmed.startsWith("{")) {
    const files = filesFromJson(trimmed)
    if (files) return files
  }

  // Shape 1: plain single-file source.
  return [{ path: `${sanitize(contractName)}.sol`, content: sourceCode }]
}

function filesFromJson(json: string): ContractSourceFile[] | null {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  // Standard JSON input: { language, sources: { path: { content } }, settings }
  const sources = (obj.sources ?? obj) as Record<string, unknown>
  const files: ContractSourceFile[] = []
  for (const [path, value] of Object.entries(sources)) {
    if (path === "language" || path === "settings") continue
    const content =
      value && typeof value === "object" && "content" in value
        ? String((value as { content: unknown }).content ?? "")
        : typeof value === "string"
          ? value
          : null
    if (content !== null) files.push({ path: sanitize(path), content })
  }
  return files.length > 0 ? files : null
}

/** Keep relative source paths but strip any traversal/absolute components. */
export function sanitize(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/") || "Contract.sol"
}
