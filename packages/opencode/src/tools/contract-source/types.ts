export interface FetchContractSourceArgs {
  /** Deployed contract address (0x…). */
  address: string
  /** EVM chain id (default 1 = Ethereum mainnet). */
  chain_id?: number
  /** Override the explorer API base (default Etherscan v2 multichain endpoint). */
  api_url?: string
  /** Explorer API key (falls back to ETHERSCAN_API_KEY). */
  api_key?: string
}

export interface ContractSourceFile {
  path: string
  content: string
}

export interface ParsedContractSource {
  ok: boolean
  /** True when the explorer returned verified source for the address. */
  verified: boolean
  name?: string
  compiler?: string
  /** Whether the contract is a known proxy (implementation should also be fetched). */
  proxy?: boolean
  implementation?: string | null
  files: ContractSourceFile[]
  error?: string
}
