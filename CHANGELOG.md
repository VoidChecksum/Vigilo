# Changelog

All notable changes to **Vigilo — Web3 Smart Contract Security Auditing Agent** are
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Community and project-maturity documentation: `CONTRIBUTING.md`, `SECURITY.md`,
  `CHANGELOG.md`, and `RELEASE.md`.
- **Security governance docs**: `docs/security/threat-model.md` and
  `docs/security/prompt-injection-defense.md` — Vigilo ingests attacker-controlled target code
  into an LLM, so its own threat model (untrusted execution, secret exfiltration, prompt
  injection) and defenses are now documented and linked from `SECURITY.md`.
- **Code-defined audit phase pipeline** (W2-1 core): phases now declare their prerequisites as
  data (`PHASE_PIPELINE`), with a deterministic resolver (`canEnterPhase`, `runnablePhases`,
  `unmetPrerequisites`) so sequencing/gating is checkable in code, not prose. `plan_status` shows
  the next runnable phase.
- **Typed audit-plan state** (OPPLAN): the prose-edited `.vigilo/audit-state.json` is now
  managed by typed tools — `plan_init` (create/resume), `plan_status`, `plan_complete_phase`
  (deterministic phase advancement), `plan_record_finding`, `plan_query` (e.g. "which High
  findings are still unverified"). The `/audit` flow drives state through them instead of
  hand-editing JSON, enabling reliable resume. Backward-compatible with legacy state files.
- **Knowledge-graph store** (`.vigilo/kg/`, JSONL) with `kg_record` / `kg_query` / `kg_chain`
  tools: dedup on deterministic node/edge identity, runtime-set provenance (never model-set),
  and cycle-safe multi-step attack-chain traversal (`ENABLES`/`CAUSES`/`REQUIRES`). Turns the
  conceptual graph model into a real queryable substrate — no external database.
- **Direct OpenAI-compatible scoring** (`BENCH_OPENAI_BASE_URL` / `BENCH_OPENAI_MODEL` /
  `BENCH_OPENAI_API_KEY`): the benchmark's LLM-judge can now hit any OpenAI-compatible
  `/chat/completions` endpoint directly, bypassing OpenCode's coding-agent layer. Runs at
  deterministic `temperature: 0`, needs no OpenCode server (CI-friendly), and makes
  small/local/self-hosted judges viable. **Validated end-to-end with live inference, no mocks**:
  a 0.5B model on CPU scored the `live-demo-vault` fixture at **100% detection / 100% F1** in
  ~20s, with provider token usage captured (W2-9). The same path through OpenCode's agent layer
  scored 0% in 305s — i.e. the bottleneck was the agent scaffolding, not model capability.
  Methodology + measured numbers: `docs/engineering/local-inference-bench.md`.
- **Lean, non-agentic LLM judge** (OpenCode path) + **robust verdict parsing**
  (`parseLLMResponse`: fenced/raw/bare-object JSON, unit-tested): the judge is a pure
  classification, so the OpenCode session is overridden with a minimal system prompt and an
  empty tool set — ≈4× faster per call, cheaper, no tool-call-loop risk, for any model.
- **Benchmark run-to-run stability** (`vigilo-bench score --runs N`): re-scores N times and reports
  mean ± stddev (min/max) of detection-rate and F1, so the non-deterministic LLM judge's claims are
  falsifiable instead of relying on a single number. Stored in `ScoreResult.stability`.
- **Benchmark cost/token capture**: both the **audit run** and the scorer now record real
  token + USD spend. The pipeline captures the audit session's usage before deleting it
  (`.vigilo/audit-cost.json` → `ScoreResult.audit_cost_usd`/`audit_tokens`); the scorer records
  its own (`scoring_cost_usd`/`scoring_tokens`). Both render in the report (with a
  cost-per-confirmed-finding figure), enabling fair model-vs-model cost comparison.
- **Canonical finding contract**: finding files now carry required YAML frontmatter
  (`id`, `severity`, `likelihood`, `impact`, `status`, `auditor`, `target`, `vuln_class`,
  `confidence`, `poc_path`, `duplicate_of`) documented in the `vulnerability-base` skill.
  The benchmark parser reads it (gray-matter) with a heuristic fallback for legacy files,
  and excludes `invalidated`/duplicate findings from scoring.
- **`fetch_contract_source` tool**: pull verified source for a DEPLOYED contract from an
  Etherscan-compatible explorer into the workspace — auditing live/contest addresses, not just
  pasted source. Handles all three `getsourcecode` shapes (plain, double-brace standard-JSON,
  single-brace map), flags proxies + implementation, and sanitizes paths (traversal-safe).
- **Structured `halmos` and `echidna` tools**: symbolic-invariant proving (Halmos) and
  property fuzzing (Echidna) through the sandboxed runner, returning parsed pass/falsified
  results with counterexamples / call sequences. Their parsers were validated against the real
  tools' output (Halmos 0.3.3, Echidna 2.3.2); the Halmos parser preserves exact uint256
  counterexample values (plain JSON.parse would round them). This completes the W1-4 analyzer
  suite (Slither + Mythril + Halmos + Echidna).
- **Structured `mythril` tool**: symbolic-execution analysis through the sandboxed runner,
  with normalized SWC-tagged findings, an install hint when absent, and the same KG-ingest loop
  as Slither. The `validator` agent uses it instead of raw `bash`.
- **Structured `slither` tool**: first-class Solidity static-analysis tool that runs
  Slither through the sandboxed runner and returns normalized findings grouped by impact
  (with a graceful install hint when Slither is absent). The `validator` agent now uses it
  instead of shelling out and hand-parsing JSON. Running it also **ingests findings into the
  knowledge graph** as `STATIC_SUGGESTED` `Finding`/`Vulnerability`/`Contract` nodes + edges
  (closing the tooling→memory loop; queryable via `kg_query`/`kg_chain`).
- **Sandboxed command runner** (`shared/exec/runner.ts`): all external binaries
  (`forge`, `cast`, ast-grep, future `slither`/`echidna`) now run with a pinned
  working directory, a hard wall-clock timeout (SIGTERM→SIGKILL), a per-stream
  output cap, a scrubbed environment (secrets dropped), and no shell — closing the
  "untrusted contest Solidity executes on the host with full env" hole.
- **Output-token floor** hook (`chat.params`): raises each request's output budget
  to a configurable floor (default 16384, clamped to the model's real limit) so
  large reports/PoCs aren't silently truncated by a provider's low default.
  Configurable via `max_output_tokens` in `vigilo.json`.
- Root `.claude-plugin/marketplace.json` so `/plugin marketplace add PurpleAILAB/Vigilo`
  resolves the plugin in `packages/claude`.
- The Solidity Semgrep ruleset (`.semgrep/vigilo-rules.yml`) is now a real CI gate
  with regression fixtures (`tests/semgrep-fixtures/`) and a `make semgrep` target;
  three previously broken rules were fixed.
- CI license/marketplace **consistency** check guarding against license skew.
- **Global auditor-concurrency cap** (`background_task.maxConcurrentTasks`): an opt-in total-
  concurrency limiter across all models, riding the existing acquire/release (deadlock-free,
  no new leak paths) so an LLM can't fan out unbounded background agents. Set to 3 to enforce
  the documented "max parallel auditors". Disabled by default (no behavior change).
- **Single-point auditor registration**: the specialist auditor roster is now one `AUDITOR_SPECS`
  list (name + factory + metadata); the factory/metadata maps are derived from it, so adding an
  auditor is one entry instead of parallel edits across maps.
- **ast-grep download integrity check**: the auto-downloader now verifies the fetched release
  ZIP against a pinned SHA-256 (real digests for all 5 common platforms of v0.40.0) before
  extracting/executing it — a mismatch is fatal, an unpinned version proceeds with a warning.
  Closes a supply-chain hole (previously: unverified `chmod +x` of a network download).
- **Safety-override gate**: a `vigilo.json` override can no longer silently grant read-only recon
  agents write/edit/delegate tools — restrictions are re-asserted on merge (bypass with
  `VIGILO_ALLOW_UNSAFE_OVERRIDES=1`).
- GitHub audit Action now writes a severity-count + gate-outcome table to the **job summary**
  (`$GITHUB_STEP_SUMMARY`) and exposes a `critical-count` output (in-PR observability).
- **Test-coverage gate**: `bun` coverage thresholds (opencode + bench) enforced in CI and via
  `make test-coverage`, set just below current coverage (≈58% / ≈62% lines) to catch regressions.
- **Self-SAST**: Vigilo now scans its own code — CodeQL (`javascript-typescript`,
  security-and-quality) in CI and a gitleaks secret-scanning pre-commit hook.
- **Weekly dependency-audit lane** (`bun audit` across workspaces) surfaced in the security
  workflow's job summary.
- **Skill frontmatter linter** (`make lint-skills` + CI job): validates every `SKILL.md` has a
  kebab-case `name` and a `description`, and flags duplicate names within a tree. Fixed 6 skill
  names that were Title Case / mismatched their directory.
- Report skill: **finding aggregation + de-duplication** step (groups same-`vuln_class`
  findings on overlapping targets, folds duplicates via `duplicate_of`, renumbers to unique
  contest ids), a **vulnerability-taxonomy reference** (SWC/DASP/CWE for `vuln_class`), and an
  **executive-summary template**. Aligned status filtering to the canonical lowercase contract
  values (was `VALIDATED`/`INVALIDATED`, which never matched the frontmatter). A tested
  `dedupeFindings` helper (groups same-`vuln_class`+`file`, keeps strongest) backs the step.

### Changed
- **Relicensed from Business Source License 1.1 to the MIT License.** Vigilo is now
  fully free and open source for any use — personal, research, or commercial.
- Aligned docs with reality: `docs/models.md`, `docs/knowledge-graph.md`, and
  `docs/architecture.md` now describe the OpenCode-native model config and the
  file-based `.vigilo/` store instead of unimplemented provider-tier/Neo4j systems.

### Fixed
- **Plugin failed to load in OpenCode ≥1.17 (critical).** The plugin entry re-exported a
  non-function value (`confidenceScoring`) alongside the plugin. OpenCode's loader treats every
  export as a Plugin and rejects the whole module ("Plugin export is not a function"), so the
  audit agents (the `vigilo` orchestrator + `quaestor`/`explorator`/`speculator` + the 8
  specialist auditors) and the `/audit`, `/poc`, `/report` commands silently never registered —
  only filesystem-discovered skills survived, masking the failure. The entry now exports only the
  plugin function (named + default); confidence-scoring is imported directly from its own module.
  Verified: the full 12-agent legion and `/audit` now register in OpenCode 1.17.3.
- Restored the build: corrected broken string literals and missing imports across
  `graph-builder.ts`, `purifier.ts`, `sandbox.ts`, `providers/index.ts`,
  `confidence-scoring.ts`, and the auditor registry (project now typechecks, builds,
  and tests clean).
- `bench` no longer calls `process.exit()` from library code (`error()` throws),
  so a single error can't tear down the test runner.
- Makefile `install` target parse error (`missing separator`) that broke every
  `make` target.

### Removed
- Fabricated benchmark material: the Python simulation tree under `benchmark/`,
  the XBOW Makefile targets, and the docker-compose stack — all of which referenced
  non-existent images or published copied/simulated metrics.
- Leaked offensive-pentest content (C2/Sliver/Kali/lateral-movement framing) from
  the sandbox and graph-builder agents and supporting types.

## [1.0.3] - 2026-06-15

### Added
- Cross-platform prebuilt binary packages for `darwin-arm64`, `darwin-x64`,
  `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, and `windows-x64`.
- `vigilo doctor` diagnostics command with `--verbose` output for environment checks.

### Changed
- Updated published platform-specific optional dependencies to track the main package
  version.

### Fixed
- Stability improvements to the OpenCode plugin installation and `postinstall` flow.

## [1.0.0] - 2025

### Added
- Initial public release of Vigilo.
- **OpenCode plugin** (`vigilo`): autonomous smart-contract audit orchestration with the
  Vigilo legion — Quaestor (scope), Explorator (recon), Speculator (docs intel), and eight
  specialist Centurion auditors (reentrancy, oracle, access control, flashloan, logic,
  DeFi, token, cross-chain).
- **Claude Code plugin**: agents, skills, and commands distributed via the
  `PurpleAILAB/Vigilo` plugin marketplace.
- **Benchmark suite** (`vigilo-bench`): audit-accuracy pipeline scoring Vigilo against
  verified reports from Code4rena, Sherlock, and Cantina.
- Foundry integration (`forge build`, `forge test`, `forge coverage`) for PoC validation.
- LSP integration (goto-definition, references, diagnostics) for Solidity, Vyper, Cairo,
  and Rust.
- Skill-based detection knowledge packs and the `/audit` and `/poc` commands.

[Unreleased]: https://github.com/PurpleAILAB/Vigilo/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/PurpleAILAB/Vigilo/compare/v1.0.0...v1.0.3
[1.0.0]: https://github.com/PurpleAILAB/Vigilo/releases/tag/v1.0.0
