# Getting Started

Run your first smart contract audit with Vigilo in under ten minutes. This guide takes you from a clean machine to a finished findings report and a validated proof-of-concept.

> New to Vigilo? It is an autonomous security legion that deploys specialized auditor agents in parallel to find vulnerabilities in your contracts. See the [Architecture](./architecture.md) overview for the full picture.

---

## Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| **Node.js 22+** | Runtime for the OpenCode plugin and CLI | [nodejs.org](https://nodejs.org) |
| **Bun** | Fast package manager and script runner (`bunx vigilo …`) | `curl -fsSL https://bun.sh/install \| bash` |
| **Foundry** | Compiles and runs generated PoC tests (`forge build`, `forge test`) | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| **An LLM API key** | At least one provider key (Anthropic, OpenAI, Google, …), configured through OpenCode | See [Models](./models.md) |

Confirm your toolchain before continuing:

```bash
node --version    # v22 or newer
bun --version
forge --version
```

---

## Installation

Vigilo runs on **[OpenCode](https://github.com/anomalyco/opencode)** (recommended) and **[Claude Code](https://claude.ai/code)**. Pick the path that matches your agent.

### OpenCode (recommended)

```bash
bunx vigilo install
```

This registers the plugin in `~/.config/opencode/opencode.json` and creates the default configuration. Verify the install:

```bash
bunx vigilo doctor
```

### Claude Code

```bash
# Register the marketplace, then install the plugin
/plugin marketplace add PurpleAILAB/Vigilo
/plugin install vigilo@vigilo
```

### LLM Agent install

If you are driving another LLM agent, paste this into its session and let it install Vigilo for you:

```
Install and configure vigilo by following the instructions here:
https://raw.githubusercontent.com/PurpleAILAB/Vigilo/main/packages/opencode/docs/installation.md
```

> For source builds, per-project plugin paths, and development mode, see the full [Installation Guide](./installation.md).

---

## Your First Audit

With Vigilo installed and at least one API key configured, point it at any Solidity project.

### 1. Enter your project

```bash
cd my-solidity-project
```

Vigilo audits the contracts in the current working directory. Foundry and Hardhat layouts are both supported.

### 2. Start OpenCode

```bash
opencode
```

### 3. Run the audit

Inside the OpenCode session:

```
/audit
```

Vigilo deploys the full legion: **Quaestor** scopes the engagement, **Explorator** and **Speculator** run reconnaissance over the code and the docs, and the **Centuriones** — eight specialist auditors (reentrancy, oracle, access-control, flashloan, logic, defi, cross-chain, token) — run deep analysis in parallel. The pipeline follows five phases:

```
Scope → Recon → Deep Analysis → PoC → Report
```

### 4. Review the findings

Results are written under `.vigilo/` in your project, sorted by severity:

```
.vigilo/
├── recon/           # Explorator & Speculator outputs
├── findings/        # Vulnerability findings, by severity
│   ├── high/
│   ├── medium/
│   └── low/
├── poc/             # PoC validation logs
└── reports/         # Final submission-ready reports
```

Open the high-severity findings first:

```bash
ls .vigilo/findings/high/
```

### 5. Generate a proof-of-concept

Validate a finding by generating a runnable Foundry exploit test:

```
/poc .vigilo/findings/high/H-01-something.md
```

Vigilo writes the test, runs it with Foundry, and records the outcome in `.vigilo/poc/`. A passing PoC promotes the finding to the strongest evidence type — `POC_VALIDATED` — in the file-based [attack-chain reasoning](./knowledge-graph.md).

---

## Configuration

Model and provider selection is **OpenCode-native** — credentials and custom providers are configured through OpenCode itself, not through Vigilo. Every agent runs on a built-in default model (`anthropic/claude-sonnet-4-5`) unless you override it.

To change the model (or other settings) for a specific agent, add an `auditors` section to `vigilo.json`. The global file lives at `~/.config/opencode/vigilo.json`; per-project overrides can live in `.opencode/vigilo.json` at the root of the audited repository.

```json
{
  "auditors": {
    "vigilo":             { "model": "anthropic/claude-opus-4-5" },
    "explorator":         { "model": "anthropic/claude-sonnet-4-5" },
    "speculator":         { "model": "anthropic/claude-sonnet-4-5" },
    "reentrancy-auditor": { "model": "anthropic/claude-sonnet-4-5", "temperature": 0.1 }
  }
}
```

- **`auditors`** — overrides settings for a specific agent. Each entry accepts `model`, `temperature`, `top_p`, `prompt`, `prompt_append`, `tools`, `disable`, and a few more (validated by `AuditorOverrideConfigSchema` in `packages/opencode/src/config/schema.ts`).
- Any agent not listed keeps its built-in default model (`anthropic/claude-sonnet-4-5`).

There is no tier system and no model profiles — each agent simply has a `model` you can change. See [Models](./models.md) for the full override reference and [Agents](./agents.md) for the complete roster of auditors and support agents.

---

## Next Steps

- **[Installation Guide](./installation.md)** — source builds, dev mode, LSP servers, uninstall.
- **[Architecture](./architecture.md)** — the OpenCode-hosted pipeline, evidence hierarchy, and data flow.
- **[Models](./models.md)** — OpenCode-native providers and per-auditor overrides.
- **[Agents](./agents.md)** — the full legion and what each agent does.
- **[Knowledge Graph](./knowledge-graph.md)** — file-based `.vigilo/` attack-chain reasoning over findings, contracts, and assets.

---

## Troubleshooting

```bash
bunx vigilo doctor --verbose
```

| Issue | Solution |
|-------|----------|
| OpenCode not found | Install from <https://github.com/anomalyco/opencode> |
| Foundry not found | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Vigilo not registered | Run `bunx vigilo install` again |
| No API key detected | Configure a provider key in OpenCode (its config or your shell env) — see [Models](./models.md) |
