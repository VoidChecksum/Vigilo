import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { log } from "../../shared"
import { parseEtherscanResponse, sanitize } from "./utils"
import {
  FETCH_CONTRACT_SOURCE_DESCRIPTION,
  DEFAULT_EXPLORER_API,
  DEFAULT_CHAIN_ID,
  FETCH_TIMEOUT_MS,
  buildGetSourceUrl,
  isAddress,
  validateExplorerApi,
} from "./constants"

export const fetch_contract_source: ToolDefinition = tool({
  description: FETCH_CONTRACT_SOURCE_DESCRIPTION,
  args: {
    address: tool.schema.string().describe("Deployed contract address (0x…)."),
    chain_id: tool.schema.number().optional().describe(`EVM chain id (default ${DEFAULT_CHAIN_ID} = mainnet).`),
    api_url: tool.schema.string().optional().describe("Override explorer API base (default Etherscan v2)."),
    api_key: tool.schema.string().optional().describe("Explorer API key (falls back to ETHERSCAN_API_KEY)."),
  },
  async execute(args, context) {
    log("fetch_contract_source", { address: args.address, chain_id: args.chain_id })

    if (!isAddress(args.address)) {
      return `Invalid address "${args.address}" — expected a 0x-prefixed 40-hex-char address.`
    }
    const apiKey = args.api_key ?? process.env.ETHERSCAN_API_KEY ?? ""
    if (!apiKey) {
      return "No explorer API key. Set ETHERSCAN_API_KEY or pass api_key."
    }

    const cwd = ((context ?? {}) as { directory?: string }).directory ?? process.cwd()
    // The API key is attached to this request, so never fetch an arbitrary host
    // (SSRF / key leak). Require https on a known explorer before building the URL.
    const apiBase = args.api_url ?? DEFAULT_EXPLORER_API
    if (!validateExplorerApi(apiBase)) {
      return `Refusing to use explorer API "${apiBase}" — it must be https on a known explorer host. Extend ALLOWED_EXPLORER_HOSTS to add one.`
    }
    const url = buildGetSourceUrl(apiBase, args.chain_id ?? DEFAULT_CHAIN_ID, args.address, apiKey)

    let raw: string
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) return `Explorer request failed: HTTP ${res.status} ${res.statusText}`
      raw = await res.text()
    } catch (e) {
      return `Explorer request error: ${e instanceof Error ? e.message : String(e)}`
    }

    const parsed = parseEtherscanResponse(raw)
    if (!parsed.ok && parsed.files.length === 0) {
      if (parsed.verified === false && parsed.error?.includes("not verified")) {
        return `Contract ${args.address} is NOT verified on the explorer — no source to audit.`
      }
      return `Could not fetch source for ${args.address}: ${parsed.error ?? "unknown error"}`
    }

    // Write the (untrusted) source into the workspace for analysis.
    const outDir = join(cwd, ".vigilo", "sources", args.address.toLowerCase())
    let written = 0
    for (const f of parsed.files) {
      const dest = join(outDir, sanitize(f.path))
      try {
        mkdirSync(dirname(dest), { recursive: true })
        writeFileSync(dest, f.content)
        written++
      } catch (e) {
        log("fetch_contract_source: write failed", { path: f.path, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const lines = [
      `Fetched ${parsed.name ?? "contract"} (${args.address})`,
      parsed.compiler ? `Compiler: ${parsed.compiler}` : null,
      `Wrote ${written} file(s) to .vigilo/sources/${args.address.toLowerCase()}/`,
      parsed.proxy ? `⚠️ Proxy detected${parsed.implementation ? ` — fetch the implementation too: ${parsed.implementation}` : ""}.` : null,
      "",
      "Files:",
      ...parsed.files.map((f) => `  - ${sanitize(f.path)}`),
    ].filter(Boolean)
    return lines.join("\n")
  },
})

export const contractSourceTools: Record<string, ToolDefinition> = { fetch_contract_source }
