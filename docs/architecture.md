# Vigilo Architecture

## Overview

Vigilo is a multi-stage smart-contract security **audit** pipeline that runs as a plugin
inside [OpenCode](https://opencode.ai). It orchestrates a set of specialist agents
through reconnaissance, deep analysis, PoC-based verification, and reporting — optimized
for detection accuracy, false-positive neutralization, and reproducible evidence.

Two design facts shape everything below:

- **Persistence is file-based.** All audit state lives in a `.vigilo/` workspace as
  Markdown and Solidity files. There is no database. See
  [Attack-Chain Reasoning & the `.vigilo/` Workspace](./knowledge-graph.md).
- **Models are OpenCode-native.** Provider/credential configuration is handled by
  OpenCode; Vigilo adds optional per-auditor overrides via `vigilo.json`. See
  [Models](./models.md).

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            OpenCode host                              │
│                                                                       │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │  Vigilo (orch.) │   │ Specialist agents │   │ QA agents         │   │
│  │  - delegates    │   │ - reentrancy      │   │ - validator       │   │
│  │  - verifies     │   │ - oracle          │   │ - verifier        │   │
│  │  - reports      │   │ - access-control… │   │ - triage / purifier│  │
│  └─────────────────┘   └──────────────────┘   └──────────────────┘   │
│            │                     │                      │             │
│            └─────────────────────┼──────────────────────┘            │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Sandboxed command runner (shared/exec/runner.ts)            │    │
│  │  cwd-pinned · timeout · output cap · scrubbed env · no shell │    │
│  │  forge · cast · ast-grep · slither · …                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                  │                                    │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  .vigilo/  workspace (files: recon, findings, poc, graph,    │    │
│  │  reports)  +  test/poc/*.t.sol                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Agent Layer

Vigilo is the primary orchestrator; it delegates analysis to stateless specialist
auditors and quality-assurance agents and coordinates them through the `.vigilo/notepad/`
shared memory.

```
┌─────────────────────────────────────────────────────────────────┐
│                            AGENTS                                  │
├─────────────────────────────────────────────────────────────────┤
│  Orchestration:  vigilo (primary)                                 │
│  Recon:          explorator (code)    speculator (docs)           │
│  Planning:       quaestor (pre-audit scoping)                     │
│  Build:          faber (forge install / build)                    │
│  Specialists:    reentrancy · oracle · access-control · flashloan │
│                  · logic · defi · cross-chain · token             │
│  QA:             validator → verifier → triage → purifier         │
│  Analysis:       graph-builder (attack-chain reasoning)           │
└─────────────────────────────────────────────────────────────────┘
```

See [Agents](./agents.md) for what each one does.

### 2. Evidence Hierarchy

Every finding declares an evidence type, which caps the severity it is allowed to claim.
This is the backbone of Vigilo's "no confirmation without verification" rule.

| Evidence Type | What It Means | Max Severity |
|---|---|---|
| `POC_VALIDATED` | `forge test` passes with assertions proving impact | Critical, High |
| `STATIC_CONFIRMED` | Code pattern matched + call path verified | High, Medium |
| `TRACE_CONFIRMED` | Reachability proven via LSP / manual trace | Medium |
| `THEORETICAL` | Logic argument only, no code proof | Low, Informational |

`VERIFIED` findings (passing PoC) are written to `.vigilo/findings/`; `THEORETICAL`
findings go to `.vigilo/unverified/`. A High/Critical finding **must** be
`POC_VALIDATED` or `STATIC_CONFIRMED`.

### 3. Model Configuration

Vigilo does not implement its own provider abstraction, tier system, or fallback chain.
Each agent is created with a single `model` string and resolves it as:

1. **Per-auditor override** in `vigilo.json` (validated by `AuditorOverrideConfigSchema`
   in `packages/opencode/src/config/schema.ts`).
2. The agent's **built-in default model** (most specialists share `DEFAULT_MODEL =
   anthropic/claude-sonnet-4-5`).

Provider credentials and custom providers are configured through OpenCode itself. Full
details in [Models](./models.md).

### 4. Attack-Chain Reasoning (file-based)

The `graph-builder` agent reasons about contract call structure and how findings chain
into multi-step exploits, then writes the result to disk as Markdown summaries and
diagram files (Mermaid / Graphviz) under `.vigilo/graph/`. The graph is a **conceptual
model applied over the file artifacts** — there is no graph database. See
[Attack-Chain Reasoning](./knowledge-graph.md).

### 5. False Positive Neutralization

The Purifier agent applies pattern-based false-positive filtering before findings reach a
report. Categories include library code (OpenZeppelin / Solady / Solmate), intentional
design patterns (admin functions, pausing, upgradeable proxies), testing artifacts
(Foundry/Hardhat cheatcodes, test contracts), compiler warnings, intentional gas
optimizations, and style/quality items.

```
┌─────────────────────────────────────────────────────────────────┐
│              FALSE POSITIVE NEUTRALIZATION PATTERNS                │
├─────────────────────────────────────────────────────────────────┤
│  Library Code            OpenZeppelin, Solady, Solmate            │
│  Intentional Design      onlyOwner, whenNotPaused, proxy/upgrade  │
│  Testing Artifacts       vm.prank/deal/warp, test contracts       │
│  Compiler Warnings       deprecations, unused vars, missing NatSpec│
│  Gas Optimization        unchecked math, assembly, storage packing│
│  Style / Quality         formatting, missing events, naming       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Input contracts
   │
   ▼  Phase 0   Scope resolution → .vigilo/scope.md
   │  Phase 0.5 Build (faber, background): forge install / build
   ▼
Phase 1  Recon (parallel): explorator (code) + speculator (docs)
   │     → .vigilo/recon/*.md ; seed .vigilo/notepad/
   ▼
Phase 1.5  Risk-weighted priority map → notepad/risk-priorities.md
   │
   ▼
Phase 2  Deep analysis (≤3 specialists in parallel)
   │     each: hypothesize → write PoC (test/poc/*.t.sol) → forge test
   │     → VERIFIED (.vigilo/findings/) or THEORETICAL (.vigilo/unverified/)
   ▼
Phase 3  PoC validation & quality review: re-run PoCs, deduplicate, cross-reference,
   │       enforce evidence→severity caps
   ▼
Phase 3.5  QA pipeline:
   │   validator (Slither/Mythril) → verifier (5-stage) →
   │   triage (severity/priority) → purifier (false-positive filter)
   ▼
Phase 4  Report generation → .vigilo/reports/
```

All inter-phase state is passed through files in `.vigilo/` — primarily the notepad,
which is the shared memory for the otherwise-stateless auditors.

## Sandboxed Execution

Auditing runs **untrusted code**: `forge test` compiles and executes attacker-supplied
contest Solidity, and `cast` can hit arbitrary RPC endpoints. Every external binary
Vigilo invokes goes through a single sandboxed command runner —
[`packages/opencode/src/shared/exec/runner.ts`](../packages/opencode/src/shared/exec/runner.ts).
This is process-level hardening on the host, **not** Docker or container isolation.

By construction, every call gets:

1. **A mandatory `cwd`**, pinned to the audit workspace.
2. **A hard wall-clock timeout** — the process is `SIGTERM`'d on expiry and
   `SIGKILL`'d shortly after if it hangs (default 5 minutes).
3. **An output cap per stream** (default 1 MiB) to prevent memory/context flooding;
   excess is truncated with a marker.
4. **A scrubbed environment** — only `PATH`/`HOME`/locale variables, an explicit
   allowlist (e.g. `FOUNDRY_*`, `SOLC_*`), and caller-vetted keys are exposed, so
   unrelated secrets (API keys, cloud creds) never leak into untrusted execution.
5. **No shell** — arguments are passed as an argv array, eliminating shell
   interpolation/injection.

The runner never throws for command-level failures: a non-zero exit, a timeout, or a
missing binary all return a populated result the caller can inspect.

## Benchmarking

Vigilo's audit accuracy is measured by the harness in
[`packages/bench`](../packages/bench), which scores Vigilo's findings against real
contest **ground-truth** reports.

- **Ground truth:** Code4rena, Sherlock, and Cantina contests, sourced via
  [ScaBench](https://github.com/NethermindEth/ScaBench) (31 contests in the dataset).
- **Pipeline:** `checkout` (clone source + extract ground truth) → run the audit →
  `score` Vigilo findings → `report`.
- **Matching:** each ground-truth issue is scored as an **exact** match (same root cause
  + attack scenario + impact), a **partial** match (same root cause, incomplete
  scenario/impact), or **missed**; false positives are counted separately.
- **Metrics:** detection rate, precision, and F1, plus an optional comparison against a
  configurable baseline model (`BENCH_MODEL`, default `anthropic/claude-opus-4-5`).

There is no fixed pass/fail target and no published suite score — numbers depend on the
contest, the models configured, and the run. See the
[bench README](../packages/bench/README.md) and
[benchmark comparison](./benchmark-comparison.md) for usage.

## Performance & Caching

Vigilo's "cache" is the `.vigilo/` workspace itself:

- **Notepad reuse** — auditors read shared context from `.vigilo/notepad/` instead of
  re-reading and re-summarizing contracts, which is the main token-saver.
- **Resumable sessions** — the orchestrator continues auditors via their `session_id`
  rather than restarting, preserving prior analysis context.
- **Persistent artifacts** — recon, findings, and PoC logs remain on disk between runs,
  so re-running an audit can reuse what's already there (e.g. `--skip-audit` in the
  bench harness).

There is no Redis layer and no external cache service.

## Monitoring & Observability

- **Audit progress** is tracked through OpenCode's todo system; Vigilo creates per-phase
  todos so the user sees real-time progress rather than a black box.
- **Artifacts as audit trail** — every decision is written to `.vigilo/` (notepad,
  per-finding files, validator/verifier/triage/purifier reports), so the full reasoning
  chain is inspectable after the fact.

## Capability Summary

| Feature | Vigilo | Notes |
|---------|--------|-------|
| Persistence | File-based `.vigilo/` workspace | Markdown + Solidity; no database |
| Evidence Hierarchy | 4 evidence types | `POC_VALIDATED` → `THEORETICAL`, severity-capping |
| Attack-chain reasoning | Conceptual, file-based | `graph-builder` → Mermaid/DOT/Markdown |
| Model configuration | OpenCode-native + `vigilo.json` overrides | No tiers, no fallback chain |
| False-positive filtering | Pattern-based (Purifier) | Library / design / test / gas / style |
| Sandboxed execution | Hardened command runner | cwd-pin · timeout · output cap · scrubbed env · no shell |
| Benchmark | `packages/bench` vs contest ground truth | Code4rena / Sherlock / Cantina (ScaBench) |

## Future / Optional Enhancements

The following are **not implemented** today and are listed only as possible directions:

1. **Graph backend** — an optional persistent property-graph store for live querying and
   cross-audit history (see [knowledge-graph.md](./knowledge-graph.md)).
2. **Cross-installation knowledge sharing** of vulnerability patterns.
3. **Automated PoC generation** for a wider range of finding classes.
4. **Multi-language support** beyond Solidity.
5. **Richer finding explanations** for report consumers.
