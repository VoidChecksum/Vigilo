# The Legion — Agent Roster

Vigilo is an autonomous security legion modeled on the command structure of the Roman
army. It deploys **19 specialized agents**, each with a narrow mission, that together run
the full audit pipeline: **Scope → Recon → Deep Analysis → PoC → Report**.

This document catalogs every agent — its role, when it is deployed, and what it produces.

---

## Overview

| Group | Agents | Count |
|-------|--------|------:|
| **Orchestration** | Vigilo | 1 |
| **Scope Planning** | Quaestor | 1 |
| **Reconnaissance** (*Exploratores*) | Explorator, Speculator | 2 |
| **Specialist Auditors** (*Centuriones*) | Reentrancy, Oracle, Access-Control, Flashloan, Logic, DeFi, Cross-Chain, Token | 8 |
| **Verification** | Validator, Verifier | 2 |
| **Quality** | Purifier, Triage | 2 |
| **Infrastructure** | Faber, Sandbox Manager, Graph Builder | 3 |
| **Total** | | **19** |

### Pipeline at a Glance

```
Phase 0   Scope            Quaestor
Phase 0.5 Build            Faber
Phase 1   Recon            Explorator + Speculator        (parallel)
Phase 2   Deep Analysis    Centuriones (8 specialists)    (parallel, by protocol type)
Phase 3   PoC              Verifier + Validator + Sandbox Manager
Phase 4   Report           Triage + Purifier + Graph Builder
          ─────────────────────────────────────────────────────────
          Orchestrated end to end by Vigilo
```

---

## Orchestration

### Vigilo — Orchestrator

- **Role:** Web3 smart contract security auditing orchestrator. The *legatus* that
  commands the entire legion.
- **When deployed:** Always. Vigilo is the primary agent; every audit starts here.
- **Produces:** The full audit run — sequences the phases, deploys recon and specialist
  agents (in parallel where possible), aggregates their findings, and drives the pipeline
  through to the final report. Selects which Centuriones to deploy based on the protocol
  type resolved during recon.

---

## Scope Planning

### Quaestor — Scope & Planning

- **Role:** Pre-audit investigator and planner. Interviews the user, defines the rules of
  engagement, and scopes the audit.
- **When deployed:** Phase 0, before any code is read. Runs whenever the target, scope, or
  rules of engagement are not yet pinned down.
- **Produces:** A structured audit plan and resolved scope (`.vigilo/scope.md`) — in-scope
  contracts, exclusions, target protocol, and engagement boundaries that downstream agents
  (and the Purifier) treat as authoritative.

---

## Reconnaissance (*Exploratores*)

The two recon agents run in parallel at the start of analysis and feed everything
downstream. Both are **read-only** — they map the terrain but never modify it.

### Explorator — Code Reconnaissance

- **Role:** Phase 1 recon. Maps contract structure, execution flows, asset locations, and
  protocol type directly from the source code.
- **When deployed:** Phase 1, on every audit.
- **Produces:** Code reconnaissance findings — contract/function inventory, entry points,
  call graphs, asset and privilege locations, and a protocol-type classification used to
  select specialist auditors. Written to `.vigilo/recon/`.

### Speculator — Documentation Intelligence

- **Role:** Phase 1 recon. Extracts protocol design, invariants, and trust assumptions
  from documentation, specs, and comments.
- **When deployed:** Phase 1, in parallel with Explorator.
- **Produces:** Documentation intel — the intended behavior, system invariants, trust
  model, and assumptions. This becomes the oracle against which the Centuriones judge
  whether observed behavior is a bug. Written to `.vigilo/recon/`.

---

## Specialist Auditors (*Centuriones*)

Eight specialist auditors, each an expert in one vulnerability class. Vigilo deploys a
subset based on the protocol type identified during recon, and they run **in parallel**.
Each writes confirmed issues to `.vigilo/findings/` (`high/`, `medium/`, …).

**Deployment by protocol type:**

