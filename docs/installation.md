# Installation Guide

## Prerequisites

- **Node.js** v18+ (for OpenCode plugin)
- **Foundry** (for PoC testing) - [Installation](https://book.getfoundry.sh/getting-started/installation)

## Claude Code

### Via Plugin Marketplace (Recommended)

```bash
# Register the marketplace
/plugin marketplace add PurpleAILAB/Vigilo

# Install the plugin
/plugin install vigilo
```

### Manual Installation

1. Clone this repository
2. Navigate to `packages/claude`
3. Follow Claude Code plugin installation instructions

## OpenCode

### From Source

```bash
# Clone repository
git clone https://github.com/PurpleAILAB/vigilo.git
cd vigilo/packages/opencode

# Install dependencies
npm install

# Build
npm run build
```

### Configure OpenCode

Add to your OpenCode config (`~/.config/opencode/opencode.json` or project's `opencode.json`):

```json
{
  "plugin": ["file:///absolute/path/to/vigilo/packages/opencode/dist/index.js"]
}
```

### Per-Project Configuration

Create `.opencode/vigilo.json` in your project:

```json
{
  "auditors": {
    "vigilo": { "model": "anthropic/claude-opus-4-5" },
    "explorator": { "model": "anthropic/claude-sonnet-4-5" },
    "speculator": { "model": "anthropic/claude-sonnet-4-5" },
    "reentrancy-auditor": { "model": "anthropic/claude-sonnet-4-5" }
  }
}
```

## LSP Servers (Optional)

For enhanced code analysis:

| Language | Server | Install |
|----------|--------|---------|
| Solidity | `nomicfoundation-solidity-language-server` | `npm i -g @nomicfoundation/solidity-language-server` |
| Rust | `rust-analyzer` | `rustup component add rust-analyzer` |
| Cairo | `scarb` | [Scarb Installation](https://docs.swmansion.com/scarb/) |

### Quick Install Scripts

**Windows:**
```powershell
cd packages/claude
.\lsp_install.ps1
```

**Linux/macOS:**
```bash
cd packages/claude
./lsp_install.sh
```
