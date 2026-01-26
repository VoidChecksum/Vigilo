import type { LSPServerConfig } from "./types"

export const SYMBOL_KIND_MAP: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
}

export const SEVERITY_MAP: Record<number, string> = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint",
}

export const DEFAULT_MAX_REFERENCES = 200
export const DEFAULT_MAX_SYMBOLS = 200
export const DEFAULT_MAX_DIAGNOSTICS = 200

export const LSP_INSTALL_HINTS: Record<string, string> = {
  solidity: "npm install -g @nomicfoundation/solidity-language-server",
  "solidity-solc": "npm install -g solc (then use 'solc --lsp')",
  vyper: "pipx install vyper-lsp",
  cairo: "Install Scarb: curl https://get.swmansion.com | bash && starkup",
  rust: "rustup component add rust-analyzer",
  gopls: "go install golang.org/x/tools/gopls@latest",
  move: "Install Aptos CLI with Move analyzer",
  typescript: "npm install -g typescript-language-server typescript",
  python: "pip install basedpyright",
}

export const BUILTIN_SERVERS: Record<string, Omit<LSPServerConfig, "id">> = {
  solidity: {
    command: ["nomicfoundation-solidity-language-server", "--stdio"],
    extensions: [".sol"],
  },
  "solidity-solc": {
    command: ["solc", "--lsp"],
    extensions: [".sol"],
  },
  vyper: {
    command: ["vyper-lsp"],
    extensions: [".vy", ".vyper"],
  },
  cairo: {
    command: ["scarb", "cairo-language-server"],
    extensions: [".cairo"],
  },
  rust: {
    command: ["rust-analyzer"],
    extensions: [".rs"],
  },
  gopls: {
    command: ["gopls"],
    extensions: [".go"],
  },
  move: {
    command: ["move-analyzer"],
    extensions: [".move"],
  },
  typescript: {
    command: ["typescript-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  },
  python: {
    command: ["basedpyright-langserver", "--stdio"],
    extensions: [".py", ".pyi"],
  },
}

export const EXT_TO_LANG: Record<string, string> = {
  ".sol": "solidity",
  ".vy": "vyper",
  ".vyper": "vyper",
  ".cairo": "cairo",
  ".rs": "rust",
  ".go": "go",
  ".move": "move",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".json": "json",
  ".toml": "toml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
}

export const WEB3_EXTENSIONS = [".sol", ".vy", ".vyper", ".cairo", ".move"]

export const WEB3_PROJECT_MARKERS = {
  foundry: ["foundry.toml", "forge.lock"],
  hardhat: ["hardhat.config.js", "hardhat.config.ts"],
  truffle: ["truffle-config.js", "truffle.js"],
  brownie: ["brownie-config.yaml"],
  ape: ["ape-config.yaml"],
  scarb: ["Scarb.toml"],
  anchor: ["Anchor.toml"],
  move: ["Move.toml"],
}
