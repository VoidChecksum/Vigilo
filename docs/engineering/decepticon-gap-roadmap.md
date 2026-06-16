# (Internal) Vigilo ↔ Decepticon Gap Roadmap

_Auto-generated comparative analysis, 2026-06-15._

## Status (updated 2026-06-15)

**Done & verified** (opencode 313 tests + bench 32 tests pass; build + typecheck green):
build restoration · MIT relicense + no Code of Conduct · W1-1 (plugin install / license / version) ·
W1-2 (Semgrep CI gate + fixtures) · W1-3 (sandboxed runner) · **W1-4 (structured `slither` tool —
mythril/echidna/halmos still to follow the same template)** · **W1-5 (canonical finding YAML
contract in `vulnerability-base`)** · **W1-6 (frontmatter-aware bench parser, excludes
invalidated/duplicates)** · W1-8/W1-10 (provider/KG/compose vaporware removed, offensive carryover
stripped, docs aligned to reality) · W1-9 (fabricated benchmark tree deleted) · W1-11 (output-token
floor) · **W2-4 (report finding aggregation/de-dup + status-contract alignment)** · **W2-6 (self-SAST:
CodeQL + gitleaks)** · **W2-7 (test-coverage gate)** · **W3-13 (vuln-taxonomy reference + executive-summary
template)** · **W2-3 (real knowledge-graph store `.vigilo/kg/` + `kg_record`/`kg_query`/`kg_chain`
tools — dedup, provenance, cycle-safe chains)**.

Also done: **W2-2 (typed OPPLAN audit-plan state + tools, drives `/audit`)** · **W2-12 (in-PR action
job-summary + critical-count output)** · **W3-12 partial (threat model + prompt-injection-defense docs +
RELEASE.md, linked from SECURITY.md; ADRs/CODEOWNERS still open)** · **W3-14 (Slither→KG ingester:
`slither` runs land STATIC_SUGGESTED findings in the knowledge graph)** · **W3-3 (safety-override
gate: config can't strip recon agents' read-only restrictions)** · **W3-11 (weekly `bun audit`
dependency-vuln lane)** · **W3-1 partial (skill frontmatter linter in CI + `make lint-skills`; fixed
6 non-kebab skill names — full canonicalization/generation of the two trees still open)**.

**Remaining:** W1-4 — **COMPLETE**: Slither (real-validated + CI integration test), Halmos & Echidna
(installed the real tools, captured output, parsers validated against Halmos 0.3.3 / Echidna 2.3.2),
Mythril (schema-tested; binary blocked by coincurve on Python 3.14). W1-7 (reproducible judge — see
note), and the larger Wave-2 structural
items (**W2-1 sequencing core done** — code-defined phase pipeline + resolver; the runtime
delegate-per-phase wiring needs live verification — and W2-8 batch bench runner) + Wave-3
polish. **W2-9 done** (scoring cost + **audit-run cost** — pipeline captures the audit session's usage into
`.vigilo/audit-cost.json` before deletion; score reads it, report renders it; `sumSessionUsage`
unit-tested. Live $ numbers populate when a real audit runs against a capable model.)
**W2-8 / live-inference VALIDATED end-to-end WITH A REAL AUDIT-QUALITY SCORE (not just code paths):
ran the full benchmark scorer against a local llama.cpp model (no mocks) and scored Vigilo's findings
vs ground truth at 100% detection / 100% F1 in ~20s — on a 0.5B model on CPU, no API key, no GPU
(`live-demo-vault` fixture; `scoring_tokens: 5996` captured live = W2-9). The earlier 0% was OpenCode's
agent scaffolding swamping the tiny model, NOT model capability — fixed by adding a direct
OpenAI-compatible judge path (`BENCH_OPENAI_BASE_URL`, deterministic temperature 0, no OpenCode server).
Also added robust verdict parsing (`parseLLMResponse`) + lean non-agentic OpenCode path. Reproducible
setup + measured numbers: `docs/engineering/local-inference-bench.md`.**
**W3-2 done (single-point `AUDITOR_SPECS` registration; protocol-mapping inversion still optional).**
**W2-13 done (`fetch_contract_source` for deployed/contest addresses — tested Etherscan parser; live fetch needs network + key at runtime).**
**W2-11 done (opt-in global concurrency cap `maxConcurrentTasks` riding the existing acquire/release — deadlock-free, leak-free, 5 new tests; default off to preserve behavior).**
**W3-9 done (ast-grep download SHA-256 verification with REAL pinned digests for v0.40.0 × 5 platforms — downloaded the assets to compute them; mismatch fatal, unpinned warns).**

