# Vigilo

Web3 Smart Contract Security Auditing Orchestrator - OpenCode Plugin

A comprehensive security auditing tool for smart contracts (Solidity, Vyper, Cairo), built as an OpenCode plugin. From Latin "to watch, guard" - Vigilo watches over your smart contracts to find vulnerabilities before attackers do.

## Features

- **Automated Audit Workflow**: Scope resolution → Recon → Deep Analysis → PoC → Report
- **Specialized Auditors**: Protocol-specific vulnerability detection
- **Multi-Language Support**: Solidity, Vyper, Cairo, Rust, Go
- **LSP Integration**: Language server support for smart contract languages
- **Foundry Integration**: Built-in tools for forge build/test/coverage
- **Parallel Analysis**: Spawn multiple auditors (max 3) for comprehensive coverage
- **PoC Validation**: Generate and validate Foundry tests

## Supported Languages

| Language | Extensions | LSP Server | Use Case |
|----------|------------|------------|----------|
| Solidity | `.sol` | `@nomicfoundation/solidity-language-server` | EVM chains |
| Vyper | `.vy` | `vyper-lsp` | Python-like EVM contracts |
| Cairo | `.cairo` | `cairo-language-server` (Scarb) | Starknet/StarkEx |
| Rust | `.rs` | `rust-analyzer` | Solana, NEAR, Substrate |
| Go | `.go` | `gopls` | Cosmos SDK |

## Installation

### Prerequisites

- [OpenCode](https://github.com/sst/opencode) installed
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js 18+ or Bun

### Install Plugin

```bash
# Clone and install
git clone <repo-url> vigilo
cd vigilo
npm install
npm run build

# Register with OpenCode
# Add to ~/.config/opencode/opencode.json:
{
  "plugin": ["file:///path/to/vigilo/dist/index.js"]
}
```

### Install LSP Servers (Optional)

```bash
# Solidity (recommended)
npm install -g @nomicfoundation/solidity-language-server

# Vyper
pipx install vyper-lsp

# Cairo (via Scarb)
curl https://get.swmansion.com | bash && starkup

# Rust (already included in rustup)
rustup component add rust-analyzer

# Go
go install golang.org/x/tools/gopls@latest
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `/audit` | Start full security audit workflow |
| `/poc <finding.md>` | Generate and validate PoC for a finding |

### Example

```bash
# Start OpenCode in your project
cd my-solidity-project
opencode

# Run full audit
/audit

# Generate PoC for a finding
/poc .vigilo/findings/high/H-01-reentrancy.md
```

## Audit Workflow

```
Phase 0        Phase 1           Phase 2          Phase 3    Phase 4
(scope)        (recon)           (audit)          (PoC)      (report)
   │              │                  │               │           │
   ▼              ▼                  ▼               ▼           ▼
 scope.txt ─→ code-analyzer ──┐
              docs-analyzer ──┼─→ recon/*.md ─→ sub-auditors ─→ findings/ ─→ PoC ─→ report
                              │                (max 3 parallel)
                              └─ protocol type detected
```

## Available Tools

### Foundry Tools

| Tool | Description |
|------|-------------|
| `forge_build` | Compile Solidity contracts |
| `forge_test` | Run tests with configurable verbosity |
| `forge_coverage` | Generate code coverage |
| `cast_call` | Query contract state |

### Agent Tools

| Tool | Description |
|------|-------------|
| `delegate_audit` | Spawn specialized auditors |
| `background_output` | Get background audit results |
| `background_cancel` | Cancel running audits |
| `background_list` | List all audit tasks |
| `skill` | Load specialized audit skills |

## Specialized Auditors

| Auditor | Focus |
|---------|-------|
| `reentrancy-auditor` | CEI violations, cross-function/contract reentrancy |
| `oracle-auditor` | Oracle manipulation, price feed attacks |
| `access-control-auditor` | Permission vulnerabilities |
| `logic-auditor` | Business logic errors |
| `flashloan-auditor` | Flash loan attack vectors |
| `defi-auditor` | DeFi-specific vulnerabilities |
| `cross-chain-auditor` | Bridge and cross-chain vulnerabilities |
| `token-auditor` | ERC20/721/1155 implementation issues |

## Directory Structure

```
.vigilo/
├── recon/           # Reconnaissance outputs
├── findings/        # Vulnerability findings
│   ├── high/
│   └── medium/
├── poc/             # PoC validation logs
└── reports/         # Final reports
```

## Configuration

Create `.vigilo/config.json` in your project:

```json
{
  "categories": {
    "deep-audit": {
      "model": "anthropic/claude-opus-4-5",
      "description": "Deep security analysis"
    }
  },
  "disabled_skills": [],
  "disabled_agents": []
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VIGILO_DEBUG` | Enable debug logging |
| `DEBUG` | General debug mode |

## License

MIT
