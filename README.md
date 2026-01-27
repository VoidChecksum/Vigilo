<p align="center">
  <img src="assets/logo.png" alt="Vigilo">
</p>

<h1 align="center">Vigilo</h1>

<p align="center">
  <strong>Web3 Smart Contract Security Auditing Agent</strong>
</p>

<p align="center">
  From Latin "to watch, guard" — Vigilo watches over your smart contracts to find vulnerabilities before attackers do.
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/vigilo?color=cb3837&labelColor=black&logo=npm&style=flat-square)](https://www.npmjs.com/package/vigilo)
[![GitHub Release](https://img.shields.io/github/v/release/PurpleAILAB/Vigilo?color=369eff&labelColor=black&logo=github&style=flat-square)](https://github.com/PurpleAILAB/Vigilo/releases)
[![GitHub Stars](https://img.shields.io/github/stars/PurpleAILAB/Vigilo?color=ffcb47&labelColor=black&style=flat-square)](https://github.com/PurpleAILAB/Vigilo/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/PurpleAILAB/Vigilo?color=ff80eb&labelColor=black&style=flat-square)](https://github.com/PurpleAILAB/Vigilo/issues)
[![License](https://img.shields.io/badge/license-BSL--1.1-white?labelColor=black&style=flat-square)](https://github.com/PurpleAILAB/Vigilo/blob/main/LICENSE)

</div>

---

## What is Vigilo?

Vigilo is an AI-powered smart contract security auditor that runs inside [OpenCode](https://github.com/anomalyco/opencode). It spawns specialized auditors in parallel to find vulnerabilities and generate validated PoCs.

---

## Installation

### OpenCode

### For LLM Agents (Recommended)

Paste this into your LLM agent session:

```
Install and configure vigilo by following the instructions here:
https://raw.githubusercontent.com/PurpleAILAB/Vigilo/main/packages/opencode/docs/installation.md
```

### Manual Install

```bash
bunx vigilo install
```

### Claude Code

```bash
/plugin marketplace add PurpleAILAB/Vigilo
/plugin install vigilo@Vigilo
```

---

See the full [Installation Guide](./packages/opencode/docs/installation.md) for more options.

### Uninstallation

1. Remove the plugin from your OpenCode config:

```bash
# Edit ~/.config/opencode/opencode.json and remove "vigilo" from the plugin array
```

2. Remove configuration files:

```bash
rm -f ~/.config/opencode/vigilo.json
```

3. Verify removal:

```bash
opencode --version
```

---

## Features

- **Automated Audit Workflow**: Scope → Recon → Deep Analysis → PoC → Report
- **Specialized Auditors**: Reentrancy, Oracle, Access Control, Flashloan, Logic, DeFi, Token, Cross-Chain
- **Multi-Language Support**: Solidity, Vyper, Cairo, Rust
- **Foundry Integration**: `forge build`, `forge test`, `forge coverage`
- **LSP Integration**: Goto-definition, references, diagnostics
- **Parallel Analysis**: Multiple auditors running concurrently
- **PoC Validation**: Auto-generate and validate Foundry tests

---

## Usage

```bash
cd my-solidity-project
opencode

# Start audit
/audit

# Generate PoC
/poc .vigilo/findings/high/H-01-reentrancy.md
```

---

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

---

## Platforms

| Platform | Package | Status |
|----------|---------|--------|
| [OpenCode](https://github.com/anomalyco/opencode) | [`packages/opencode`](./packages/opencode) | ⭐ **Recommended** |
| [Claude Code](https://claude.ai/code) | [`packages/claude`](./packages/claude) | Stable |

> **Why OpenCode?** More flexibility with model selection, better plugin extensibility, and cost-effective auditing with configurable models per auditor.

---

## Troubleshooting

```bash
bunx vigilo doctor
bunx vigilo doctor --verbose
```

| Issue | Solution |
|-------|----------|
| OpenCode not found | Install from https://opencode.ai/docs |
| Foundry not found | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Vigilo not registered | Run `bunx vigilo install` again |

---

## License

[Business Source License 1.1](LICENSE)

- **Non-production use**: Free
- **Production use**: Requires commercial license
- **Change Date**: 2029-01-21 (converts to Apache-2.0)

Commercial licensing: catower917@gmail.com

---

<div align="center">

**Ready to hunt bugs? 🔍**

[Get Started](./packages/opencode/docs/installation.md) · [Report Bug](https://github.com/PurpleAILAB/Vigilo/issues) · [Request Feature](https://github.com/PurpleAILAB/Vigilo/issues)

</div>