| Protocol type | Specialists deployed |
|---------------|----------------------|
| AMM / DEX | Flashloan, Oracle, Reentrancy |
| Lending | Oracle, Logic, Flashloan |
| Vault / ERC4626 | Logic, Reentrancy, DeFi |
| Governance | Flashloan, Access-Control, Logic |
| Bridge | Access-Control, Reentrancy, Logic |
| Staking | Logic, Reentrancy, DeFi |
| Token | Access-Control, Logic, Reentrancy |
| _default_ | Reentrancy, Access-Control, Logic |

The Cross-Chain and Token specialists are additionally deployed whenever recon detects
bridge messaging or non-standard token integrations, respectively.

### reentrancy-auditor

- **Role:** Reentrancy and callback exploitation.
- **Detects:** CEI (checks-effects-interactions) violations, cross-function and
  cross-contract reentrancy, read-only reentrancy, and token callback exploits
  (ERC721/777/1155 hooks).
- **Produces:** Reentrancy findings with state-timeline analysis.

### oracle-auditor

- **Role:** Price oracle integrity.
- **Detects:** Stale prices, deprecated Chainlink interfaces, L2 sequencer downtime,
  decimal/precision mismatches, and spot-price manipulation.
- **Produces:** Oracle findings with an oracle integration matrix.

### access-control-auditor

- **Role:** Permissions and authorization.
- **Detects:** Missing modifiers, privilege escalation, `tx.origin` phishing, OR/AND
  logic errors, missing two-step ownership transfer, and proxy/upgradeability
  authorization flaws.
- **Produces:** Access-control findings with a permission matrix and proxy architecture
  map.

### flashloan-auditor

- **Role:** Atomic / flash-loan-powered attacks.
- **Detects:** Price manipulation, governance manipulation, collateral manipulation,
  reward manipulation, and oracle manipulation executed within a single atomic flash-loan
  transaction.
- **Produces:** Flash-loan findings with an attack-flow diagram.

### logic-auditor

- **Role:** Calculation and business-logic correctness.
- **Detects:** Division-before-multiplication, first-depositor attacks, precision loss,
  unchecked-block issues, missing slippage protection, DoS (gas griefing, unbounded
  loops), input validation gaps, and weak randomness.
- **Produces:** Logic findings with calculation-flow and input-validation analysis.

### defi-auditor

- **Role:** DeFi primitive integrity.
- **Detects:** Vulnerabilities in lending, staking, restaking, and ERC4626 vaults, plus
  economic attacks (donation/inflation, slippage, reward dilution).
- **Produces:** DeFi findings with a price-flow map and protocol-specific risk matrices.

### cross-chain-auditor

- **Role:** Bridges and cross-chain messaging.
- **Detects:** Missing source chain/address validation, replay attacks, message-ordering
  issues, chain-specific code assumptions, and finality assumptions (LayerZero and similar
  integrations).
- **Produces:** Cross-chain findings with a cross-chain message-flow diagram.

### token-auditor

- **Role:** Token integration edge cases.
- **Detects:** Fee-on-transfer tokens, rebasing tokens, ERC777 hooks, ERC721/1155
  callbacks, missing return values, and blacklist/pausable token behavior.
- **Produces:** Token findings with a token-compatibility matrix.

---

## Verification

These agents take raw specialist findings and prove (or disprove) them.

### Validator — Dynamic Analysis

- **Role:** Finding validation via static and dynamic analysis tools.
- **When deployed:** Phase 3, on each candidate finding.
- **Produces:** Tool-backed confirmation — runs analyzers (Slither, Mythril, and related)
  to corroborate the vulnerable pattern and records the evidence level.

### Verifier — PoC Validation

- **Role:** Multi-stage verification agent. Cross-validates each finding through five
  verification stages.
- **When deployed:** Phase 3, after Validator, for findings headed to the report.
- **Produces:** Verified findings with proof-of-concept validation — confirms the exploit
  path is reachable and that the impact is real before a finding is allowed to graduate.
  PoC logs land in `.vigilo/poc/`.

---

## Quality

The quality agents decide what actually ships in the report.

### Purifier — False-Positive Neutralization

