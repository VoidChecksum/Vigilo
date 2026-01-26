<p align="center">
  <img src="assets/logo.png" alt="Vigilo" height="128">
</p>

<h1 align="center">Vigilo</h1>

<p align="center">
  <strong>Web3 Smart Contract Security Auditing Agent</strong>
</p>

<p align="center">
  From Latin "to watch, guard" - Vigilo watches over your smart contracts to find vulnerabilities before attackers do.
</p>

---

## Platforms

Vigilo is available for multiple AI coding assistants:

| Platform | Package | Status | Recommended |
|----------|---------|--------|-------------|
| [OpenCode](https://github.com/sst/opencode) | [`packages/opencode`](./packages/opencode) | Stable | ⭐ **Recommended** |
| [Claude Code](https://claude.ai/code) | [`packages/claude`](./packages/claude) | Stable | |

> **Why OpenCode?** OpenCode provides more flexibility with model selection, better plugin extensibility, and cost-effective auditing with configurable model tiers per auditor.

## Features

- **Automated Audit Workflow**: Scope resolution → Recon → Deep Analysis → PoC → Report
- **Specialized Auditors**: Protocol-specific vulnerability detection (reentrancy, oracle, access-control, etc.)
- **Multi-Language Support**: Solidity, Vyper, Cairo, Rust
- **LSP Integration**: Language server support for smart contract languages
- **Foundry Integration**: Built-in tools for forge build/test/coverage
- **Parallel Analysis**: Spawn multiple auditors for comprehensive coverage
- **PoC Validation**: Generate and validate Foundry tests

## Quick Start

### Claude Code

```bash
# Register marketplace
/plugin marketplace add PurpleAILAB/Vigilo

# Install
/plugin install vigilo
```

### OpenCode

```bash
# Clone repository
git clone https://github.com/PurpleAILAB/vigilo.git
cd vigilo/packages/opencode

# Install and build
npm install
npm run build

# Add to ~/.config/opencode/opencode.json
{
  "plugin": ["file:///path/to/vigilo/packages/opencode/dist/index.js"]
}
```

## Usage

```bash
# Run full security audit
/audit

# Generate PoC from attack scenario
/poc .vigilo/findings/high/H-01-reentrancy.md
```

## Audit Workflow

```
Phase 0        Phase 1           Phase 2          Phase 3    Phase 4
(scope)        (recon)           (audit)          (PoC)      (report)
   │              │                  │               │           │
   ▼              ▼                  ▼               ▼           ▼
 scope.txt ─→ code-analyzer ──┐
              docs-analyzer ──┼─→ recon/*.md ─→ auditors ─→ findings/ ─→ PoC ─→ report
                              │                (parallel)
                              └─ protocol type detected
```

## Directory Structure (Generated)

```
.vigilo/
├── recon/           # Reconnaissance outputs
├── findings/        # Vulnerability findings
│   ├── high/
│   └── medium/
├── poc/             # PoC validation logs
└── reports/         # Final reports
```

## Documentation

- [Installation Guide](./docs/installation.md)
- [Usage Guide](./docs/usage.md)
- [Claude Plugin](./packages/claude/README.md)
- [OpenCode Plugin](./packages/opencode/README.md)

## License

This project is licensed under the [Business Source License 1.1](LICENSE).

- **Non-production use**: Free (personal, educational, research, non-commercial security auditing)
- **Production use**: Requires commercial license
- **Change Date**: 2029-01-21 (converts to Apache-2.0)

Commercial licensing: catower917@gmail.com