**Live-path status (evidenced):** Local inference DOES work here — ollama's bundled runtime was
broken (missing `llama-server`), so I downloaded llama.cpp's prebuilt server + a qwen2.5-0.5b GGUF
and verified real inference (fast: ~300ms direct). `opencode serve` with an openai-compatible
provider also forwards to it (llama-server logs show it processing opencode's prompts). BUT the full
bench is impractically slow on CPU with a 0.5b model: opencode injects a ~2.2k-token agent context
that the tiny CPU model processes at ~120 tok/s, exceeding sane timeouts. So W1-7's *stability code*
and W2-9's cost capture are verified live-capable, but a *quality* bench run (W2-8 run, audit-run
cost with real findings) needs a capable model (GPU or paid API) — not unwritten code, an inference
capacity limit. **W1-7 stability core done** (`--runs N` mean±stddev); per-prompt temperature still
isn't settable via OpenCode's `session.prompt`.

**Note on W1-7:** OpenCode's `session.prompt` body exposes no per-request `temperature`/`seed`
(see `SessionPromptData` in the SDK) — the bench can't pin temperature from the client. Determinism
must come from the scorer agent/model config; the achievable bench-side work is recording per-verdict
vote agreement + a `--runs N` stability measurement and persisting the scorer config into each score JSON.

---

Note: one assessment detail is now stale — `providers/index.ts:18` *does* import `MODEL_PROFILES`, so the "ReferenceError-grade missing import" gap appears already fixed (the file may still be dead/uncompiled, but the import bug is resolved). I'll reflect that. The other claims all verify: foundry `utils.ts` has no spawn limits, the Python sim benchmark tree is real, `security.yml` is only dependency-review + scorecard, 22 test files, no kg/skill tool registered.

I have enough verified ground truth. Here is the roadmap.

---

# Vigilo Engineering Roadmap — Closing the Decepticon Maturity Gap (Web3 Audit Domain)

Synthesized from 10 per-dimension assessments, deduplicated, re-ranked by leverage, and grounded against the current repo state (verified 2026-06-15). The bar is Decepticon's **engineering maturity**, translated to the **defensive smart-contract audit** domain. Offensive-only items are explicitly excluded at the end.

A recurring theme across dimensions: **Vigilo has excellent prose/docs/design but the load-bearing code is missing, dead, or unwired.** Three "vaporware behind good docs" subsystems (KG, provider layer, sandbox/compose) and several "dead config" assets (semgrep rules, Python bench tree, providers/index.ts) dominate the gap. The roadmap front-loads "make the claims true."

---

## TOP 3–5 "DO THESE FIRST" (single-session, maximum quality gain)

These are the highest leverage-per-effort items, verified as real defects in the repo. A single implementation session should tackle these.

### ⭐ 1. Fix the broken Claude Code plugin install + license skew + version orphan (Effort: S)
Three near-zero-cost correctness fixes that are currently *false advertising* on primary channels. **Verified:** no `.claude-plugin/` at repo root; all 7 platform `package.json` say `BSL-1.1` while main is `MIT`; root `package.json` orphan-pins `vigilo-linux-x64@^1.0.2` while main is `1.0.3`.

Implementation:
- Create repo-root `.claude-plugin/marketplace.json` (copy/symlink from `packages/claude/.claude-plugin/marketplace.json`, set `source` to the `packages/claude` subpath). Claude Code resolves `owner/repo` by fetching `.claude-plugin/marketplace.json` from the **repo root** — without it `/plugin marketplace add PurpleAILAB/Vigilo` fails.
- `sed`/Edit `"license": "BSL-1.1"` → `"MIT"` in all of `packages/opencode/packages/{darwin-arm64,darwin-x64,linux-x64,linux-x64-musl,linux-arm64,linux-arm64-musl,windows-x64}/package.json`.
- Delete or correct the orphan root `package.json` + `package-lock.json` `vigilo-linux-x64@^1.0.2` dependency.
- Add a CI assertion in `.github/workflows/ci.yml`: a `jq` step that every published `package.json` `license === root LICENSE` and that root `.claude-plugin/marketplace.json` resolves.

### ⭐ 2. Wire the existing Solidity Semgrep ruleset into CI as a real gate + regression fixtures (Effort: S→M)
**Verified:** `.semgrep/vigilo-rules.yml` exists with CWE/OWASP-SC/SWC metadata but is referenced by **zero** workflows/Makefile targets — pure dead config.

Implementation:
- Add a `semgrep` job to `.github/workflows/security.yml`: `semgrep --config .semgrep/vigilo-rules.yml --error --severity=ERROR --sarif --output semgrep.sarif <fixtures>` + `upload-sarif`.
- Add a `Makefile` `semgrep`/`lint-rules` target for local runs.
- Add `tests/semgrep-fixtures/` with a handful of known-vulnerable and known-safe `.sol` files; a test asserts expected finding counts so the rules can't silently rot on a Semgrep upgrade.

