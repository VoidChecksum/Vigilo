# Contributing to Vigilo

Thanks for your interest in improving **Vigilo — Web3 Smart Contract Security Auditing Agent**.
This guide explains how to set up your environment, the conventions we follow, and how to get
your changes merged.

> 🔐 Found a security issue? **Do not open a public issue.** Follow the process in
> [SECURITY.md](./SECURITY.md) instead.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Testing & Quality Gates](#testing--quality-gates)
- [Commit Conventions](#commit-conventions)
- [Code Conventions](#code-conventions)
- [Authoring Skills](#authoring-skills)
- [Pull Request Process](#pull-request-process)
- [Working with AI Assistants](#working-with-ai-assistants)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | **22+** | Runtime for tooling and `postinstall` scripts |
| [Bun](https://bun.sh) | latest | Primary package manager, test runner, and bundler |
| [Foundry](https://getfoundry.sh) | latest | `forge build` / `forge test` for PoC validation |
| [Semgrep](https://semgrep.dev) | latest | Optional — run the Solidity ruleset locally (`make semgrep`) |

Install Foundry with:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

---

## Project Structure

Vigilo is a monorepo. Each package is independently versioned and published.

```
Vigilo/
├── packages/
│   ├── opencode/     # Main plugin (npm: vigilo) — OpenCode plugin + CLI
│   │   ├── src/      # TypeScript source (plugin handlers, agents, tools, MCP, CLI)
│   │   ├── skills/   # Auditor skill packs (Markdown SKILL.md files)
│   │   ├── bin/      # CLI entrypoints
│   │   └── docs/     # Installation guide
│   ├── claude/       # Claude Code plugin distribution (agents, skills, commands)
│   └── bench/        # Benchmark suite (npm: vigilo-bench) — scores audits vs ground truth
├── tests/            # Cross-package fixtures (e.g. Semgrep rule fixtures)
├── docs/             # Architecture & methodology docs
└── findings/         # Published real-world audit findings
```

- **`packages/opencode`** — the heart of Vigilo: the OpenCode plugin, agent
  orchestration, tools, MCP integrations, and the `vigilo` CLI.
- **`packages/claude`** — the Claude Code plugin packaging (agents, skills, commands,
  LSP install scripts).
- **`packages/bench`** — the `vigilo-bench` pipeline that measures audit accuracy
  against verified reports from Code4rena, Sherlock, and Cantina.

---

## Development Setup

```bash
# 1. Clone
git clone https://github.com/PurpleAILAB/Vigilo.git
cd Vigilo

# 2. Install the main plugin package
cd packages/opencode
bun install

# 3. Run watch mode (rebuilds dist/ on change)
bun run dev
```

To test your local build inside OpenCode, point your `~/.config/opencode/opencode.json`
at the local checkout:

```json
{
  "plugin": [
    "/absolute/path/to/Vigilo/packages/opencode"
  ]
}
```

Restart OpenCode to load changes. When you're done developing, restore the published
plugin with `bunx vigilo install`.

For the benchmark package:

```bash
cd packages/bench
bun install
bun run dev   # runs src/cli.ts directly
```

---

## Testing & Quality Gates

Run these from the relevant package directory **before opening a PR**:

```bash
bun test          # unit tests
bun run typecheck # tsc --noEmit
bun run build     # ensure the bundle builds cleanly
```

CI runs `bun run typecheck` for both `packages/opencode` and `packages/bench` on every
push (see `.github/workflows`). PRs that don't typecheck will not be merged.

- Add or update tests for any behavior you change.
- Test **behavior**, not implementation details. Don't assert on default config values
  or string contents that aren't part of the contract.
- Never disable, skip, or weaken a test to make a build pass.

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config, or housekeeping |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `ci` | CI/CD configuration |

**Examples:**

```
feat(oracle-auditor): detect stale Chainlink price feeds
fix(cli): resolve doctor crash when Foundry is missing
docs: clarify skills authoring frontmatter
chore(deps): bump zod to 3.24.4
```

> The release workflow filters out `chore:`, `ci:`, `test:`, and `release:` commits from
> auto-generated release notes, so user-facing changes belong under `feat`/`fix`/`docs`.

---

## Code Conventions

- **Language:** TypeScript (ESM, `"type": "module"`). Target the existing `tsconfig.json`
  settings — do not introduce new compiler relaxations.
- **Schemas & validation:** Use [Zod](https://zod.dev) for all runtime schema definitions
  and input validation. Reuse existing schemas rather than re-declaring shapes.
- **Plugin API:** Build against the [OpenCode plugin API](https://github.com/anomalyco/opencode)
  (`@opencode-ai/plugin`, `@opencode-ai/sdk`). These are peer dependencies — do not bundle them.
- **Surgical changes:** Touch only what the change requires. Match surrounding style; don't
  reformat or refactor unrelated code in the same PR.
- **No new conventions:** If a pattern already exists in the codebase, follow it. Don't add
  a second way of doing the same thing.

---

## Authoring Skills

Skills are Vigilo's detection knowledge base. Each skill is a **Markdown file** (`SKILL.md`)
in `packages/opencode/skills/<skill-name>/` (and mirrored in `packages/claude/skills/`).

A skill begins with YAML frontmatter:

```markdown
---
name: reentrancy
description: >
  Auto-loaded by reentrancy-auditor agent during Phase 2.
  Provides detection patterns for: CEI violations, cross-function/cross-contract
  reentrancy, read-only reentrancy, token callback exploits.
  Core artifact: State Timeline map.
user-invocable: false
---

# Reentrancy Vulnerability Analysis

... detection patterns, root causes, code examples, and checklists ...
```

Guidelines:

- **`name`** must match the directory name.
- **`description`** should state which agent loads the skill, which patterns it covers, and
  the core artifact it produces. This is what the orchestrator reads to route work.
- **`user-invocable`** — set `false` for skills auto-loaded by auditor agents, `true` for
  user-facing commands.
- Keep content **domain-specific** to smart contract security: real root causes, vulnerable
  vs. fixed Solidity/Vyper/Cairo examples, and an actionable checklist.
- Cite standards where relevant (e.g. OWASP Smart Contract Top 10, SWC registry) and
  reference real-world incidents to ground severity.

When adding a new skill, place it under both `packages/opencode/skills/` and
`packages/claude/skills/` so both distributions stay in sync.

---

## Pull Request Process

1. **Fork & branch.** Create a topic branch from `main`
   (e.g. `feat/oracle-staleness-check`).
2. **Make your change.** Keep PRs focused — one logical change per PR.
3. **Pass the gates.** Run `bun test`, `bun run typecheck`, and `bun run build` locally.
4. **Write a clear PR.** Fill in the
   [pull request template](./.github/pull_request_template.md): what changed, why, and how
   you verified it.
5. **Link issues.** Reference any related issue with `Closes #123`.
6. **Review.** A maintainer will review; address feedback with additional commits (don't
   force-push over review history unless asked).
7. **Merge.** Maintainers squash-merge once CI is green and the change is approved.

For larger or design-affecting changes, open an issue first to discuss the approach before
investing significant effort.

---

## Working with AI Assistants

Vigilo is AI-friendly and partly AI-authored — that's expected and welcome. If you use an
AI coding assistant:

- **You own the diff.** Review every generated line; you are responsible for correctness,
  security, and licensing of what you submit.
- **Keep it focused.** Don't let an assistant balloon a small fix into a sweeping refactor.
- **Verify, don't trust.** Run the tests and typecheck — generated code that "looks right"
  still needs the same gates as hand-written code.
- **Respect the conventions above.** Generated commits, code, and skills must follow the
  same standards as any other contribution.

---

Thanks again for contributing. Questions? Open a
[discussion or issue](https://github.com/PurpleAILAB/Vigilo/issues).
