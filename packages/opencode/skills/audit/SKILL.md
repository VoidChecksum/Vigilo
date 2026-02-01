---
name: audit
description: >
  Smart contract security audit orchestrator. Use when user says "audit",
  "security review", "find vulnerabilities", "Code4rena audit", or starts
  an audit workflow. Automatically executes all phases: scope → recon →
  analysis → PoC → report.
---

# Smart Contract Security Audit

Orchestrates the complete audit workflow from scope resolution to final report.

## Directory Structure

At audit start, create:

```
.vigilo/
├── recon/
├── findings/
│   ├── high/
│   └── medium/
├── poc/
└── reports/
```

---

## Workflow

```
Phase 0        Phase 1           Phase 2          Phase 3    Phase 4
(scope)        (recon)           (audit)          (PoC)      (report)
   │              │                  │               │           │
   ▼              ▼                  ▼               ▼           ▼
 scope.txt ─→ explorator ──┐
              speculator ──┼─→ recon/*.md ─→ sub-auditors ─→ findings/ ─→ PoC ─→ report
                              │                (max 3 parallel)
                              └─ protocol type detected
```

**Data Flow**:
1. **Phase 0**: Resolve scope.txt
2. **Phase 1**: Recon agents output to .vigilo/recon/
3. **Phase 2**: Auditors READ recon results → SELECT auditors by protocol type → WRITE findings
4. **Phase 3**: PoC validates findings
5. **Phase 4**: Generate reports

**CRITICAL**: Execute ALL phases automatically without waiting for user input.

---

## Phase 0: Scope Resolution

### Resolve Scope

```
1. Read("scope.txt") → If exists, use it
2. Else Read("README.md") → Extract scope section, create scope.txt
3. Else Auto-detect: Glob("src/**/*.sol"), exclude test/mock/lib
```

See [scope-resolution.md](references/scope-resolution.md) for detailed logic.

**→ IMMEDIATELY proceed to Phase 1**

---

## Phase 1: Reconnaissance (Parallel)

Launch both agents in parallel:

```
Task(subagent_type="explorator", prompt="Analyze code structure.")
Task(subagent_type="speculator", prompt="Analyze documentation.")
```

**Output:**
- .vigilo/recon/code-findings.md
- .vigilo/recon/docs-findings.md

**→ IMMEDIATELY proceed to Phase 2 when both complete**

---

## Phase 2: Deep Analysis (Parallel, Max 3 Auditors)

### Step 1: Read Recon Results

Read the recon outputs:
- .vigilo/recon/code-findings.md
- .vigilo/recon/docs-findings.md

Extract from recon:
- **Protocol Type**: AMM/Lending/Vault/Governance/Bridge/Staking
- **Key Entry Points**: Main functions to audit
- **Identified Risks**: Preliminary vulnerability hints

### Step 2: Select Auditors Based on Protocol Type

| Protocol Type | Auditors |
|--------------|----------|
| AMM/DEX | flashloan-auditor, oracle-auditor, reentrancy-auditor |
| Lending | oracle-auditor, logic-auditor, flashloan-auditor |
| Vault/ERC4626 | logic-auditor, reentrancy-auditor, defi-auditor |
| Governance | flashloan-auditor, access-control-auditor, logic-auditor |
| Bridge | cross-chain-auditor, access-control-auditor, reentrancy-auditor |
| Staking | logic-auditor, reentrancy-auditor, defi-auditor |

See [auditor-selection.md](references/auditor-selection.md) for detailed guidance.

### Step 3: Launch 3 Auditors in Parallel

**CRITICAL**: Include recon context in prompt so auditors use the gathered information.

Launch Task for each auditor with prompt containing:
- Protocol Type: (from recon)
- Key Entry Points: (from recon)
- Instructions to read recon from .vigilo/recon/
- Instructions to write findings to .vigilo/findings/{severity}/{auditor-type}/

**Example prompt for sub-auditor:**
```
You are the reentrancy-auditor. Analyze for reentrancy vulnerabilities.

Read recon: .vigilo/recon/code-findings.md
Write findings to: .vigilo/findings/high/reentrancy/
```

Launch all 3 auditors **in a single message** (parallel execution).

**CRITICAL**: Auditors write attack scenarios only, NO PoC code.

**Output:** .vigilo/findings/{severity}/{auditor}/

**→ IMMEDIATELY proceed to Phase 3 when all complete**

---

## Phase 3: PoC Validation (Sequential)

For each High/Medium finding:

1. Read finding from .vigilo/findings/{severity}/{auditor}/
2. Invoke Skill(vigilo:poc) with finding path
3. PoC generates test → `test/poc/{Severity}-{id}-{title}.t.sol`
4. Validation log → `.vigilo/poc/{Severity}-{id}-{title}.md`
5. Run forge test, handle failures (max 3 retries)
6. Validate: Test pass + assertions prove impact → VALIDATED

**File Naming Convention**: `{Severity}-{id}-{kebab-case-title}`
```
Example for "H-01-donation-attack-inflated-collateral":
- Scenario:  .vigilo/findings/high/logic/H-01-donation-attack-inflated-collateral.md
- PoC Code:  test/poc/H-01-donation-attack-inflated-collateral.t.sol
- PoC Log:   .vigilo/poc/H-01-donation-attack-inflated-collateral.md
```

**CRITICAL**: Test passing ≠ VALIDATED. PoC must prove the claimed impact.

**→ IMMEDIATELY proceed to Phase 4 when all findings processed**

---

## Phase 4: Report Generation

Invoke Skill(vigilo:report)

Generates submission-ready reports:
- .vigilo/reports/submissions/H-01-donation-attack-inflated-collateral.md
- .vigilo/reports/submissions/M-01-stale-price-check.md

Each report is copy-paste ready for target platform (default: Code4rena).

---

## Iron Laws

| Rule | Description |
|------|-------------|
| **SCOPE FIRST** | Always check scope.txt before analyzing code |
| **NO POC WITHOUT SCENARIO** | Auditors write scenarios, main agent generates PoC |
| **TEST PASS ≠ VALIDATED** | PoC must prove claimed impact, not just pass |
| **AUTO-CONTINUE** | No waiting for user between phases |

See [iron-laws.md](references/iron-laws.md) for complete rules.

---

## References

| File | When to Load |
|------|--------------|
| [scope-resolution.md](references/scope-resolution.md) | Phase 0: Scope resolution details |
| [auditor-selection.md](references/auditor-selection.md) | Phase 2: Protocol-specific auditor selection |
| [iron-laws.md](references/iron-laws.md) | All phases: Critical rules |