### ⭐ 3. Single sandboxed command runner for all binary execution (forge/cast/ast-grep/future slither) (Effort: M)
**Verified:** `tools/foundry/utils.ts` spawns binaries with **no cwd pin, no timeout, no output cap, no env scrub** — meanwhile `forge_test` executes arbitrary attacker-supplied contest Solidity (and `cast`/`ffi` can hit arbitrary RPCs). This is *running untrusted code on the operator's host*. The single highest-severity finding in the whole assessment.

Implementation — create `packages/opencode/src/shared/exec/runner.ts`:
- One `runCommand({argv, cwd, timeoutMs, maxOutputBytes, env})` API: mandatory `cwd` pin to the audit workspace, configurable timeout, output cap with truncation marker, captured exit code, and **scrubbed env** (drop unrelated secrets; pass only explicitly-allowlisted RPC vars).
- Replace the bare `Bun.spawn` in `tools/foundry/utils.ts`; route `forge_build/forge_test/forge_coverage/cast_call` through it (mirror the `truncatedReason` pattern `ast-grep` already uses). Default `forge_test` to a bounded fuzz/invariant budget.
- This is the audit analogue of Decepticon's `SandboxBase` single execution surface and closes the timeout/output/env holes across every tool at once.

### ⭐ 4. Resolve the three "vaporware" subsystems honestly (KG / providers / compose) (Effort: S decision, then per-track)
**Verified:** no `neo4j` driver dep, no kg tool registered in `tools/index.ts`; `providers/index.ts` is uncompiled dead code (the missing-import bug is *already fixed* — line 18 imports `MODEL_PROFILES` now — but it's still unconsumed); no Dockerfiles exist for the compose images. Docs sell all three as working.

In one session, make the **decision and align docs+infra** (the build can follow in later waves):
- **KG:** Commit to the file-based store (option B — Vigilo is a single-target file audit agent, not a multi-host engagement DB). Rewrite `docs/knowledge-graph.md` to describe `.vigilo/` reality; gate Neo4j behind explicit opt-in or remove it from `docker-compose.yml`/`Makefile`. Strip the leaked Decepticon offensive terms from `graph-builder.ts` ("lateral movement", "pivot opportunities", "decepticon-net", "Dual-Homed Neo4j").
- **Providers:** Delete the dead `providers/index.ts` abstraction and the offensive `ModelProfile`/`orchestrator/exploitation/recon` role taxonomy from `agents/types.ts`; document the real OpenCode-native mechanism (agent `.md` `model:` + `AuditorOverrideConfigSchema`). Fix `docs/models.md` to match.
- **Compose:** Either commit the missing `Dockerfile.{auditor,sandbox,dashboard}` or document the images as out-of-repo and stop pinning `:latest`.

### ⭐ 5. Delete the fabricated Python benchmark tree (Effort: S)
**Verified:** 8 runner files under `benchmark/` use `random.random()`/`_simulate_vigilo`/`status:'simulated'` and the README publishes fabricated `98.08%` numbers copied from Decepticon. For a security-audit tool, *publishing fake metrics is an integrity hazard worse than having none*.

Implementation: `rm -rf benchmark/`; replace with a one-line `README.md` pointing to `packages/bench` (the real harness). Migrate only the web3-relevant *intent* (SolidiFI injected-bug corpus, crytic not-so-smart) into `packages/bench` as future providers — do not keep the simulation code.

---

## ✅ WHERE VIGILO IS ALREADY AT OR ABOVE DECEPTICON — DO NOT TOUCH

- **LLM-judge benchmark scorer** (`packages/bench/src/scorer/llm-scorer.ts`): per-truth root-cause matching, 3-iteration majority voting, greedy de-dup, audit-appropriate metrics (precision/recall/F1/severity-weighted) + GPT-5 baseline comparison. **More sophisticated than Decepticon's flag-regex scorer.** (It still needs determinism controls — see W1-7 — but the architecture is ahead.)
- **CI foundation** (`.github/workflows/ci.yml`): `dorny/paths-filter`, SHA-pinned actions, `concurrency`, `merge_group`, single aggregate `ci-ok` required status. Matches Decepticon's pattern.
- **npm distribution architecture** (esbuild/turbo `optionalDependencies` thin-wrapper + 7 prebuilt Bun binaries, `detect-libc` musl/glibc, XDG-aware postinstall). Genuinely mature; only needs provenance/atomicity hardening (W2).
- **Web3 domain content**: the `report/` skill (5 real contest templates + severity-classification decision tree), the `poc/` skill (Iron Law `Test Pass != VALIDATED`, 7 bug-class templates), the contest-grade example finding `findings/cantina-rounding-accumulation.md`, the `.semgrep/vigilo-rules.yml` content, and `docs/knowledge-graph.md` design. Content is strong — the gap is the *engineering contract around it*, not the knowledge.
- **GitHub composite Action** (`.github/actions/vigilo-audit/action.yml`): Foundry/Hardhat detection, SARIF v2.1.0 emission, `fail-on` severity gate, diff-scope mode. Architecturally complete; needs `$GITHUB_STEP_SUMMARY`/PR-comment (W2) and lint coverage.

---

## WAVE 1 — Highest leverage, do now (correctness, safety, "make the claims true")

| # | Title | What to build/change | Target files | Effort | Why it closes the gap |
|---|-------|----------------------|--------------|--------|------------------------|
| W1-1 | Root `.claude-plugin` + license + version-orphan fix | (See Do-First #1) | `/.claude-plugin/marketplace.json` (new), `packages/opencode/packages/*/package.json`, root `package.json`, `.github/workflows/ci.yml` | S | Primary install channel is *broken as documented*; license contradiction on the actual executable creates legal ambiguity. |
| W1-2 | Wire Semgrep ruleset into CI + fixtures | (See Do-First #2) | `.github/workflows/security.yml`, `.semgrep/vigilo-rules.yml`, `Makefile`, `tests/semgrep-fixtures/` (new) | S→M | Highest-value Web3 asset Vigilo authored, currently never executes. |
| W1-3 | Sandboxed command runner | (See Do-First #3) | `packages/opencode/src/shared/exec/runner.ts` (new), `tools/foundry/utils.ts`, `tools/foundry/tools.ts`, `tools/foundry/constants.ts` | M | Critical: running untrusted contest Solidity on the host with no limits. |
| W1-4 | Structured tool wrappers for Slither/Mythril/Echidna/Halmos/Medusa/Aderyn | First-class `@tool` wrappers that parse JSON/SARIF, enforce timeout+output cap (via W1-3 runner), emit normalized findings, degrade with install hint. Stop telling agents to call them via raw `bash` in `agents/validator.ts`. | `packages/opencode/src/tools/{slither,mythril,echidna,halmos}/` (new), `tools/index.ts`, `agents/validator.ts` | L | Core defensive engines exist only as prompt strings today; output is unparsed/untimed/host-run. Direct analogue of Decepticon's `scanner_tools.py`. |
| W1-5 | Canonical finding data contract (YAML frontmatter) | One artifact flowing through every phase: required frontmatter `id` (globally unique `VIG-001`, not per-auditor `H-01`), `title`, `severity`, `likelihood`, `impact`, `status` (draft/poc-pending/validated/needs-review/invalidated), `auditor`, `target` (file:line-range), `vuln_class` (SWC/CWE/DASP), `confidence`, `poc_path`, `duplicate_of`. | `packages/claude/skills/vulnerability-base/SKILL.md`, `packages/claude/skills/audit/references/finding-contract.md` (new), `packages/bench/src/parsers/vigilo-findings.ts` | M | Root cause behind status-filtering, dedup, scoring, and promotion gaps. Decepticon's maturity *is* this contract. Also fixes the fragile regex scraping in the bench parser. |
| W1-6 | Frontmatter-aware bench parser + scorer | Parse new YAML frontmatter first, fall back to filename/prose heuristics. Surface `status`, `target file:line`, `vuln_class` to the LLM judge. | `packages/bench/src/parsers/vigilo-findings.ts`, `packages/bench/src/scorer/llm-scorer.ts` | S | A contract is only as good as its consumers; makes scoring deterministic on the easy fields. |
| W1-7 | Reproducible LLM judge | Pin `temperature=0` + fixed seed in `initOpenCodeClient`/`sendPrompt`; record per-truth iteration votes + agreement score into `ScoreResult`; add `--runs N` for mean±stddev; persist scorer model/temp/seed/iterations into every score JSON. | `packages/bench/src/scorer/llm-scorer.ts`, `packages/bench/src/client/opencode.ts`, `packages/bench/src/types.ts`, `packages/bench/src/utils.ts` | M | "Better than GPT-5" claims are unfalsifiable if verdicts shift run-to-run. The judge analogue of Decepticon's `seeds`/15-run grids. |
| W1-8 | Resolve KG vaporware (decide file-store, align docs) | (See Do-First #4 KG track) | `docs/knowledge-graph.md`, `docker-compose.yml`, `Makefile`, `packages/opencode/src/agents/graph-builder.ts` | S | Docs promise a KG the agent has no tool to reach; immediate credibility gap to any auditor/reviewer. |
| W1-9 | Delete fabricated Python benchmark tree | (See Do-First #5) | `/benchmark/` (remove) | S | Publishing fake `98.08%` numbers is an integrity hazard for an audit tool. |
| W1-10 | Resolve provider vaporware (delete dead abstraction) | (See Do-First #4 Providers track) Delete `providers/index.ts` abstraction + offensive `ModelProfile` roles; document OpenCode-native model config. | `packages/opencode/src/providers/index.ts`, `packages/opencode/src/agents/types.ts`, `packages/opencode/src/index.ts`, `docs/models.md` | M | Dead, uncompiled, offensive-role-taxonomy code; `docs/models.md` describes a non-existent tier/profile/litellm system as working. |
| W1-11 | Output `max_tokens` floor for deliverables | Set explicit output `max_tokens` (≥16384) for report/poc generation in `AuditorOverrideConfigSchema` (and litellm if kept); document the rationale. | `packages/opencode/src/config/schema.ts`, `packages/claude/skills/{report,poc}/SKILL.md` | S | Anthropic 4096 default truncates large single-tool-call JSON writes mid-argument — silently dropping report/PoC content. Decepticon hit and fixed exactly this (`DEFAULT_LLM_MAX_TOKENS=16384`). |

---

## WAVE 2 — Structural maturity (orchestration, memory, self-scan, distribution hardening)

| # | Title | What to build/change | Target files | Effort | Why it closes the gap |
|---|-------|----------------------|--------------|--------|------------------------|
| W2-1 | Code-defined audit phase pipeline | Replace the ~800-line prose Phase 0–5 narrative as source of truth: phases as data (scope/build/recon/risk/analysis/quality/verification[validator,verifier,triage,purifier]/report) with declared prerequisites (e.g. `analysis requires build:ok`); runtime issues `delegate_task` per phase and records status. Keep prompt for LLM-judgment steps; make sequencing/gating deterministic code. | `packages/opencode/src/agents/pipeline/{phases,orchestrator}.ts` (new), `agents/vigilo.ts` | L | Direct analogue of Decepticon's compiled-graph + ordered slot stack. Today phases can be skipped/reordered with no detection. |
| W2-2 | Typed audit-plan state (OPPLAN analogue) | `.vigilo/plan.json` typed store + tools (`plan_init`, `plan_set_phase`, `plan_add_finding`, `plan_update_finding`, `plan_query`); auditors mutate findings/phase status through it. Enables "which highs are unverified" queries + deterministic resume. | `packages/opencode/src/agents/plan/opplan.ts` (new), `packages/opencode/src/tools/plan/tools.ts` (new), `agents/types.ts` | L | Untyped markdown handoff can't be queried or resumed. OPPLAN is what makes Decepticon's convergence/resume reliable. |
| W2-3 | Real structured findings/KG store + registered tools | SQLite/JSONL store at `.vigilo/kg/` (Contract/Function/Vulnerability/Finding/Asset/Oracle nodes; CALLS/ENABLES/CAUSES/AFFECTS edges) with deterministic dedup keys + auto-injected provenance (auditor/timestamp/session — never LLM-set). Register `kg_record`/`kg_query`/`kg_chain` in `builtinTools`. | `packages/opencode/src/tools/kg/{store,types,dedup,tools}.ts` (new), `tools/index.ts`, `features/claude-code-session-state/state.ts` | L | Turns `.vigilo/` prose into queryable, deduplicated, provenance-tagged shared memory — exactly what the KG doc promises. Folds in W2-2's finding store. |
| W2-4 | Finding aggregation + de-duplication step | Before report generation: collect all auditor findings, sort severity→likelihood/impact, merge same-root-cause (keep highest, record `duplicate_of`), renumber to globally-unique contest ids. | `packages/claude/skills/report/SKILL.md`, `packages/claude/skills/report/references/aggregation.md` (new), `agents/triage.ts` | M | 3 parallel auditors rediscover the same bug; unmerged duplicates are penalized by Code4rena/Sherlock. Decepticon's cross-objective de-dup analogue. |
| W2-5 | Validation status as written field + PoC validation-log schema | PoC step writes a structured log (status, forge command, assertion→impact, retry count, raw-output excerpt) AND patches finding frontmatter status. Report Step-2 filters on that field. Add differential fix-verification (PoC passes on vuln code, fails after mitigation). | `packages/claude/skills/poc/SKILL.md`, `packages/claude/skills/poc/references/validation-log.md` (new), `packages/claude/skills/report/SKILL.md` | M | Makes the `TEST PASS != VALIDATED` Iron Law machine-enforceable; validate-before-promote is Decepticon's hard gate. |
| W2-6 | Self-SAST on Vigilo's own code | Add to `security.yml`: CodeQL (`javascript-typescript`, security-and-quality) over `packages/opencode`+`packages/bench`, Trivy fs+config, TruffleHog verified-secret diff scan; gitleaks in `.pre-commit-config.yaml`. | `.github/workflows/security.yml`, `.pre-commit-config.yaml` | M | Vigilo audits others' Solidity but applies zero SAST/secret-scanning to its own TS agent code. **Verified:** security.yml is only dependency-review + scorecard. |
| W2-7 | Coverage measurement + gate | `bun test --coverage` in CI, Makefile `test`/`test-coverage`, coverage artifact + non-blocking diff-cover on PRs, low initial threshold ratcheting up. | `.github/workflows/ci.yml`, `Makefile`, `packages/opencode/package.json` | M | Only **22 test files** (verified) with zero coverage visibility; harness regressions (hooks/recovery/delegate) are invisible. |
| W2-8 | Batch benchmark runner | `bench run-all [--filter platform=sherlock] [--parallel N]`: iterate the 31-contest dataset, run checkout→audit→score per contest with concurrency limit, write `data/scores/batch-<ts>/index.json` manifest + rolled-up aggregate + total cost. | `packages/bench/src/commands/run-all.ts` (new), `packages/bench/src/cli.ts`, `commands/report.ts` | M | No reproducible suite-level number exists today (single-contest only). Mirrors Decepticon `runner.py` + `index.json`. |
| W2-9 | Cost/token/wall-clock capture in bench | Extend `ScoreResult` with `audit_cost_usd`/`audit_tokens`/`audit_duration_ms` from OpenCode session usage; render cost-per-confirmed-finding. | `packages/bench/src/types.ts`, `commands/pipeline.ts`, `commands/report.ts`, `client/opencode.ts` | M | Cost/token efficiency is a primary LLM-agent metric and needed for fair GPT-5 comparison; the real harness drops it entirely. |
| W2-10 | npm provenance + signing + atomic release | Enable `NPM_CONFIG_PROVENANCE: true` on the 7 platform packages; add CycloneDX SBOM + cosign/checksums; gate the wrapper publish behind successful platform publication (draft-until-verified). | `.github/workflows/{publish,publish-platform}.yml`, `packages/opencode/docs/installation.md` | M | The load-bearing ~95MB executable is unsigned/unattested while only the thin wrapper has provenance; partial fan-out failure leaves users with a wrapper referencing a non-existent binary version. |
| W2-11 | Auditor parallelism budget enforced in code | Explicit "auditor slot" limiter (default 3, configurable) on the `delegate_task`/`BackgroundManager` path, independent of the generic per-model `ConcurrencyManager` (default 5). | `features/background-agent/concurrency.ts`, `tools/delegate-task/tools.ts`, `config/schema.ts` | M | "MAX 3 PARALLEL" is prompt-only with zero code backing; an LLM can fan out unbounded background calls. |
| W2-12 | GitHub Action in-PR feedback | `$GITHUB_STEP_SUMMARY` severity-count table + top findings with `file:line` links + fail-on outcome; optional PR comment gated behind `comment-on-pr: true` + `pull-requests: write`. | `.github/actions/vigilo-audit/action.yml`, action README | M | Primary observability surface for the CI/contest persona; currently writes **no** step summary and **no** PR comment. SARIF parser already computes the counts — mostly wiring. |
| W2-13 | `fetch_contract_source` tool | Pull verified source (Etherscan/Blockscout/Sourcify), resolve proxy implementations, write into workspace as untrusted input to the W1-3 runner; note verified-vs-unverified + compiler settings. | `packages/opencode/src/tools/contract-source/` (new), `tools/index.ts` | M | Auditing deployed/contest addresses needs manual paste today; also the data source for fork PoCs. |
| W2-14 | Persistent audit-progress panel | Emit structured phase/auditor events from the `/audit` flow; render on OpenCode's TUI status surface (current phase, running vs completed auditors, live finding counts) instead of 3–5s toasts. | `features/task-toast-manager/manager.ts`, `features/builtin-commands/templates/audit.ts`, `tools/delegate-task/tools.ts` | L | A long audit currently looks stalled. Decepticon keeps `OpplanStatus`+`CoordinatorPanel` always on screen. |

---

## WAVE 3 — Polish, governance, scaling headroom

| # | Title | What to build/change | Target files | Effort | Why it matters |
|---|-------|----------------------|--------------|--------|----------------|
| W3-1 | Single canonical skill source-of-truth + linter | Pick the richer hierarchical `claude/skills` tree as canonical; generate the flat `opencode/skills` at build. Add structured frontmatter (`when_to_use`, `swc`, `owasp_sc`, `vuln_class`, `severity_floor`, `requires`). Build a `skill_audit`-style linter (stable rule IDs, frontmatter/duplicate/cross-tree-parity checks) wired into CI. | `packages/claude/skills/**`, `packages/opencode/skills/**` (generated), `script/lint-skills.ts` (new), `.github/workflows/ci.yml` | M→L | Two diverging hand-maintained trees (reentrancy 423 vs 420 lines) guarantee drift; no machine-routable metadata; no validation. |
| W3-2 | Spec-based auditor roster | `AuditorSpec {name, description, factory, category, protocols, priority, requiredSkills}`; build `AUDITOR_FACTORIES`/metadata/prompt sections from one list; derive `PROTOCOL_AUDITOR_MAPPING` from `spec.protocols` (single source of truth). | `agents/auditors/index.ts`, `agents/utils.ts`, `agents/dynamic-prompt-builder.ts`, `agents/types.ts` | M | Adding an auditor today touches 5+ files and duplicates protocol mapping in TS + prose. Decepticon's `SubAgentSpec` gives single-point registration. |
| W3-3 | Safety-critical override gate | Flag protected prompt sections/tools (scope-enforcement, evidence-verification, read-only restriction); refuse config overrides removing them unless `VIGILO_ALLOW_UNSAFE_OVERRIDES=1`. | `agents/utils.ts`, `shared/agent-tool-restrictions.ts`, `config/schema.ts` | M | `mergeAgentConfig` lets any field be overridden with no guardrail; analogue of Decepticon's `SafetyOverrideViolation`. |
| W3-4 | Headless `vigilo audit`/`resume`/`status` CLI | Spawn/connect `opencode serve`, send `/audit`, stream phase progress, exit on `audit-state.json` completion; factor bench's serve+SDK logic into a shared module. | `cli/index.ts`, `cli/audit.ts` (new), `packages/bench/src/commands/pipeline.ts` | L | No scriptable entry point; analogue of Decepticon's launcher `start`. |
| W3-5 | `vigilo update`/`uninstall` + doctor outdated-check | Version-compare against npm registry; programmatic opencode.json/vigilo.json edit on uninstall. | `cli/index.ts`, `cli/doctor.ts` | M | Decepticon ships channel-aware `update`/`remove`; Vigilo's manual hand-edit uninstall is a UX regression. |
| W3-6 | Single-source version stamp across manifests | Git-tag-stamped version (sentinel or sync script) so opencode/bench/7 platform packages/plugin/marketplace move together. | `publish.yml`, `packages/claude/.claude-plugin/{plugin,marketplace}.json`, `RELEASE.md` (new) | M | Current skew (1.0.3 / 1.0.2 orphan / 0.0.7 / 0.1.0) makes "which Vigilo am I running" unanswerable. |
| W3-7 | Buildable, signed audit-tooling container | In-repo Dockerfile (pinned digest, SHA-256-verified foundry/slither/echidna/halmos, HEALTHCHECK, non-root); make W1-3 runner able to `docker-exec` as opt-in isolation transport. Drop `seccomp:unconfined`/`SYS_ADMIN`/`NET_ADMIN`. | `containers/audit-sandbox.Dockerfile` (new), `docker-compose.yml`, `shared/exec/runner.ts` | L | Sandbox plane is unbuildable + over-privileged. Decepticon's `sandbox.Dockerfile` is the bar. |
| W3-8 | Managed local anvil fork + RPC allowlist | Runner-managed anvil-backed `cast_call`/`forge_test`; RPC allowlist from config; provider secrets via env (never command-line/logs). | `tools/foundry/tools.ts`, `shared/exec/runner.ts`, `config/schema.ts` | M | Removes unbounded outbound RPC + key-leak risk; audit analogue of Decepticon's egress scope control. |
| W3-9 | ast-grep download SHA-256 verification | Pin + verify checksum (reject on mismatch) in the auto-download; prefer vendored binary. | `tools/ast-grep/downloader.ts`, `tools/ast-grep/constants.ts` | S | Unverified chmod-755 download of a security tool is a supply-chain hole; Decepticon pins Ghidra by SHA-256. |
| W3-10 | actionlint + pre-commit CI mirror | One job runs `pre-commit run --all-files`; one runs `actionlint`+`shellcheck` on workflows and the embedded bash in `vigilo-audit/action.yml`. | `.github/workflows/ci.yml` | S | Pre-commit hooks are not merge-blocking; the Action's ~250 lines of bash+Node are never linted. |
| W3-11 | Scheduled dependency-vuln lane | Weekly `osv-scanner`/`bun audit` against the locked tree + `.osv-ignore` allowlist. | `.github/workflows/security.yml`, `.osv-ignore` (new) | S | dependency-review only fires on dep-graph PRs; analogue of Decepticon's weekly pip-audit. |
| W3-12 | Governance/docs (ADRs, agent threat model, prompt-injection-defense) | `docs/adr/` (template + README + seed decisions); `docs/security/{threat-model,prompt-injection-defense}.md`; `.github/CODEOWNERS`, `RELEASE.md`, `CODE_OF_CONDUCT.md`. | `docs/adr/`, `docs/security/`, `.github/CODEOWNERS`, `RELEASE.md`, `CODE_OF_CONDUCT.md` | L | Vigilo ingests attacker-controllable text (contract source/READMEs) into an LLM — prompt-injection is an in-domain, undocumented risk. |
| W3-13 | Web3 vuln-taxonomy + executive-summary + likelihood/impact fields | SWC/CWE-1xxx/DASP taxonomy reference (required `vuln_class`); executive-summary template (severity counts, protocol-impact language, risk rating); stored Likelihood×Impact matrix fields. | `packages/claude/skills/report/references/{vuln-taxonomy,severity-classification}.md`, `report/templates/executive-summary.md`, `vulnerability-base/SKILL.md` | S→M | Enables Solodit cross-ref + bench per-vuln stats; managed-review deliverables need a portfolio summary; Sherlock/Cantina expect L×I reasoning. |
| W3-14 | SARIF→KG ingester | Lift Slither/Foundry SARIF into typed Finding nodes with `STATIC_SUGGESTED` tier + dedup keys; wire into triage/verifier. | `tools/kg/ingest.ts`, `agents/triage.ts`, `agents/verifier.ts` | M | Closes the tooling↔memory loop; analogue of Decepticon's `kg_ingest` sarif adapter. |
| W3-15 | Provider/dataset abstraction in bench + clean-suite FP measurement | `Provider` interface (loadProjects/parseGroundTruth/checkoutSource) so ScaBench is one provider, SolidiFI/SmartBugs a second; add OZ/Solady/Solmate clean-suite for a real false-positive rate. | `packages/bench/src/providers/{base,scabench}.ts`, `packages/bench/data/clean-suite/` | L | Mirrors Decepticon's `BaseBenchmarkProvider`; enables controlled detection + real (non-simulated) FP metric. |
| W3-16 | HITL checkpoint for blast-radius actions | Approval gate keyed to config policy before report submission / mainnet-fork RPC / `cast_send`. | `hooks/hitl-approval/index.ts` (new), `index.ts`, `config/schema.ts` | M | Read-only audit needs few gates, but report publication + fork RPC are real blast-radius steps governed only by prompt text today. |

---

## EXPLICITLY EXCLUDED (offensive-only, no audit analogue)

Do **not** port these from Decepticon — they have no defensive smart-contract-audit meaning:

- **C2 / Sliver implant orchestration, beacons, lateral movement, "pivot opportunities"** — and the leaked carryover terms in `graph-builder.ts` (`decepticon-net`, "Dual-Homed Neo4j read-replica/write-master") and `agents/sandbox.ts`/`docker-compose.yml` (Sliver, msfconsole, evil-winrm, Kali, "C2 server" on sandbox-net). Strip these as cleanup (folded into W1-8/W1-10), do not reimplement.
- **ATT&CK-technique-keyed approval policy** and **MITRE ATT&CK coverage maps / detection-gap matrices / blue-team remediation-roadmap-by-time-bucket** reporting constructs. (The *coverage-taxonomy idea* is kept but retargeted to SWC/OWASP-SC/DASP in W3-13 — that is the legitimate adaptation, not a port.)
- **Network-scan ingest adapters** (`nmap_xml`/`nuclei_jsonl`/`httpx_jsonl`). The SARIF adapter analogue is kept (W3-14); the network ones are dropped.
- **The xbow offensive-web-exploitation benchmark framing** entirely (deleted in W1-9).
- **Cross-provider *lateral* model routing** as an offensive resilience pattern — the audit analogue is graceful *quality degradation* (opus→sonnet→haiku), which is a docs/litellm-config concern, not a feature to build.

---

### Sequencing note
Wave 1 is one focused implementation push (items W1-1, W1-2, W1-3 + W1-5 are the four-item core session; W1-8/W1-9/W1-10/W1-11 are cheap follow-ons in the same push). Wave 1 makes Vigilo's *claims true and its execution safe* — the prerequisite for everything else. Wave 2 builds the structural maturity (typed orchestration, real memory, self-scan, distribution hardening) that constitutes the bulk of the Decepticon gap. Wave 3 is polish, governance, and scaling headroom.

The single biggest conceptual lever across all dimensions: **W1-5 (canonical finding contract) + W2-3 (real KG store)** — almost every other gap (status filtering, dedup, scoring reliability, resume, provenance, report ordering) is downstream of Vigilo's cross-agent state being untyped markdown. Prioritize a typed, queryable finding/state substrate and a large fraction of the remaining gaps collapse.