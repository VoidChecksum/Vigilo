export const AUDIT_TEMPLATE = `# /audit - Smart Contract Security Audit

Orchestrates the complete audit workflow from scope resolution to final report.

## Usage

\`\`\`
/audit                        # Start audit on current project
/audit [path/to/scope.txt]    # Use specific scope file
/audit --platform=sherlock    # Set target platform (default: code4rena)
/audit --skip-poc            # Skip PoC validation phase
/audit --resume              # Resume interrupted audit
\`\`\`

---

## Session Management

### Initialize or Resume Audit State

**FIRST**, call the typed audit-plan tools (do NOT hand-edit \`.vigilo/audit-state.json\`):

\`\`\`
plan_init({ protocol_name, protocol_type, platform, scope_file })
plan_status()
\`\`\`

- \`plan_init\` creates the plan at the \`scope\` phase, or **resumes** an existing one
  (appending this session). \`plan_status\` reports \`current_phase\`, \`completed_phases\`,
  and finding counts by lifecycle status.
- **If resuming** (completed phases exist): print "Resuming audit from {current_phase}" and
  continue at that phase — do not redo completed phases.
- The store is the single source of truth for phases, session resume, and finding lifecycle;
  the phase tools below keep \`current_phase\` consistent automatically.

---

## Directory Structure

At audit start, create:

\`\`\`
.vigilo/
├── audit-state.json    # Session state for resume
├── recon/
├── findings/
│   ├── high/
│   └── medium/
├── poc/
└── reports/
\`\`\`

---

## Workflow

<critical>
**TodoWrite ALL phases. Mark in_progress → completed in real-time.**
\`\`\`
TodoWrite([
  { id: "scope", content: "Phase 0: Resolve scope", status: "pending", priority: "high" },
  { id: "recon", content: "Phase 1: Reconnaissance (explorator + speculator)", status: "pending", priority: "high" },
  { id: "analysis", content: "Phase 2: Deep Analysis (3 protocol-specific auditors)", status: "pending", priority: "high" },
  { id: "poc", content: "Phase 3: PoC Validation", status: "pending", priority: "high" },
  { id: "report", content: "Phase 4: Report Generation", status: "pending", priority: "medium" }
])
\`\`\`
</critical>

---

## Phase 0: Scope Resolution

**Mark "scope" as in_progress.**

### Resolve Scope

\`\`\`
1. Read("scope.txt") → If exists, use it
2. Else Read("README.md") → Extract scope section, create scope.txt
3. Else Auto-detect: Glob("src/**/*.sol"), exclude test/mock/lib
\`\`\`

### Create Directory Structure

\`\`\`bash
mkdir -p .vigilo/recon .vigilo/findings/high .vigilo/findings/medium .vigilo/poc .vigilo/reports/submissions
\`\`\`

**Advance state**: \`plan_complete_phase({ phase: "scope" })\` (auto-advances to \`recon\`).

**Mark "scope" as completed. IMMEDIATELY proceed to Phase 1.**

---

## Phase 1: Reconnaissance (Parallel)

**Mark "recon" as in_progress.**

### Launch Both Analyzers in Parallel

\`\`\`
delegate_task(subagent_type="explorator", load_skills=["code-analysis"], run_in_background=true, prompt=\\\`
Code Reconnaissance for Smart Contract Audit

1. Analyze contract structure: inheritance, dependencies, entry points
2. Map value flows: where assets enter, move, exit
3. Classify protocol type: AMM/Lending/Vault/Governance/Bridge/Staking
4. Note patterns to investigate: external calls, privileged functions, oracle usage

Output: .vigilo/recon/code-findings.md
\\\`)

delegate_task(subagent_type="speculator", load_skills=["docs-analysis"], run_in_background=true, prompt=\\\`
Documentation Reconnaissance for Smart Contract Audit

1. Find and analyze: README, docs/, whitepaper, spec
2. Extract: stated invariants, trust assumptions, security considerations
3. Answer: Where is the money? Who can move it? What must hold?

Output: .vigilo/recon/docs-findings.md
\\\`)
\`\`\`

### Wait for Results

\`\`\`
// Collect both results
for each task_id: background_output(task_id="...")
\`\`\`

**Advance state**: pass the protocol_type extracted from recon via \`plan_init({ protocol_type })\`, then \`plan_complete_phase({ phase: "recon" })\` (auto-advances to \`analysis\`).

**Read outputs. Mark "recon" as completed. IMMEDIATELY proceed to Phase 2.**

---

## Phase 2: Deep Analysis (Parallel, Max 3 Auditors)

**Mark "analysis" as in_progress.**

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

### Step 3: Launch 3 Auditors in Parallel

**CRITICAL**: Include recon context in prompt so auditors use the gathered information.

\`\`\`
// Example for Vault protocol
delegate_task(subagent_type="logic-auditor", load_skills=["logic-error", "vault-erc4626"], run_in_background=true, prompt=\\\`
Protocol Type: Vault/ERC4626
Read recon: .vigilo/recon/code-findings.md
Focus: share calculation, first depositor attacks, donation attacks
Write findings to: .vigilo/findings/{severity}/logic/
\\\`)

delegate_task(subagent_type="reentrancy-auditor", load_skills=["reentrancy", "vault-erc4626"], run_in_background=true, prompt=\\\`
Protocol Type: Vault/ERC4626
Read recon: .vigilo/recon/code-findings.md
Focus: CEI violations, cross-function/contract reentrancy, token callbacks
Write findings to: .vigilo/findings/{severity}/reentrancy/
\\\`)

delegate_task(subagent_type="defi-auditor", load_skills=["economic-attack", "vault-erc4626"], run_in_background=true, prompt=\\\`
Protocol Type: Vault/ERC4626
Read recon: .vigilo/recon/code-findings.md
Focus: economic attacks, share inflation, integration risks
Write findings to: .vigilo/findings/{severity}/defi/
\\\`)
\`\`\`

**CRITICAL**: Auditors write attack scenarios only, NO PoC code.

### Wait and Collect

\`\`\`
for each task_id: background_output(task_id="...")
\`\`\`

**Advance state**: \`plan_complete_phase({ phase: "analysis" })\` (auto-advances to \`poc\`).

**Mark "analysis" as completed. IMMEDIATELY proceed to Phase 3.**

---

## Phase 3: PoC Validation (Sequential)

**Mark "poc" as in_progress.**

For each High/Medium finding:

1. Read finding from .vigilo/findings/{severity}/{auditor}/
2. Invoke Skill(vigilo:poc) with finding path
3. PoC generates test → \`test/poc/{Severity}-{id}-{title}.t.sol\`
4. Validation log → \`.vigilo/poc/{Severity}-{id}-{title}.md\`
5. Run forge test, handle failures (max 3 retries)
6. Validate: Test pass + assertions prove impact → VALIDATED

**File Naming Convention**: \`{Severity}-{id}-{kebab-case-title}\`
\`\`\`
Example for "H-01-donation-attack-inflated-collateral":
- Scenario:  .vigilo/findings/high/logic/H-01-donation-attack-inflated-collateral.md
- PoC Code:  test/poc/H-01-donation-attack-inflated-collateral.t.sol
- PoC Log:   .vigilo/poc/H-01-donation-attack-inflated-collateral.md
\`\`\`

**CRITICAL**: Test passing ≠ VALIDATED. PoC must prove the claimed impact.

**Advance state**: \`plan_complete_phase({ phase: "poc" })\` (auto-advances to \`report\`). Record each finding's validation outcome with \`plan_record_finding({ id, severity, status })\`.

**Mark "poc" as completed. IMMEDIATELY proceed to Phase 4.**

---

## Phase 4: Report Generation

**Mark "report" as in_progress.**

Invoke Skill(vigilo:report)

Generates submission-ready reports:
- .vigilo/reports/submissions/H-01-donation-attack-inflated-collateral.md
- .vigilo/reports/submissions/M-01-stale-price-check.md

Each report is copy-paste ready for target platform (default: Code4rena).

**Advance state**: \`plan_complete_phase({ phase: "report" })\` (marks the audit \`complete\`).

**Mark "report" as completed.**

---

## Iron Laws

| Rule | Description |
|------|-------------|
| **SCOPE FIRST** | Always check scope.txt before analyzing code |
| **NO POC WITHOUT SCENARIO** | Auditors write scenarios, main agent generates PoC |
| **TEST PASS ≠ VALIDATED** | PoC must prove claimed impact, not just pass |
| **AUTO-CONTINUE** | No waiting for user between phases |

---

## Final Report

\`\`\`
=== Audit Complete ===

Protocol: {name}
Type: {protocol_type}
Platform: {target_platform}

Findings:
  High: {N}
  Medium: {N}
  Low: {N}

Validated PoCs: {N}/{total}

Reports:
  .vigilo/reports/submissions/H-01-*.md
  .vigilo/reports/submissions/M-01-*.md
  ...

Ready for submission to {platform}.
\`\`\``