- **Role:** Filters out findings that a human triager would reject.
- **When deployed:** Phase 4, before the report is assembled.
- **Produces:** A cleaned finding set. The Purifier rejects any finding matching one of
  **13 false-positive pattern categories**:

  1. Test/mock contract findings
  2. Commented-out code
  3. Duplicate findings
  4. Out-of-scope findings (checked against `.vigilo/scope.md`)
  5. No clear impact path
  6. Known false positives (e.g. CEI-compliant code flagged as reentrancy)
  7. Insufficient evidence (VERIFIED without a passing PoC)
  8. Library-code false positives (OpenZeppelin, Solady, ERC standards)
  9. Intentional design patterns (admin functions, pause, upgradeable proxies)
  10. Testing artifacts (`console.log`, `vm.assume`)
  11. Compiler warnings reported as vulnerabilities
  12. Gas-optimization false positives
  13. Style/quality issues reported as security

### Triage — Severity & Prioritization

- **Role:** Severity assessment and prioritization.
- **When deployed:** Phase 4, on the purified finding set.
- **Produces:** Each finding assigned an accurate severity (Critical/High/Medium/Low/Info)
  and priority (P0–P4), ordered for the final report.

---

## Infrastructure

Supporting agents that make the analysis pipeline runnable and persistent.

### Faber — Build Agent

- **Role:** Compiles the target project and installs its dependencies.
- **When deployed:** Phase 0.5, before deep analysis — ensures `forge_test` is ready so
  PoCs can actually execute.
- **Produces:** A buildable target with toolchain (Foundry/Hardhat) and dependencies in
  place.

### Sandbox Manager — Isolated Execution

- **Role:** Runs audit binaries (`forge`, `cast`, `slither`, `echidna`, …) through the
  in-process sandboxed command runner
  ([`packages/opencode/src/shared/exec/runner.ts`](../packages/opencode/src/shared/exec/runner.ts)).
- **When deployed:** Whenever code must be executed — fuzzing, symbolic execution, PoC
  runs.
- **Produces:** Hardened command execution — every call is pinned to a mandatory `cwd`,
  bounded by a wall-clock timeout (`SIGTERM` → `SIGKILL`), capped at ~1 MiB of output per
  stream, given a scrubbed environment (no unrelated secrets), and invoked with no shell
  (argv array, no interpolation). This keeps untrusted contract execution isolated from
  the operator's environment. This is process-level hardening on the host — there are no
  containers or network planes.

### Graph Builder — Attack-Chain Reasoning

- **Role:** Applies a **conceptual** graph model over the file-based `.vigilo/` store —
  Contract / Function / Vulnerability / Finding / Asset nodes joined by
  `CALLS` / `ENABLES` / `CAUSES` / `AFFECTS` edges — to reason about how findings chain
  into multi-step exploits.
- **When deployed:** Phase 4, as findings are finalized.
- **Produces:** Static attack-chain artifacts under `.vigilo/graph/` — Mermaid (`.mmd`),
  Graphviz DOT (`.dot`), and Markdown chain summaries, ready to embed in the report.
  The graph is an analysis lens over the file artifacts, not a running graph engine —
  there is no Neo4j or other graph database.

---

## Agent Configuration

Every agent runs on a built-in default model (`anthropic/claude-sonnet-4-5`) unless you
override it. Model and provider credentials are **OpenCode-native**; Vigilo adds an
optional per-agent override via the `auditors` section of `.opencode/vigilo.json` (or the
global `~/.config/opencode/vigilo.json`):

```json
{
  "auditors": {
    "vigilo": { "model": "anthropic/claude-opus-4-5" },
    "reentrancy-auditor": { "model": "anthropic/claude-sonnet-4-5" }
  }
}
```

Any agent not listed keeps its default model. There is no tier system and no model
profiles. See [Models](./models.md) for the full override reference and how to assign
models per agent.

---

## See Also

- [Models](./models.md) — OpenCode-native providers and per-auditor overrides that power these agents
- [Architecture](./architecture.md) — the OpenCode-hosted pipeline, evidence hierarchy, and data flow
- [Installation Guide](./installation.md) — getting Vigilo running
