import type { BuiltinSkill } from "./types"

// Auto-generated from SKILL.md files
// Run: bun scripts/convert-skills-to-inline.ts

const auditSkill: BuiltinSkill = {
  name: "audit",
  description: `Smart contract security audit orchestrator. Use when user says "audit", "security review", "find vulnerabilities", "Code4rena audit", or starts an audit workflow. Automatically executes all phases: scope → recon → analysis → PoC → report.`,
  template: `# Smart Contract Security Audit

Orchestrates the complete audit workflow from scope resolution to final report.

## Directory Structure

At audit start, create:

\`\`\`
.vigilo/
├── recon/
├── findings/
│   ├── high/
│   └── medium/
├── poc/
└── reports/
\`\`\`

---

## Workflow

\`\`\`
Phase 0        Phase 1           Phase 2          Phase 3    Phase 4
(scope)        (recon)           (audit)          (PoC)      (report)
   │              │                  │               │           │
   ▼              ▼                  ▼               ▼           ▼
 scope.txt ─→ explorator ──┐
              speculator ──┼─→ recon/*.md ─→ sub-auditors ─→ findings/ ─→ PoC ─→ report
                              │                (max 3 parallel)
                              └─ protocol type detected
\`\`\`

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

\`\`\`
1. Read("scope.txt") → If exists, use it
2. Else Read("README.md") → Extract scope section, create scope.txt
3. Else Auto-detect: Glob("src/**/*.sol"), exclude test/mock/lib
\`\`\`

See [scope-resolution.md](references/scope-resolution.md) for detailed logic.

**→ IMMEDIATELY proceed to Phase 1**

---

## Phase 1: Reconnaissance (Parallel)

Launch both agents in parallel:

\`\`\`
Task(subagent_type="explorator", prompt="Analyze code structure.")
Task(subagent_type="speculator", prompt="Analyze documentation.")
\`\`\`

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
\`\`\`
You are the reentrancy-auditor. Analyze for reentrancy vulnerabilities.

Read recon: .vigilo/recon/code-findings.md
Write findings to: .vigilo/findings/high/reentrancy/
\`\`\`

Launch all 3 auditors **in a single message** (parallel execution).

**CRITICAL**: Auditors write attack scenarios only, NO PoC code.

**Output:** .vigilo/findings/{severity}/{auditor}/

**→ IMMEDIATELY proceed to Phase 3 when all complete**

---

## Phase 3: PoC Validation (Sequential)

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
| [iron-laws.md](references/iron-laws.md) | All phases: Critical rules |`,
}

const code_analysisSkill: BuiltinSkill = {
  name: "code-analysis",
  description: `Auto-loaded by explorator agent during Audit Phase 1 (Reconnaissance). Provides methodology for: contract structure mapping, execution flow tracing, protocol type classification, and entry point identification. Output: .vigilo/recon/code-findings.md`,
  template: `# Code Reconnaissance Methodology

## Purpose

Rapidly understand **what the code does** through structural analysis and flow tracing.
This is reconnaissance, not vulnerability hunting.

---

## 1. File Discovery

### By Language

| Language | Find Files | Framework Markers |
|----------|------------|-------------------|
| Solidity | \`Glob("**/*.sol")\` | \`foundry.toml\`, \`hardhat.config.*\` |
| Rust | \`Glob("**/programs/**/*.rs")\` | \`Anchor.toml\`, \`Cargo.toml\` |
| Cairo | \`Glob("**/*.cairo")\` | \`Scarb.toml\` |
| Move | \`Glob("**/*.move")\` | \`Move.toml\` |

### Skip These
- \`test/\`, \`tests/\`, \`*.t.sol\`, \`*.test.sol\`
- \`mock/\`, \`mocks/\`, \`*Mock.sol\`
- \`node_modules/\`, \`lib/\` (dependencies)
- Generated/compiled files

---

## 2. Contract Structure Analysis

### For Each Contract, Extract:

\`\`\`
Contract: {Name}
File: {path}
Purpose: {one line description}
Inherits: {parent contracts}
Key State: {important state variables}
Entry Points: {external/public functions}
\`\`\`

### Inheritance Mapping

\`\`\`
BaseContract
├── ChildA
│   └── GrandchildA1
└── ChildB
\`\`\`

### External Dependencies

| Import | Type | Notes |
|--------|------|-------|
| @openzeppelin/... | Standard lib | Usually safe |
| @chainlink/... | Oracle | Price dependency |
| @uniswap/... | DEX integration | External call |

---

## 3. Flow Tracing

### The Core Question
**"How does value enter, move through, and exit this protocol?"**

### Entry Flows (How users put value in)

| Pattern | Function Names | What Happens |
|---------|---------------|--------------|
| Deposit | \`deposit\`, \`supply\`, \`provide\` | Assets in, receipts out |
| Stake | \`stake\`, \`lock\`, \`bond\` | Assets locked, tracking updated |
| Swap In | \`swap\`, \`exchange\` | Asset A in, Asset B out |
| Mint | \`mint\`, \`create\` | Payment in, tokens created |

### Internal Flows (How value transforms)

| Pattern | What to Look For |
|---------|------------------|
| Calculations | Fee deductions, interest accrual, share pricing |
| State Changes | Balance updates, position tracking |
| Internal Calls | Function-to-function flow within contract |
| External Calls | Interactions with other contracts |

### Exit Flows (How users get value out)

| Pattern | Function Names | What Happens |
|---------|---------------|--------------|
| Withdraw | \`withdraw\`, \`remove\`, \`redeem\` | Receipts burned, assets out |
| Unstake | \`unstake\`, \`unlock\`, \`unbond\` | Assets released |
| Claim | \`claim\`, \`harvest\`, \`collect\` | Rewards distributed |

### Privileged Flows (Admin operations)

| Pattern | Risk Level | What to Note |
|---------|------------|--------------|
| \`emergencyWithdraw\` | High | Can bypass normal checks |
| \`sweep\`, \`rescue\` | High | Can move arbitrary tokens |
| \`pause\`, \`unpause\` | Medium | Can halt operations |
| \`setFee\`, \`setRate\` | Medium | Can change economics |

---

## 4. Protocol Type Classification

### Identify by Code Patterns

| Protocol Type | Key Indicators | Main Flows |
|---------------|----------------|------------|
| **AMM/DEX** | \`reserve0\`, \`reserve1\`, \`k\`, \`swap()\`, \`addLiquidity()\` | swap, add/remove liquidity |
| **Lending** | \`borrow()\`, \`collateral\`, \`liquidate()\`, \`interestRate\` | supply, borrow, repay, liquidate |
| **Vault** | \`totalAssets()\`, \`totalSupply()\`, \`shares\`, ERC4626 | deposit, withdraw, yield |
| **Governance** | \`propose()\`, \`vote()\`, \`execute()\`, \`quorum\` | propose, vote, execute |
| **Staking** | \`stake()\`, \`rewards\`, \`epoch\`, \`rewardPerToken\` | stake, claim rewards |
| **Bridge** | \`lock()\`, \`mint()\`, \`relayMessage()\`, \`nonce\` | lock on L1, mint on L2 |

---

## 5. Asset Storage Patterns

### ETH Storage

\`\`\`solidity
// Direct balance
address(this).balance

// Wrapped
WETH.balanceOf(address(this))
\`\`\`

### Token Storage

\`\`\`solidity
// External balance check
IERC20(token).balanceOf(address(this))

// Internal accounting
mapping(address => uint256) balances;
uint256 totalDeposited;
\`\`\`

### Share/Receipt Tokens

\`\`\`solidity
// Protocol issues these
mapping(address => uint256) shares;
uint256 totalSupply;
function balanceOf(address) external view returns (uint256);
\`\`\`

---

## 6. Notable Patterns to Mark

Mark location only. No analysis needed - Phase 2 handles that.

| Pattern | Why Notable |
|---------|-------------|
| \`.call{value:}\` | External call with ETH |
| \`delegatecall\` | Code execution delegation |
| External contract calls | Trust boundary crossing |
| \`onlyOwner\`, \`onlyAdmin\` | Privileged operations |
| Oracle integration | External data dependency |
| Complex math | Potential calculation issues |
| Assembly blocks | Low-level operations |

---

## 7. Search Queries

### Find Entry Points

\`\`\`
Grep("function.*external|function.*public", glob="**/*.sol")
\`\`\`

### Find Asset Movements

\`\`\`
Grep("transfer\\\\(|transferFrom\\\\(|safeTransfer", glob="**/*.sol")
\`\`\`

### Find Privileged Functions

\`\`\`
Grep("onlyOwner|onlyAdmin|onlyRole|require.*msg\\\\.sender", glob="**/*.sol")
\`\`\`

### Find External Calls

\`\`\`
Grep("\\\\.call\\\\{|\\\\.delegatecall\\\\(|address\\\\(.*\\\\)\\\\..*\\\\(", glob="**/*.sol")
\`\`\`

---

## Output

Write findings to \`.vigilo/recon/code-findings.md\` following the format in
[template.md](template.md).

---

## Additional Resources

- [template.md](template.md) - Output template for code reconnaissance findings
- [examples/minimal-output.md](examples/minimal-output.md) - Minimal output example for small projects`,
}

const docs_analysisSkill: BuiltinSkill = {
  name: "docs-analysis",
  description: `Auto-loaded by speculator agent during Audit Phase 1 (Reconnaissance). Provides methodology for: documentation analysis, invariant extraction, trust assumption mapping, and protocol type classification from docs. Output: .vigilo/recon/docs-findings.md`,
  template: `# Documentation Reconnaissance Methodology

## Purpose

Rapidly understand **what the protocol should do** through documentation analysis.
This is reconnaissance, not code analysis.

---

## 1. Documentation Discovery

### Search Patterns

\`\`\`
Glob("**/README*")
Glob("**/*.md")
Glob("**/docs/**/*")
Glob("**/SECURITY*")
Glob("**/*.pdf")
\`\`\`

### Priority Order

| Priority | File | What to Extract |
|----------|------|-----------------|
| 1 | Root README | Project overview, quick start |
| 2 | docs/README.md | Documentation entry point |
| 3 | SECURITY.md | Security considerations, contacts |
| 4 | Whitepaper/spec | Formal specification |
| 5 | Audit reports | Known issues, past findings |

### Skip These
- Code files (\`.sol\`, \`.rs\`, etc.)
- Test documentation
- CI/CD configuration

---

## 2. The 4 Essential Questions

### Question 1: Where Is the Money?

| Asset Type | What to Look For |
|------------|------------------|
| Native tokens | ETH, MATIC, AVAX holdings |
| ERC20 tokens | USDC, USDT, DAI, protocol tokens |
| LP tokens | Uniswap, Curve, Balancer positions |
| NFTs | ERC721, ERC1155 assets |
| Shares/receipts | Vault shares, staked positions |

**Extract**: Which contracts hold assets, TVL mentions, treasury.

### Question 2: Who Can Move the Money?

**User Paths**:
| Action | Function Names |
|--------|---------------|
| Deposit | \`deposit()\`, \`stake()\`, \`supply()\`, \`mint()\` |
| Withdraw | \`withdraw()\`, \`unstake()\`, \`redeem()\`, \`burn()\` |

**Privileged Paths**:
| Action | Function Names | Risk Level |
|--------|---------------|------------|
| Emergency | \`emergencyWithdraw()\`, \`pause()\` | High |
| Recovery | \`sweep()\`, \`rescue()\`, \`skim()\` | High |
| Config | \`setFee()\`, \`setOracle()\`, \`upgradeTo()\` | Medium |

**Extract**: Function names, who can call, conditions.

### Question 3: What Invariants Must Hold?

**Explicit Invariants** - Keywords:
- "must", "always", "never", "guaranteed", "ensures"
- Mathematical relationships: \`x + y = z\`, \`a <= b * c\`
- NatSpec: \`@invariant\`, \`@notice\`

**Implicit Invariants** - By Protocol Type:

| Protocol Type | Common Invariant |
|---------------|------------------|
| Vault | \`totalAssets >= totalShares * minPrice\` |
| Lending | \`userDebt <= userCollateral * LTV\` |
| AMM | \`reserveX * reserveY >= k\` |
| Staking | \`sum(userStakes) == totalStaked\` |
| Bridge | \`mintedOnL2 == lockedOnL1\` |

Mark inferred invariants with \`[INFERRED]\`.

### Question 4: What Trust Assumptions Exist?

| Trusted Party | What They Control | Questions to Answer |
|--------------|-------------------|---------------------|
| Owner | Contract upgrades | Timelock? Multisig? |
| Admin | Parameter changes | Bounds? Frequency? |
| Oracle | Price feeds | Freshness? Backup? |
| Keeper | Liquidations | Incentives? Constraints? |

**Extract**: Who is trusted, for what, with what safeguards.

---

## 3. Protocol Type Classification

| Pattern in Docs | Protocol Type | Priority Vectors |
|-----------------|---------------|------------------|
| swap, liquidity, reserves | AMM/DEX | Price manipulation, sandwich |
| borrow, collateral, liquidate | Lending | Oracle manipulation, bad debt |
| deposit, shares, yield | Vault | Share inflation, first depositor |
| vote, propose, execute | Governance | Flash loan voting, timelock |
| lock, mint, bridge | Bridge | Double spend, replay |
| stake, reward, epoch | Staking | Reward calculation, timing |

---

## 4. Extraction Process

### Step 1: High-Level Understanding

Read overview documents to understand:
- Protocol purpose and value proposition
- Target users and use cases
- Integration with other protocols
- Economic model

### Step 2: Mechanism Analysis

For each mechanism described:
1. Identify inputs and outputs
2. Note preconditions and postconditions
3. Extract mathematical relationships
4. Identify external dependencies

### Step 3: Security Information

Look for:
- Security considerations sections
- Known limitations and risks
- Threat model descriptions
- Emergency procedures

### Step 4: Gap Identification

Note what's MISSING:
- Undefined edge cases
- Unclear trust assumptions
- Missing invariants
- Ambiguous specifications

---

## 5. Quality Assessment

| Rating | Criteria |
|--------|----------|
| Excellent | Complete invariants, clear trust model, all mechanisms documented |
| Good | Most information present, some inference needed |
| Adequate | Basic coverage, significant gaps |
| Poor | Minimal documentation, heavy inference required |
| Minimal | Almost no documentation |

---

## 6. Edge Cases

### Minimal Documentation
1. Note quality as "Poor" or "Minimal"
2. Flag ALL missing critical information
3. Infer what possible, mark as \`[INFERRED]\`
4. Recommend documentation improvements
5. Note increased audit risk

### Conflicting Information
1. Note the conflict explicitly
2. List all versions found
3. Flag for clarification
4. Do not assume which is correct

### Non-English Documentation
1. Note the language limitation
2. Extract what is possible
3. Flag for native speaker review

---

## Output

Write findings to \`.vigilo/recon/docs-findings.md\` following the format in
[\`template.md\`](template.md).

---

## Additional Resources

- [**\`template.md\`**](template.md) - Output template for documentation reconnaissance findings
- [**\`examples/minimal-output.md\`**](examples/minimal-output.md) - Minimal output example for sparse documentation`,
}

const pocSkill: BuiltinSkill = {
  name: "poc",
  description: `Generates and validates Foundry PoC tests from attack scenario documents. Use when: (1) Audit Phase 3 invokes Skill(vigilo:poc) for each High/Medium finding, (2) A finding at .vigilo/findings/ needs PoC validation, (3) Converting attack scenarios into executable Foundry tests. Outputs: test/poc/{finding-id}.t.sol, .vigilo/poc/ validation logs.`,
  template: `# PoC Generation & Validation

**Input**: \$ARGUMENTS (attack scenario file path)

---

# Part 1: PoC Code Generation

## Core Principle

\`\`\`
1 Attack Scenario = 1 PoC Code
\`\`\`

## Workflow

### 1. Read Attack Scenario

\`\`\`
Read(".vigilo/findings/{severity}/{auditor}/{Severity}-{id}-{title}.md")
\`\`\`

Example: \`.vigilo/findings/high/logic/H-01-donation-attack-inflated-collateral.md\`

Extract: Finding ID, Bug Class, Preconditions, Attack Steps, Impact, Vulnerable Code

### 2. Generate PoC

**File**: \`test/poc/{Severity}-{id}-{title}.t.sol\`

Example: \`test/poc/H-01-donation-attack-inflated-collateral.t.sol\`

**NOTE**: PoC code goes in \`test/poc/\` (project root), NOT in \`.vigilo/\` folder.

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract PoC_{ID}_{BugClass} is Test {
    // State variables, actors

    function setUp() public {
        // Reproduce preconditions
    }

    function test_Exploit_{ID}() public {
        // 1. Log initial state
        // 2. Execute attack steps
        // 3. Log final state
        // 4. Assert impact
    }
}
\`\`\`

### 3. PoC Checklist

- [ ] setUp(): Fully reproduce preconditions
- [ ] Actor labels: Use \`makeAddr()\` for all addresses
- [ ] console2.log: Output before/after attack state
- [ ] Attack steps: Follow scenario order exactly
- [ ] **Impact assertion: Directly prove scenario's claimed impact** (required)

### 4. Bug Class Patterns

Detailed templates: [references/poc-templates.md](references/poc-templates.md)

---

# Part 2: Foundry Validation

## Core Principle

\`\`\`
Test Pass ≠ Vulnerability Validated
\`\`\`

**Goal**: Verify that the Attack Scenario's claimed Impact actually occurs

## Workflow

### 1. Execute Test

\`\`\`bash
forge test --match-test "test_Exploit_{ID}" -vvv
\`\`\`

| Verbosity | Use Case |
|-----------|----------|
| \`-vvv\` | Default recommended |
| \`-vvvvv\` | Detailed debugging |

### 2. Analyze Results

| Result | Meaning | Action |
|--------|---------|--------|
| PASS + Impact proven | Vulnerability valid | → Complete |
| PASS + Impact unclear | Insufficient verification | → Strengthen assertions |
| FAIL | Issue occurred | → Fix PoC (max 3 attempts) |

### 3. Impact Verification

\`\`\`
Scenario Impact → Assertion Mapping
─────────────────────────────────────
"Vault drain"     → assertGt(attackerAfter, attackerBefore)
"Collateral loss" → assertLt(userAfter, userBefore)
"Admin bypass"    → assertTrue(attacker.hasRole(ADMIN))
\`\`\`

### 4. Modification Workflow

\`\`\`
Test failure or Impact mismatch
          ↓
    Fix PoC (max 3 attempts)
          ↓
    After 3 failures → Review Attack Scenario
          ↓
    If scenario needs update → Reverse-modify
\`\`\`

**If PoC validation differs from scenario, update Attack Scenario**:
- Expected profit ≠ actual profit → Update Impact numbers
- Additional precondition needed → Update Preconditions
- Exploit impossible → Downgrade severity or mark Invalid

### 5. Output

**Files** (use same naming format \`{Severity}-{id}-{title}\`):
\`\`\`
test/poc/H-01-donation-attack.t.sol            # PoC code (project root)
.vigilo/poc/H-01-donation-attack.md            # Validation log
.vigilo/findings/high/logic/H-01-donation-attack.md  # (Modified) Attack Scenario
\`\`\`

**Naming Convention**: \`{Severity}-{id}-{kebab-case-title}\`
- Same format across all three file types
- Makes it easy to track: scenario → PoC code → validation log

---

## Reference Files

| File | When to Load |
|------|--------------|
| [poc-templates.md](references/poc-templates.md) | When writing PoC - Bug class patterns |
| [debugging.md](references/debugging.md) | When test fails - Error resolution |`,
}

const lendingSkill: BuiltinSkill = {
  name: "lending",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing lending protocols. Provides patterns for: liquidation logic, interest rate models, collateral management, health factor calculations, bad debt handling. Core vulnerabilities: self-liquidation, precision loss, oracle manipulation, collateral factor attacks.`,
  template: `# Lending Protocol Patterns

This skill provides comprehensive knowledge for auditing DeFi lending protocols.

## Core Lending Concepts

| Concept | Description |
|---------|-------------|
| Collateral Factor | Max borrow % against collateral |
| Liquidation Threshold | Health level triggering liquidation |
| Utilization Rate | Borrowed / Total Supplied |
| Interest Rate | Function of utilization |
| Health Factor | Collateral value / Debt value |

---

## Liquidation Vulnerabilities

### 1. Profitable Self-Liquidation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Liquidator bonus too high
uint256 constant LIQUIDATION_BONUS = 15e16; // 15%

function liquidate(address user, uint256 repayAmount) external {
    // Attacker can:
    // 1. Borrow at 80% LTV
    // 2. Wait for tiny price drop
    // 3. Self-liquidate with 15% bonus
    // = Free 15% - (100% - 80%) = Net profit!
}
\`\`\`

**Check:** Liquidation bonus should be less than (100% - Max LTV).

### 2. Liquidation Cascade

\`\`\`solidity
// When one liquidation triggers another
// Large position liquidated → price drops → more liquidations

// Mitigations:
// - Gradual liquidation (partial)
// - Circuit breakers
// - Liquidation delays
\`\`\`

### 3. Bad Debt Accumulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No bad debt handling
function liquidate(address user) external {
    // If collateral < debt after liquidation
    // Bad debt remains in protocol
    // Eventually becomes insolvent
}

// SECURE: Handle underwater positions
function liquidate(address user) external {
    uint256 collateralValue = getCollateralValue(user);
    uint256 debtValue = getDebtValue(user);

    if (collateralValue < debtValue) {
        // Socialize bad debt or use insurance fund
        uint256 badDebt = debtValue - collateralValue;
        insuranceFund -= min(badDebt, insuranceFund);
    }
}
\`\`\`

---

## Interest Rate Model

### Standard Jump Rate Model

\`\`\`solidity
contract JumpRateModel {
    uint256 public baseRate;      // Rate at 0% utilization
    uint256 public multiplier;    // Rate increase per utilization
    uint256 public jumpMultiplier; // Rate increase above kink
    uint256 public kink;          // Utilization % where jump occurs

    function getBorrowRate(uint256 cash, uint256 borrows)
        public view returns (uint256)
    {
        uint256 utilization = borrows * 1e18 / (cash + borrows);

        if (utilization <= kink) {
            return baseRate + utilization * multiplier / 1e18;
        } else {
            uint256 normalRate = baseRate + kink * multiplier / 1e18;
            uint256 excessUtil = utilization - kink;
            return normalRate + excessUtil * jumpMultiplier / 1e18;
        }
    }
}
\`\`\`

### Interest Rate Vulnerabilities

**1. Rate Manipulation**
\`\`\`solidity
// Attacker can manipulate utilization
// 1. Flash loan large amount
// 2. Deposit → lower utilization → lower rates
// 3. Borrow at low rate
// 4. Withdraw and repay flash loan
\`\`\`

**2. Precision Loss**
\`\`\`solidity
// DANGEROUS: Interest rounds to 0 for small amounts
uint256 interest = principal * rate / SECONDS_PER_YEAR;
// If principal * rate < SECONDS_PER_YEAR, interest = 0

// SOLUTION: Accumulate interest with high precision
uint256 interestAccumulator; // Ray (1e27) precision
\`\`\`

---

## Collateral Vulnerabilities

### 1. Collateral Factor Changes

\`\`\`solidity
// DANGEROUS: Instant collateral factor reduction
function setCollateralFactor(address token, uint256 newFactor) external {
    collateralFactors[token] = newFactor;
    // Existing borrowers may become instantly liquidatable!
}

// SECURE: Grace period or gradual reduction
function setCollateralFactor(address token, uint256 newFactor) external {
    require(newFactor >= collateralFactors[token] - MAX_DECREASE);
    pendingFactors[token] = newFactor;
    factorEffectiveTime[token] = block.timestamp + TIMELOCK;
}
\`\`\`

### 2. Collateral Oracle Manipulation

\`\`\`solidity
// Collateral valued using manipulable oracle
// Attacker inflates collateral value → borrows more → profits
// See oracle vulnerability patterns
\`\`\`

### 3. Toxic Collateral

\`\`\`solidity
// Collateral that can't be liquidated:
// - Pausable tokens
// - Blacklistable tokens
// - Low liquidity tokens

// Mitigation: Whitelist collateral carefully
\`\`\`

---

## Borrowing Vulnerabilities

### 1. Borrow Cap Bypass

\`\`\`solidity
// VULNERABLE: Cap checked only on new borrows
function borrow(uint256 amount) external {
    require(totalBorrowed + amount <= borrowCap);
    // Interest accrual can push over cap!
}

// Check on any state-changing operation
\`\`\`

### 2. Same-Block Borrow-Repay

\`\`\`solidity
// EXPLOIT: Borrow and repay in same block
// No interest accrued = free leverage

function borrow(uint256 amount) external {
    require(lastBorrowBlock[msg.sender] < block.number);
    lastBorrowBlock[msg.sender] = block.number;
    // ...
}
\`\`\`

---

## Health Factor Calculations

### Standard Formula

\`\`\`
Health Factor = (Collateral Value × LTV) / Debt Value

Health Factor > 1: Safe
Health Factor < 1: Liquidatable
\`\`\`

### Vulnerabilities

**1. Stale Health Factor**
\`\`\`solidity
// DANGEROUS: Cached health factor
mapping(address => uint256) public healthFactors;

// Health factors become stale as prices change
// Always compute in real-time
\`\`\`

**2. Rounding Direction**
\`\`\`solidity
// SECURE: Round health factor DOWN (safer)
uint256 healthFactor = collateralValue * 1e18 / debtValue;

// Round debt UP when calculating
uint256 debt = (borrowed * (1e18 + interest) + 1e18 - 1) / 1e18;
\`\`\`

---

## Common AAVE/Compound Patterns

### Reserve Factor

\`\`\`solidity
// Protocol takes cut of interest
uint256 interestToProtocol = interest * reserveFactor / 1e18;
uint256 interestToSuppliers = interest - interestToProtocol;
\`\`\`

### Supply Index

\`\`\`solidity
// Track earnings per token
// supplyIndex increases as interest accrues
uint256 newIndex = oldIndex + (interest * 1e18 / totalSupply);

// User earnings = balance * (currentIndex - userIndex) / 1e18
\`\`\`

---

## Lending Audit Checklist

### Liquidation
- [ ] Liquidation bonus < (100% - max LTV)
- [ ] Bad debt handling exists
- [ ] Partial liquidation supported
- [ ] Liquidation can't be blocked (pausable tokens)
- [ ] Self-liquidation not profitable

### Interest
- [ ] Interest accrues correctly over time
- [ ] No precision loss on small amounts
- [ ] Rate manipulation resistance
- [ ] Compound interest handled

### Collateral
- [ ] Oracle is manipulation-resistant
- [ ] Collateral factor changes have timelock
- [ ] Collateral whitelist is reasonable
- [ ] Handles rebasing/weird tokens properly

### Health Factor
- [ ] Computed in real-time
- [ ] Rounding favors protocol safety
- [ ] Handles all edge cases (0 debt, 0 collateral)

### Access Control
- [ ] Only authorized can change parameters
- [ ] Emergency pause exists
- [ ] Parameter bounds enforced

## Severity Classification

### Critical
- Self-liquidation profitable
- Bad debt not handled
- Oracle manipulation allows draining

### High
- Interest precision loss
- Collateral factor instant changes
- Same-block manipulation

### Medium
- Missing borrow caps
- Liquidation can be blocked
- Rate model edge cases`,
}

const stakingSkill: BuiltinSkill = {
  name: "staking",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing staking mechanisms. Provides patterns for: reward-per-token accumulator (Synthetix style), lock periods, multi-reward tokens, boosted staking. Critical: precision loss, first staker advantage, late staker dilution, unstake reentrancy.`,
  template: `# Staking Protocol Patterns

This skill provides comprehensive knowledge for auditing DeFi staking and reward distribution mechanisms.

## Common Staking Patterns

### 1. Simple Staking (No Rewards)

\`\`\`solidity
contract SimpleStaking {
    mapping(address => uint256) public staked;

    function stake(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        staked[msg.sender] += amount;
    }

    function unstake(uint256 amount) external {
        require(staked[msg.sender] >= amount);
        staked[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
    }
}
\`\`\`

### 2. Reward Per Token Accumulator (Synthetix Style)

\`\`\`solidity
contract StakingRewards {
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        return rewardPerTokenStored +
            (rewardRate * (block.timestamp - lastUpdateTime) * 1e18 / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return (balanceOf[account] *
            (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) +
            rewards[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
}
\`\`\`

---

## Reward Distribution Vulnerabilities

### 1. Precision Loss

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Low precision accumulator
function rewardPerToken() public view returns (uint256) {
    // If rewardRate * timeDelta < totalSupply, result is 0!
    return rewardPerTokenStored +
        (rewardRate * (block.timestamp - lastUpdateTime) / totalSupply);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use high precision (1e18 or 1e27)
function rewardPerToken() public view returns (uint256) {
    return rewardPerTokenStored +
        (rewardRate * (block.timestamp - lastUpdateTime) * 1e18 / totalSupply);
}
\`\`\`

### 2. First Staker Advantage

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: First staker gets all pending rewards
function stake(uint256 amount) external {
    // If totalSupply was 0, rewardPerTokenStored didn't update
    // First staker claims all rewards since lastUpdateTime
    _updateReward(msg.sender);
    // ...
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function stake(uint256 amount) external {
    _updateReward(msg.sender);
    // If first staker, reset lastUpdateTime
    if (totalSupply == 0) {
        lastUpdateTime = block.timestamp;
    }
    // ...
}
\`\`\`

### 3. Late Staker Dilution Attack

\`\`\`
1. Attacker waits for rewards to accumulate
2. Stakes large amount just before reward distribution
3. Claims disproportionate rewards
4. Unstakes immediately

Mitigation: Time-weighted rewards or lock periods
\`\`\`

### 4. Reward Calculation Overflow

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Can overflow with large values
uint256 pending = balance * rewardPerToken / 1e18;
// If balance and rewardPerToken are both large...
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use mulDiv to avoid overflow
uint256 pending = FullMath.mulDiv(balance, rewardPerToken, 1e18);
\`\`\`

---

## Lock Period Vulnerabilities

### 1. Lockup Bypass

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Lock only checked on unstake
function unstake(uint256 amount) external {
    require(block.timestamp >= lockEnd[msg.sender], "Locked");
    // But user can transfer stake tokens!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Non-transferable during lock, or track per-deposit locks
function _beforeTokenTransfer(address from, address to, uint256) internal {
    if (from != address(0) && to != address(0)) {
        require(block.timestamp >= lockEnd[from], "Locked");
    }
}
\`\`\`

### 2. Lock Extension Manipulation

\`\`\`solidity
// If lock period extends on additional stake
// User might be tricked into longer lock than expected

// Always show clear lock end time before stake
\`\`\`

---

## Unstaking Vulnerabilities

### 1. Unstake Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Reward sent before state update
function unstake(uint256 amount) external {
    uint256 reward = earned(msg.sender);
    rewardToken.transfer(msg.sender, reward); // External call!
    balances[msg.sender] -= amount; // State update after
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function unstake(uint256 amount) external nonReentrant {
    uint256 reward = earned(msg.sender);
    balances[msg.sender] -= amount; // State first
    rewards[msg.sender] = 0;
    rewardToken.transfer(msg.sender, reward);
    stakedToken.transfer(msg.sender, amount);
}
\`\`\`

### 2. Dust Stuck in Contract

\`\`\`solidity
// Rounding can leave tiny amounts stuck
// Ensure users can withdraw their full balance

function unstake(uint256 amount) external {
    if (amount == type(uint256).max) {
        amount = balances[msg.sender];
    }
    // ...
}
\`\`\`

---

## Multi-Reward Token Patterns

### Multiple Reward Accumulators

\`\`\`solidity
contract MultiRewards {
    struct Reward {
        uint256 rewardPerTokenStored;
        uint256 rewardRate;
        uint256 lastUpdateTime;
    }

    mapping(address => Reward) public rewardData;
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

    function earned(address account, address rewardToken)
        public view returns (uint256)
    {
        // Similar to single reward but per token
    }
}
\`\`\`

### Vulnerability: Different Update Frequencies

\`\`\`solidity
// If reward tokens update at different times
// Can lead to incorrect calculations

// Always update ALL reward tokens together
modifier updateRewards(address account) {
    for (uint i = 0; i < rewardTokens.length; i++) {
        _updateReward(rewardTokens[i], account);
    }
    _;
}
\`\`\`

---

## Boosted Staking

### veToken / Gauge Patterns

\`\`\`solidity
// Boost based on lock duration
function getBoost(address user) public view returns (uint256) {
    uint256 lockDuration = lockEnd[user] - block.timestamp;
    return 1e18 + (lockDuration * maxBoost / maxLockDuration);
}

function earned(address user) public view returns (uint256) {
    uint256 boost = getBoost(user);
    return baseEarned(user) * boost / 1e18;
}
\`\`\`

### Boost Manipulation

\`\`\`solidity
// Attacker repeatedly extends lock to maintain boost
// While others with same stake earn less

// Mitigation: Time-averaged boost or snapshot boost
\`\`\`

---

## Staking Audit Checklist

### Reward Calculation
- [ ] High precision used (1e18 minimum)
- [ ] No overflow in multiplication
- [ ] Division before multiplication avoided
- [ ] Zero totalSupply handled

### First/Late Staker
- [ ] First staker doesn't get all pending rewards
- [ ] Late staker can't dilute existing stakers unfairly
- [ ] Rewards accrue correctly when totalSupply changes

### Lock Periods
- [ ] Lock enforced on transfers (not just unstake)
- [ ] Lock extension clearly communicated
- [ ] No lock bypass via stake token transfer

### Reentrancy
- [ ] CEI pattern followed
- [ ] nonReentrant modifier on sensitive functions
- [ ] State updated before external calls

### Edge Cases
- [ ] Zero stake amount handled
- [ ] Full unstake (max amount) works
- [ ] Dust doesn't get stuck
- [ ] Reward period end handled

### Multi-Reward
- [ ] All reward tokens update together
- [ ] Adding/removing reward tokens safe
- [ ] Different decimals handled

## Severity Classification

### Critical
- Reentrancy on unstake/claim
- First staker steals all rewards
- Precision loss loses significant value

### High
- Lock bypass possible
- Late staker dilution attack
- Reward overflow

### Medium
- Dust stuck in contract
- Boost manipulation
- Reward token update desync`,
}

const vault_erc4626Skill: BuiltinSkill = {
  name: "vault-erc4626",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing ERC4626 vaults. Provides patterns for: share/asset conversion, inflation attack mitigations, rounding direction rules, donation attacks. Critical: first depositor attack, virtual shares offset, dead shares burning.`,
  template: `# ERC4626 Vault Patterns

This skill provides comprehensive knowledge for auditing ERC4626 tokenized vaults.

## ERC4626 Overview

ERC4626 standardizes tokenized vaults:
- Deposit assets → receive shares
- Shares represent proportional ownership
- Redeem shares → receive assets

\`\`\`
shares = assets × totalSupply / totalAssets
assets = shares × totalAssets / totalSupply
\`\`\`

---

## Inflation Attack (First Depositor Attack)

### The Attack

\`\`\`
1. Vault is empty (totalSupply = 0, totalAssets = 0)
2. Attacker deposits 1 wei → gets 1 share
3. Attacker donates 1e18 tokens directly to vault
4. Now: totalSupply = 1, totalAssets = 1e18 + 1
5. Victim deposits 2e18 tokens
6. Victim gets: 2e18 × 1 / (1e18 + 1) = 1 share (rounds down!)
7. Attacker and victim each have 1 share
8. Attacker redeems: gets half of 3e18 + 1 = 1.5e18 tokens
9. Attacker profit: ~0.5e18 tokens stolen from victim
\`\`\`

### Vulnerable Pattern

\`\`\`solidity
// DANGEROUS: No inflation protection
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = totalSupply() == 0
        ? assets
        : assets * totalSupply() / totalAssets();

    _mint(msg.sender, shares);
    asset.transferFrom(msg.sender, address(this), assets);
}
\`\`\`

### Mitigation 1: Virtual Shares/Assets

\`\`\`solidity
// Add virtual offset to prevent manipulation
uint256 constant VIRTUAL_SHARES = 1e3;
uint256 constant VIRTUAL_ASSETS = 1;

function totalSupply() public view override returns (uint256) {
    return super.totalSupply() + VIRTUAL_SHARES;
}

function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this)) + VIRTUAL_ASSETS;
}
\`\`\`

### Mitigation 2: Dead Shares (Burn on First Deposit)

\`\`\`solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = _convertToShares(assets);

    if (totalSupply() == 0) {
        // Burn first 1000 shares to dead address
        uint256 deadShares = 1000;
        _mint(address(0xdead), deadShares);
        shares -= deadShares;
    }

    _mint(msg.sender, shares);
    asset.transferFrom(msg.sender, address(this), assets);
}
\`\`\`

### Mitigation 3: Minimum Deposit

\`\`\`solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    require(assets >= MIN_DEPOSIT, "Below minimum");
    // ...
}
\`\`\`

---

## Rounding Direction

### The Rule

| Operation | Round | Reason |
|-----------|-------|--------|
| deposit | shares DOWN | User gets less shares |
| mint | assets UP | User pays more |
| withdraw | shares UP | User burns more |
| redeem | assets DOWN | User gets less |

**Always round in favor of the vault (against the user).**

### Implementation

\`\`\`solidity
// Round DOWN (default)
function _convertToShares(uint256 assets) internal view returns (uint256) {
    uint256 supply = totalSupply();
    return supply == 0 ? assets : assets * supply / totalAssets();
}

// Round UP
function _convertToSharesRoundUp(uint256 assets) internal view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return assets;
    return (assets * supply + totalAssets() - 1) / totalAssets();
}
\`\`\`

### Vulnerable Pattern

\`\`\`solidity
// DANGEROUS: Wrong rounding direction
function withdraw(uint256 assets) public returns (uint256 shares) {
    // Should round UP, but rounds DOWN
    shares = assets * totalSupply() / totalAssets();
    // Attacker can withdraw dust repeatedly, extracting value
}
\`\`\`

---

## Donation Attack

### The Attack

\`\`\`
1. Attacker deposits normally, gets shares
2. Attacker donates assets directly to vault (not through deposit)
3. Share price increases
4. Attacker has fewer shares but same value
5. Other share calculations become incorrect
\`\`\`

### Vulnerable Scenarios

\`\`\`solidity
// If vault uses asset balance directly
function totalAssets() public view returns (uint256) {
    return asset.balanceOf(address(this)); // Manipulable!
}

// If reward distribution based on balance
function distribute() external {
    uint256 rewards = asset.balanceOf(address(this)) - lastBalance;
    // Donated amount included in rewards!
}
\`\`\`

### Mitigations

\`\`\`solidity
// Track assets internally
uint256 internal _totalAssets;

function deposit(uint256 assets) public {
    // ...
    _totalAssets += assets;
}

function totalAssets() public view returns (uint256) {
    return _totalAssets; // Not manipulable
}
\`\`\`

---

## Share Calculation Edge Cases

### Zero Total Supply

\`\`\`solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    uint256 supply = totalSupply();
    // Handle first deposit
    return supply == 0 ? assets : assets * supply / totalAssets();
}
\`\`\`

### Zero Total Assets

\`\`\`solidity
// Can happen after total withdrawal or loss event
function convertToAssets(uint256 shares) public view returns (uint256) {
    uint256 assets = totalAssets();
    // Avoid division by zero
    return assets == 0 ? shares : shares * assets / totalSupply();
}
\`\`\`

### Very Small Amounts

\`\`\`solidity
// 1 wei deposit might get 0 shares due to rounding
uint256 shares = 1 * totalSupply / totalAssets; // Could be 0!

// Mitigation: Minimum deposit requirement
require(shares > 0, "Deposit too small");
\`\`\`

---

## maxDeposit / maxWithdraw

### Standard Implementation

\`\`\`solidity
function maxDeposit(address) public view returns (uint256) {
    // Consider:
    // - Deposit caps
    // - Available capacity
    // - User-specific limits
    return type(uint256).max; // Or actual limit
}

function maxWithdraw(address owner) public view returns (uint256) {
    // Consider:
    // - Owner's balance
    // - Available liquidity
    // - Withdrawal limits
    return convertToAssets(balanceOf(owner));
}
\`\`\`

### Vulnerabilities

\`\`\`solidity
// DANGEROUS: maxDeposit doesn't account for cap
function maxDeposit(address) public view returns (uint256) {
    return type(uint256).max; // But there's actually a cap!
}

// User calls deposit with max, expecting it to work
// Transaction reverts unexpectedly
\`\`\`

---

## Yield Source Integration

### External Yield Vaults

\`\`\`solidity
contract YieldVault is ERC4626 {
    IYieldSource public yieldSource;

    function totalAssets() public view override returns (uint256) {
        // Include yield from external source
        return asset.balanceOf(address(this)) +
               yieldSource.balanceOf(address(this));
    }

    // Risk: External yield source could be manipulated
    // Risk: External protocol could pause/fail
}
\`\`\`

---

## ERC4626 Audit Checklist

### Inflation Attack
- [ ] Virtual shares/assets implemented
- [ ] OR dead shares burned on first deposit
- [ ] OR minimum deposit enforced
- [ ] First depositor cannot profit from donation

### Rounding
- [ ] deposit: shares round DOWN
- [ ] mint: assets round UP
- [ ] withdraw: shares round UP
- [ ] redeem: assets round DOWN
- [ ] All conversions favor vault

### Edge Cases
- [ ] Zero totalSupply handled
- [ ] Zero totalAssets handled
- [ ] Very small deposits handled
- [ ] Very small withdrawals handled

### Limits
- [ ] maxDeposit returns accurate limit
- [ ] maxMint returns accurate limit
- [ ] maxWithdraw considers liquidity
- [ ] maxRedeem considers liquidity

### Integration
- [ ] totalAssets cannot be manipulated
- [ ] Donations don't break accounting
- [ ] External yield properly accounted

## Severity Classification

### Critical
- First depositor inflation attack
- Wrong rounding direction
- totalAssets manipulable

### High
- Donation breaks reward distribution
- maxDeposit/maxWithdraw incorrect
- Zero supply/assets crashes

### Medium
- Minimum deposit not enforced
- Edge case precision loss
- Missing slippage protection`,
}

const reportSkill: BuiltinSkill = {
  name: "report",
  description: `Generates submission-ready audit reports from validated findings. Use when: (1) Audit Phase 4 invokes Skill(vigilo:report) after PoC validation completes, (2) Findings need to be formatted for Code4rena, Cantina, Sherlock, or Immunefi submission, (3) Generating executive summary or individual submission reports. Default format: Code4rena. Reads from .vigilo/findings/ and poc/.`,
  template: `# Audit Report Generation

## Purpose

Generate professional security audit reports following industry standards from platforms like
Code4rena, Cantina, Sherlock, and Immunefi.

---

## Supported Platforms

| Platform | Use Case | Format |
|----------|----------|--------|
| **Code4rena** | Competitive audits | Markdown with specific sections |
| **Cantina** | Managed reviews | PDF-style structured report |
| **Sherlock** | Contest submissions | GitHub issue format |
| **Immunefi** | Bug bounty submissions | Dashboard submission format |
| **Standard** | General purpose | Comprehensive markdown |

---

## Data Flow (Option B - Immutable Drafts)

\`\`\`
.vigilo/findings/    ← Sub-auditor drafts (IMMUTABLE)
         +
.vigilo/poc/         ← PoC validation logs
         ↓
.vigilo/reports/submissions/  ← Final submission-ready reports
\`\`\`

**Key Principle**: Original findings are preserved as audit trail. Final reports are synthesized from findings + PoC validation.

---

## Workflow

### Step 1: Collect Data Sources

\`\`\`
# Sub-auditor draft findings
Glob(".vigilo/findings/**/*.md")

# PoC validation results
Glob(".vigilo/poc/*.md")

# Actual PoC code
Glob("test/poc/*.t.sol")
\`\`\`

### Step 2: Filter by Validation Status

| Status | Action |
|--------|--------|
| \`VALIDATED\` | Generate submission report |
| \`NEEDS_REVIEW\` | Include in separate "Unconfirmed" section |
| \`INVALIDATED\` | Exclude (false positive) |

### Step 3: Select Platform

1. Check user-specified platform
2. **Default: Code4rena** format (most common)

| Platform | Template |
|----------|----------|
| Code4rena (default) | [templates/code4rena.md](templates/code4rena.md) |
| Cantina | [templates/cantina.md](templates/cantina.md) |
| Sherlock | [templates/sherlock.md](templates/sherlock.md) |
| Immunefi | [templates/immunefi.md](templates/immunefi.md) |
| Standard | [templates/standard.md](templates/standard.md) |

### Step 4: Generate Submission Reports

For each VALIDATED finding, create submission-ready report:

**Filename format**: \`{Severity}-{id}-{kebab-case-title}.md\`

\`\`\`
.vigilo/reports/submissions/H-01-donation-attack-inflated-collateral.md
\`\`\`

**Each submission report MUST include:**

1. **Refined Attack Scenario** - Updated based on PoC validation
2. **Validated PoC Code** - INLINE (not just reference)
3. **Proof of Impact** - Console output showing actual exploit
4. **Platform-specific formatting**

### Step 5: Write Outputs

\`\`\`
.vigilo/reports/
├── {date}_{platform}_audit.md      # Executive summary
└── submissions/
    ├── H-01-donation-attack-inflated-collateral.md   # Ready to submit
    ├── H-02-reentrancy-callback-drain.md
    ├── M-01-stale-price-check.md
    └── QA-report.md
\`\`\`

---

## Submission Report Template

Each \`submissions/{finding-id}.md\` must be **immediately submittable**:

\`\`\`markdown
# [H-01] Title Describing Vulnerability

## Summary
One-sentence description of the issue.

## Vulnerability Detail
Technical explanation of the vulnerability.
- Root cause
- Affected functions
- Attack vector

## Impact
Qualitative impact description (NO dollar amounts).

## Proof of Concept

\\\`\\\`\\\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract PoC_H01 is Test {
    function test_Exploit() public {
        // Full PoC code here - INLINE
        // Not just a file reference
    }
}
\\\`\\\`\\\`

**Execution:**
\\\`\\\`\\\`bash
forge test --match-test test_Exploit -vvv
\\\`\\\`\\\`

**Output:**
\\\`\\\`\\\`
[PASS] test_Exploit()
  Attacker balance before: 1 ETH
  Attacker balance after: 101 ETH
  Profit: 100 ETH
\\\`\\\`\\\`

## Recommendation
Specific fix with code example.
\`\`\`

---

## Severity Classification

All platforms use similar severity levels with slight variations:

| Vigilo | Code4rena | Cantina | Sherlock | Immunefi |
|--------|-----------|---------|----------|----------|
| Critical | High (3) | Critical | High | Critical |
| High | High (3) | High | High | High |
| Medium | Medium (2) | Medium | Medium | Medium |
| Low | Low (QA) | Low | Low | Low |
| Informational | QA | Informational | Informational | Informational |
| Gas | Gas | Gas Optimization | - | Gas Optimization |

See \`references/severity-classification.md\` for detailed criteria.

---

## Output Structure

### Report File Naming

\`\`\`
.vigilo/reports/{YYYY_MM_DD_HHMM}_{platform}_audit.md
\`\`\`

Examples:
- \`2026_01_20_1430_code4rena_audit.md\`
- \`2026_01_20_1430_standard_audit.md\`

### Individual Finding Export

For contest submissions, also export individual findings:

**Filename format**: \`{Severity}-{id}-{kebab-case-title}.md\`

\`\`\`
.vigilo/reports/submissions/
├── H-01-donation-attack-inflated-collateral.md
├── H-02-reentrancy-callback-drain.md
├── M-01-stale-price-check.md
└── QA-report.md
\`\`\`

---

## Submission Quality Checklist

**Before marking a report as ready to submit:**

### Content Requirements
- [ ] Attack scenario refined based on PoC validation
- [ ] PoC code is **INLINE** (not just file reference)
- [ ] PoC output proves the claimed impact
- [ ] Impact is qualitative (NO dollar amounts)
- [ ] Recommendation includes specific code fix

### Platform Compliance
- [ ] Follows exact platform template structure
- [ ] Severity mapped to platform standard
- [ ] Title format matches platform convention
- [ ] All required sections present

### Submission Readiness
- [ ] Can be copy-pasted directly to platform
- [ ] No placeholder text remaining
- [ ] No internal notes or TODOs
- [ ] forge test command and output included

**If any checkbox fails → NOT ready for submission**

---

## Additional Resources

### Templates (Load based on target platform)

| Template | When to Load |
|----------|--------------|
| [code4rena.md](templates/code4rena.md) | **Default** - When submitting to Code4rena contests |
| [sherlock.md](templates/sherlock.md) | When submitting to Sherlock contests |
| [cantina.md](templates/cantina.md) | When submitting to Cantina reviews |
| [immunefi.md](templates/immunefi.md) | When submitting to Immunefi bug bounties |
| [standard.md](templates/standard.md) | For general/private audit reports |

### References (Load on demand)

| File | When to Load |
|------|--------------|
| [severity-classification.md](references/severity-classification.md) | When determining severity - contains platform-specific criteria |

### External References (For validation)

- [Code4rena Reports](https://code4rena.com/reports) - Reference for report format
- [Solodit Database](https://solodit.cyfrin.io) - Cross-reference similar findings`,
}

const access_controlSkill: BuiltinSkill = {
  name: "access-control",
  description: `Auto-loaded by access-control-auditor agent during Phase 2. Provides detection patterns for: missing modifiers, privilege escalation, tx.origin phishing, OR/AND logic errors, missing two-step transfer. Core artifact: Permission Matrix.`,
  template: `# Access Control Vulnerability Analysis

**2025 Statistics**: Access Control is **#1 vulnerability class** with **\$953.2M in losses**.

---

## Why Access Control Bugs Happen (Root Causes)

Understanding root causes helps detect vulnerabilities more effectively.

### Root Cause 1: Intent-Implementation Gap

Developer thinks "only admin can call this" but forgets to add modifier.

\`\`\`solidity
// Developer INTENDED: only admin
// ACTUAL: anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit No modifier!
}
\`\`\`

**Detection**: Find external/public functions without modifiers, then verify intent.

### Root Cause 2: Visibility ≠ Permission

\`external\`/\`public\` means "anyone can call" - not a permission system.

\`\`\`solidity
// Visibility is NOT access control
function withdraw() public {  // @audit public ≠ "user's own funds"
    // Without checks, ANYONE withdraws ANYONE's funds
}
\`\`\`

**Detection**: Every state-changing external/public function needs explicit permission checks.

### Root Cause 3: Undefined Trust Boundary

Who is "admin"? What can they do? Often undocumented.

\`\`\`solidity
// VULNERABLE: Admin powers undefined
function emergencyWithdraw() external onlyAdmin {
    // Can admin steal all user funds?
    // Is this documented? Intended?
}
\`\`\`

**Detection**: Map all admin powers. Flag undocumented capabilities as centralization risks.

### Root Cause 4: Broken Permission Hierarchy

Admin can create admins → single key compromise = total system takeover.

\`\`\`solidity
// VULNERABLE: Flat admin hierarchy
function addAdmin(address newAdmin) external onlyAdmin {
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}
\`\`\`

**Detection**: Trace role grant paths. Flag self-granting or circular hierarchies.

---

## The Permission Matrix (Core Artifact)

Build this for every contract:

| Contract | Function | Sensitivity | Required Role | Actual Check | Gap? |
|----------|----------|-------------|---------------|--------------|------|
| Vault | withdraw | CRITICAL | User (own funds) | None | **YES** |
| Vault | setFee | HIGH | Admin | onlyOwner | No |
| Vault | pause | HIGH | Guardian | onlyAdmin | **WRONG ROLE** |
| Token | mint | CRITICAL | Minter | None | **YES** |

### Sensitivity Classification

| Level | Examples | Impact if Missing |
|-------|----------|-------------------|
| **CRITICAL** | withdraw, transfer, mint, upgrade | Direct fund loss |
| **HIGH** | pause, setFee, setOracle | Protocol malfunction |
| **MEDIUM** | setParameter, whitelist | Degraded operation |
| **LOW** | view, pure functions | Information leak |

---

## Detection Patterns

### Pattern 1: Missing Access Control

**Root Cause**: Intent-Implementation Gap

\`\`\`solidity
// VULNERABLE: Anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit Anyone can manipulate price!
}

function withdrawAll() external {
    payable(msg.sender).transfer(address(this).balance);  // @audit No modifier!
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("function.*external(?!.*view)(?!.*pure)", glob="**/*.sol")
Grep("function.*public(?!.*view)(?!.*pure)", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Does this function modify state?
- Is there a modifier or require statement?
- What is the intended caller?

### Pattern 2: Privilege Escalation

**Root Cause**: Broken Permission Hierarchy

\`\`\`solidity
// VULNERABLE: Admin can add arbitrary admins
function addAdmin(address newAdmin) external {
    require(admins[msg.sender], "Not admin");
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}

// VULNERABLE: Self-grant role
function grantRole(bytes32 role, address account) public {
    _grantRole(role, account);  // @audit No permission check!
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("grantRole|addAdmin|setAdmin", glob="**/*.sol")
Grep("_setupRole|_grantRole", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Can a role grant itself or other roles?
- Is there a role hierarchy (admin > moderator > user)?
- What happens if the top role is compromised?

### Pattern 3: tx.origin Phishing

**Root Cause**: Confusing transaction origin with message sender

\`\`\`solidity
// VULNERABLE: Phishing via malicious contract
function withdraw() external {
    require(tx.origin == owner);  // @audit Phishing target!
    // Attacker tricks owner to call malicious contract
    // Malicious contract calls this function
    // tx.origin is still owner!
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("tx\\\\.origin", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Is tx.origin used for authorization?
- Can an attacker trick the owner into calling a malicious contract?

### Pattern 4: Incorrect Permission Logic (OR vs AND)

**Root Cause**: Logic error in permission checks

\`\`\`solidity
// VULNERABLE: Should be AND, not OR
function sensitiveAction() external {
    require(hasRole(ADMIN) || hasRole(GUARDIAN));  // @audit OR allows either
    // Should require BOTH roles for high-sensitivity actions
}

// Also check for inverted logic
function withdraw() external {
    require(!blacklisted[msg.sender]);  // What if blacklist is empty?
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("require.*\\\\|\\\\|", glob="**/*.sol")
Grep("require.*&&", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Should this be AND or OR?
- What is the minimum permission needed?
- Can the condition be bypassed?

### Pattern 5: Missing Two-Step Transfer

**Root Cause**: No confirmation for critical ownership changes

\`\`\`solidity
// VULNERABLE: Single transaction transfer
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;  // @audit Typo in address = permanent loss
}

// SECURE: Two-step pattern
function transferOwnership(address newOwner) external onlyOwner {
    pendingOwner = newOwner;
}
function acceptOwnership() external {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("transferOwnership|changeOwner|setOwner", glob="**/*.sol")
Grep("pendingOwner|acceptOwnership", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Is ownership transfer single-step or two-step?
- What happens if wrong address is provided?
- Is there a timelock for ownership changes?

### Pattern 6: Role Hierarchy Exploitation (OpenZeppelin)

**Root Cause**: Misunderstanding of AccessControl patterns

\`\`\`solidity
// VULNERABLE: DEFAULT_ADMIN_ROLE can grant any role
// If compromised, attacker controls everything
contract Vault is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        // @audit DEFAULT_ADMIN_ROLE can grant ADMIN_ROLE to anyone
    }
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("DEFAULT_ADMIN_ROLE|AccessControl", glob="**/*.sol")
Grep("_setRoleAdmin|getRoleAdmin", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Who holds DEFAULT_ADMIN_ROLE?
- Is there a two-step admin transfer?
- Can admin roles be renounced?

---

## Line-by-Line Verification Checklist

For each external/public function:

- [ ] Does this function modify state?
- [ ] Is there a modifier applied?
- [ ] Does the modifier check the correct role?
- [ ] Can the require/revert condition be bypassed?
- [ ] Who is the intended caller? Is this documented?
- [ ] What is the worst case if anyone can call this?

---

## Centralization Risk Assessment

Document admin powers that can harm users:

| Admin Power | Risk Level | Impact |
|-------------|------------|--------|
| Pause withdrawals | High | Users locked out |
| Change fee to 100% | Critical | Rug pull |
| Upgrade implementation | Critical | Arbitrary code execution |
| Mint unlimited tokens | Critical | Inflation attack |
| Whitelist addresses | Medium | Censorship |
| Change oracle | Critical | Price manipulation |

**Flag as finding if**:
- Power is undocumented
- No timelock protection
- Single key (not multisig)

---

## Search Query Reference

\`\`\`
# Find all entry points
Grep("function.*external|function.*public", glob="**/*.sol")

# Find modifiers
Grep("modifier\\\\s+\\\\w+", glob="**/*.sol")
Grep("onlyOwner|onlyAdmin|only\\\\w+", glob="**/*.sol")

# Find role management
Grep("grantRole|revokeRole|renounceRole", glob="**/*.sol")
Grep("transferOwnership|acceptOwnership", glob="**/*.sol")

# Find dangerous patterns
Grep("tx\\\\.origin", glob="**/*.sol")
Grep("selfdestruct|delegatecall", glob="**/*.sol")
\`\`\`

---

## Rationalization Table (Reject These Excuses)

| Excuse | Reality |
|--------|---------|
| "It's an internal function" | Internal functions can be called via public entry points |
| "Only admin can call this" | Admin keys get compromised; document the risk |
| "This is by design" | Document it as centralization risk if undocumented |
| "Low likelihood" | Access control bugs caused \$953M in losses |
| "I'll check later" | Check NOW or miss critical vulnerabilities |
| "The modifier exists somewhere" | Verify it's actually applied to THIS function |
| "Frontend prevents this" | On-chain must be secure standalone |`,
}

const cross_chainSkill: BuiltinSkill = {
  name: "cross-chain",
  description: `Auto-loaded by cross-chain-auditor agent during Phase 2. Provides detection patterns for: missing source chain/address validation, replay attacks, message ordering, chain-specific code, finality assumptions. Core artifact: Cross-Chain Message Flow diagram.`,
  template: `# Cross-Chain Vulnerability Patterns

This skill provides comprehensive knowledge for identifying cross-chain and bridge vulnerabilities in smart contracts.

## Overview

Cross-chain communication introduces trust assumptions at chain boundaries. Message verification is the entire security model - if messages can be forged or replayed, billions can be stolen.

## Historical Context

| Hack | Loss | Root Cause |
|------|------|------------|
| Ronin Bridge | \$624M | Compromised validators |
| Wormhole | \$326M | Signature verification bypass |
| Nomad | \$190M | Initialization bug allowed fake proofs |
| Harmony Horizon | \$100M | Compromised validators |

---

## Vulnerability Categories

### 1. Missing Source Chain Validation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Accepts from any chain
function receiveMessage(bytes calldata payload) external {
    // No srcChainId check!
    (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
    token.mint(recipient, amount);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function receiveMessage(uint16 srcChainId, bytes calldata payload) external {
    require(msg.sender == trustedEndpoint, "Invalid endpoint");
    require(srcChainId == ALLOWED_SOURCE_CHAIN, "Invalid source chain");
    // Process...
}
\`\`\`

**Detection:**
\`\`\`
Grep("receiveMessage|onMessage|handleMessage", glob="**/*.sol")
\`\`\`
Check if srcChainId is validated.

---

### 2. Missing Source Address Validation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Accepts from any address on source chain
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external {
    require(msg.sender == lzEndpoint);
    require(_srcChainId == trustedChain);
    // Missing: _srcAddress validation!
    _processPayload(_payload);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external {
    require(msg.sender == lzEndpoint, "Invalid endpoint");
    require(_srcChainId == trustedChain, "Invalid chain");
    require(
        keccak256(_srcAddress) == keccak256(abi.encodePacked(trustedRemote)),
        "Invalid source"
    );
    _processPayload(_payload);
}
\`\`\`

---

### 3. Replay Attacks

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No nonce tracking
function processMessage(bytes32 messageId, bytes calldata data) external {
    // Can be replayed!
    _execute(data);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
mapping(bytes32 => bool) public processedMessages;

function processMessage(bytes32 messageId, bytes calldata data) external {
    require(!processedMessages[messageId], "Already processed");
    processedMessages[messageId] = true;
    _execute(data);
}
\`\`\`

**Detection:**
\`\`\`
Grep("messageId|nonce|processed", glob="**/*.sol")
\`\`\`
Check if there's uniqueness tracking.

---

### 4. Message Ordering Issues

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes sequential processing
function receiveDeposit(uint256 depositId, uint256 amount) external {
    require(depositId == lastDepositId + 1, "Out of order"); // Can block!
    lastDepositId = depositId;
}
\`\`\`

**Risk:** One failed message blocks all subsequent messages.

**Secure Pattern:**
\`\`\`solidity
// Allow out-of-order processing with idempotency
function receiveDeposit(bytes32 depositHash, uint256 amount) external {
    require(!processed[depositHash], "Already processed");
    processed[depositHash] = true;
    _processDeposit(amount);
}
\`\`\`

---

### 5. Chain-Specific Code Assumptions

#### block.number Differences

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Different meaning on L2
uint256 blockAge = block.number - startBlock;
require(blockAge >= REQUIRED_BLOCKS, "Too early");
\`\`\`

**Chain Differences:**
| Chain | block.number Behavior |
|-------|----------------------|
| Ethereum | L1 block number |
| Arbitrum | L1 block number |
| Optimism | L2 block number |
| Polygon | L2 block number |

#### PUSH0 Opcode (Solidity 0.8.20+)

**Risk:** Contracts compiled with Solidity >=0.8.20 use PUSH0, not supported on:
- zkSync Era
- Arbitrum (until Dencun)
- Some other L2s

**Detection:**
\`\`\`
Grep("pragma solidity", glob="**/*.sol")
\`\`\`
Check if version >= 0.8.20 and deploying to chains without PUSH0.

---

### 6. Bridge Lock/Mint Attacks

**Vulnerable Pattern:**
\`\`\`solidity
// Source chain: Lock
function bridgeOut(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    emit BridgeOut(msg.sender, amount);
}

// Destination chain: Mint
function bridgeIn(address user, uint256 amount) external onlyRelayer {
    // If relayer is compromised or message forged...
    wrappedToken.mint(user, amount);
}
\`\`\`

**Attack Vectors:**
1. Forge message without locking
2. Replay lock message
3. Lock on chain A, mint on chains B and C

**Mitigations:**
- Multi-sig relayers
- Optimistic verification with fraud proofs
- Zero-knowledge proofs
- Message hash verification

---

### 7. Finality Assumptions

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes instant finality
function onMessageReceived(bytes calldata proof) external {
    // Process immediately after 1 confirmation
    _execute(proof);
}
\`\`\`

**Risk:** Chain reorganizations can invalidate processed messages.

**Chain Finality:**
| Chain | Finality Time | Confirmations |
|-------|---------------|---------------|
| Ethereum | ~15 min | 32 slots |
| Polygon | ~30 min | 256 blocks |
| BSC | ~3 min | 15 blocks |
| Arbitrum | 7 days (challenged) | Instant (sequencer) |

---

## LayerZero Specific Checks

\`\`\`solidity
// Required validations for LayerZero
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external override {
    // 1. Endpoint check
    require(msg.sender == address(lzEndpoint), "Invalid endpoint");

    // 2. Chain check
    require(_srcChainId == trustedRemoteChain, "Invalid chain");

    // 3. Source address check
    bytes memory trustedRemote = trustedRemoteLookup[_srcChainId];
    require(
        _srcAddress.length == trustedRemote.length &&
        keccak256(_srcAddress) == keccak256(trustedRemote),
        "Invalid source"
    );

    // 4. Process payload
    _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
}
\`\`\`

---

## Cross-Chain Audit Checklist

- [ ] Source chain ID validated
- [ ] Source address validated
- [ ] Message nonce/ID tracked for replay protection
- [ ] Endpoint address verified (msg.sender check)
- [ ] Chain-specific code identified (block.number, PUSH0)
- [ ] Finality assumptions appropriate
- [ ] Out-of-order messages handled
- [ ] Failed message recovery possible

## Severity Classification

### Critical
- Missing source chain validation
- Missing source address validation
- No replay protection
- Signature verification bypass

### High
- Insufficient finality wait
- Message ordering DoS
- Cross-chain reentrancy

### Medium
- Chain-specific code assumptions
- Incomplete trusted remote setup
- Missing event emission`,
}

const economic_attackSkill: BuiltinSkill = {
  name: "economic-attack",
  description: `Auto-loaded by flashloan-auditor and defi-auditor agents during Phase 2. Provides detection patterns for: spot price manipulation, oracle staleness, short TWAP, donation attacks, slippage, flash loan governance. Core artifact: Price Flow Map.`,
  template: `# Economic Attack Vulnerability Analysis

**2025 Statistics**: Flash loans = **83.3% of DeFi exploits**, Oracle manipulation = **+31% YoY**, Price manipulation = **34.3% of MUBs**.

---

## Attacker Mindset: Infinite Capital

**CRITICAL**: With flash loans, attackers have **INFINITE CAPITAL** for one transaction.

\`\`\`
+------------------------------------------------------------------+
|                  SINGLE ATOMIC TRANSACTION                        |
+------------------------------------------------------------------+
|  1. BORROW    | Flash loan \$100M+ from Aave/dYdX (cost: 0.09%)   |
|  2. MANIPULATE| Change any on-chain value (price, balance, ratio) |
|  3. EXPLOIT   | Call target function with manipulated state       |
|  4. PROFIT    | Extract value (mint, borrow, swap at bad rate)   |
|  5. REPAY     | Return flash loan + fee                          |
|  6. KEEP      | Attacker keeps profit, victims lose funds        |
+------------------------------------------------------------------+
\`\`\`

**Key insight**: If ANY step fails, entire transaction reverts. Attacker loses only gas (~\$50).
This means attackers can try complex attacks with zero risk.

---

## Why Economic Attacks Happen (Root Causes)

### Root Cause 1: Single Source Price Dependency

Protocol trusts ONE price source that attacker can manipulate.

\`\`\`solidity
// VULNERABLE: Single DEX pool as price source
function getPrice() public view returns (uint256) {
    (uint112 r0, uint112 r1,) = uniswapPair.getReserves();
    return uint256(r1) * 1e18 / uint256(r0);  // @audit Flash loan can drain r0
}
\`\`\`

**Attacker's view**: "I can move this price with enough capital. Flash loan gives me that capital."

### Root Cause 2: Spot Price Trust

Using current-moment values instead of time-averaged values.

\`\`\`solidity
// VULNERABLE: Current block's reserves
price = reserves[1] / reserves[0];  // @audit Reflects THIS transaction's state

// What attacker sees:
// 1. Swap to move reserves
// 2. Read manipulated price
// 3. Exploit protocol
// 4. Swap back
// All in one tx!
\`\`\`

**Detection**: Any \`getReserves()\`, \`slot0()\`, \`balanceOf()\` used for pricing is suspect.

### Root Cause 3: Staleness Blindness

Oracle price could be hours or days old, but protocol uses it anyway.

\`\`\`solidity
// VULNERABLE: No staleness check
(, int256 price,,,) = chainlinkFeed.latestRoundData();
return uint256(price);  // @audit Could be from yesterday!

// Attacker's opportunity:
// - Wait for oracle to become stale during volatility
// - Real price moved 20%, oracle still shows old price
// - Liquidate users at wrong price, or borrow too much
\`\`\`

**Detection**: \`latestRoundData()\` without checking \`updatedAt\` timestamp.

### Root Cause 4: Composability Trust

Protocol blindly trusts external protocol's reported values.

\`\`\`solidity
// VULNERABLE: Trusting external vault's totalAssets
function getCollateralValue(address user) view returns (uint256) {
    uint256 shares = externalVault.balanceOf(user);
    uint256 pricePerShare = externalVault.totalAssets() / externalVault.totalSupply();
    return shares * pricePerShare;  // @audit totalAssets can be donated to!
}
\`\`\`

**Attacker's view**: "I can donate to that vault and inflate pricePerShare, then borrow against it."

---

## The Price Flow Map (Core Artifact)

Trace how prices flow through the system:

\`\`\`
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Price Source   │ ──► │ Reading Function │ ──► │ Critical Decision│
│ (Oracle/DEX)    │     │ (getPrice, etc) │     │ (liquidate,mint)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        ▼                                                ▼
   Manipulable?                                   Value Transfer
   - Flash loan?                                  (funds move)
   - Donation?
   - Time window?
\`\`\`

Document each price dependency:

| Function | Price Source | Manipulable? | Impact if Manipulated |
|----------|--------------|--------------|----------------------|
| liquidate() | Chainlink ETH/USD | Staleness only | Unfair liquidations |
| borrow() | Uniswap reserves | Flash loan | Undercollateralized borrow |
| mint() | vault.totalAssets() | Donation | Steal other users' deposits |

---

## Detection Patterns

### Pattern 1: Spot Price Dependency (Most Critical)

**Root Cause**: Single Source + Spot Price Trust

\`\`\`solidity
// VULNERABLE: Direct reserve ratio
function getTokenPrice() public view returns (uint256) {
    (uint112 r0, uint112 r1,) = pair.getReserves();
    return uint256(r1) * 1e18 / uint256(r0);  // @audit Instant manipulation
}
\`\`\`

**Attack Flow**:
1. Flash loan large amount of token0
2. Swap to drain token0 from pool → price spikes
3. Call victim function that reads this price
4. Profit at inflated price
5. Swap back, repay flash loan

**Search Queries**:
\`\`\`
Grep("getReserves|slot0|observe", glob="**/*.sol")
Grep("reserve0|reserve1|liquidity", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Is this price used for critical decisions?
- Can flash loan move this price significantly?
- Is there enough liquidity to resist manipulation?

### Pattern 2: Oracle Staleness

**Root Cause**: Staleness Blindness

\`\`\`solidity
// VULNERABLE: No freshness validation
function getPrice() external view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);  // @audit Could be stale!
}

// Attack opportunity:
// During high volatility, oracle updates lag
// Real ETH = \$3000, Oracle still says \$2500
// Attacker borrows at \$2500 collateral value
// Immediately has undercollateralized position
\`\`\`

**Search Queries**:
\`\`\`
Grep("latestRoundData|latestAnswer", glob="**/*.sol")
Grep("updatedAt|answeredInRound", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Is \`updatedAt\` checked against a max staleness?
- What's the heartbeat of this oracle?
- What happens during oracle downtime?

### Pattern 3: Short TWAP Window

**Root Cause**: Insufficient time averaging

\`\`\`solidity
// VULNERABLE: 1 minute TWAP
uint32[] memory secondsAgos = new uint32[](2);
secondsAgos[0] = 60;   // @audit Only 60 seconds!
secondsAgos[1] = 0;
(int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
\`\`\`

**Attacker's view**: "I can maintain manipulated price for 60 seconds across multiple blocks if I'm a validator, or use multiple flash loans."

**Safe TWAP windows**:
- Minimum: 30 minutes (1800 seconds)
- Recommended: 1-4 hours for high-value decisions

**Search Queries**:
\`\`\`
Grep("observe|consult|TWAP|twap", glob="**/*.sol")
Grep("secondsAgo|period|window", glob="**/*.sol")
\`\`\`

### Pattern 4: Donation Attack / Share Inflation

**Root Cause**: Composability Trust + Spot Value

\`\`\`solidity
// VULNERABLE: totalAssets includes donations
function totalAssets() public view returns (uint256) {
    return token.balanceOf(address(this));  // @audit Donatable!
}

function pricePerShare() public view returns (uint256) {
    return totalAssets() * 1e18 / totalSupply();  // @audit Inflatable!
}
\`\`\`

**Attack Flow**:
1. Deposit 1 wei → get 1 share (first depositor)
2. Donate 1M tokens directly to vault (not via deposit)
3. pricePerShare = 1M / 1 = 1M per share
4. Victim deposits 999K → gets 0 shares (rounds down)
5. Attacker redeems 1 share → gets everything

**Search Queries**:
\`\`\`
Grep("balanceOf\\\\(address\\\\(this\\\\)\\\\)", glob="**/*.sol")
Grep("totalAssets|totalSupply", glob="**/*.sol")
Grep("pricePerShare|exchangeRate", glob="**/*.sol")
\`\`\`

### Pattern 5: Missing Slippage Protection

**Root Cause**: No minimum output enforcement

\`\`\`solidity
// VULNERABLE: amountOutMin = 0
router.swapExactTokensForTokens(
    amountIn,
    0,  // @audit Sandwich target!
    path,
    msg.sender,
    block.timestamp
);
\`\`\`

**Attack Flow** (Sandwich):
1. See victim's pending swap in mempool
2. Front-run: buy token, raise price
3. Victim's swap executes at worse price
4. Back-run: sell token at higher price
5. Profit from victim's slippage

**Search Queries**:
\`\`\`
Grep("amountOutMin|minAmountOut|minOut", glob="**/*.sol")
Grep("swapExact|swap\\\\(", glob="**/*.sol")
\`\`\`

### Pattern 6: Flash Loan Governance

**Root Cause**: Snapshot at call time

\`\`\`solidity
// VULNERABLE: Current balance for voting power
function propose(bytes calldata action) external {
    uint256 votes = token.balanceOf(msg.sender);  // @audit Current!
    require(votes >= proposalThreshold);
    // Attacker: flash loan tokens → propose → return
}

function vote(uint256 proposalId, bool support) external {
    uint256 votes = token.balanceOf(msg.sender);  // @audit Current!
    proposals[proposalId].votes += votes;
    // Attacker: flash loan → vote → return
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("balanceOf.*vote|vote.*balanceOf", glob="**/*.sol")
Grep("propose|quorum|threshold", glob="**/*.sol")
\`\`\`

---

## Flash Loan Exploitability Checklist

For each value used in critical decisions:

- [ ] Can this value be changed within one transaction?
- [ ] Does flash loan provide enough capital to move it significantly?
- [ ] Is the value read and used in the same transaction?
- [ ] Is there a time delay between read and use?
- [ ] Are there circuit breakers for extreme values?

---

## Price Source Risk Matrix

| Source Type | Manipulation Risk | Attack Vector |
|-------------|-------------------|---------------|
| DEX Spot (getReserves) | **CRITICAL** | Flash loan swap |
| Uniswap V3 slot0 | **CRITICAL** | Flash loan swap |
| TWAP < 10 min | **HIGH** | Multi-block or validator |
| TWAP 10-30 min | **MEDIUM** | Validator collusion |
| TWAP > 30 min | **LOW** | Expensive sustained attack |
| Chainlink (no staleness) | **HIGH** | Wait for stale price |
| Chainlink (with staleness) | **LOW** | Limited window |
| balanceOf(this) | **HIGH** | Direct donation |

---

## Search Query Reference

\`\`\`
# Find price sources
Grep("getReserves|slot0|observe|latestRoundData", glob="**/*.sol")
Grep("getPrice|price\\\\(\\\\)|oracle", glob="**/*.sol")

# Find manipulable values
Grep("balanceOf\\\\(address\\\\(this\\\\)\\\\)", glob="**/*.sol")
Grep("totalAssets|totalSupply|pricePerShare", glob="**/*.sol")

# Find flash loan interactions
Grep("flashLoan|flash\\\\(|executeOperation", glob="**/*.sol")
Grep("onFlashLoan|IERC3156", glob="**/*.sol")

# Find vulnerable swaps
Grep("amountOutMin.*=.*0|minAmount.*=.*0", glob="**/*.sol")
Grep("swapExact|swap\\\\(", glob="**/*.sol")

# Find governance
Grep("propose|vote|quorum|snapshot", glob="**/*.sol")
\`\`\`

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "Flash loans are expensive" | 0.09% fee on \$100M = \$90K. Profit can be millions. |
| "Pool has high liquidity" | Higher liquidity = need bigger flash loan. Still doable. |
| "TWAP protects us" | Short TWAP < 10min is still manipulable. Check the window. |
| "No one would do this" | MEV bots automate attacks 24/7. They're already looking. |
| "Chainlink is always accurate" | Chainlink can be stale. Always check \`updatedAt\`. |
| "This is theoretical" | Cetus (\$223M), Euler (\$197M), Mango (\$114M), KiloEx (\$117M) |
| "Attack would cost too much" | Flash loan cost is near zero. Only gas at risk. |`,
}

const flashloanSkill: BuiltinSkill = {
  name: "flashloan",
  description: `Auto-loaded by flashloan-auditor agent during Phase 2. Provides detection patterns for: price manipulation, governance manipulation, collateral manipulation, reward manipulation, oracle manipulation via flash loans. Core artifact: Flash Loan Attack Flow diagram.`,
  template: `# Flash Loan Attack Patterns

This skill provides comprehensive knowledge for identifying flash loan attack vulnerabilities in smart contracts.

## Overview

Flash loans provide unlimited capital for a single transaction. Any logic that depends on current state (balances, prices, voting power) without proper protection is potentially vulnerable.

## Attack Categories

### 1. Price Manipulation Attacks

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Spot price from AMM
function getPrice() public view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
    return reserve1 * 1e18 / reserve0;
}

function liquidate(address user) external {
    uint256 price = getPrice(); // Manipulable!
    uint256 collateralValue = collateral[user] * price;
    require(debt[user] > collateralValue, "Healthy");
    // Liquidate...
}
\`\`\`

**Attack Flow:**
\`\`\`
1. Flash loan large amount of token0
2. Dump into AMM → reserve1/reserve0 crashes
3. Call liquidate() at manipulated price
4. Buy back token0 cheap
5. Repay flash loan
6. Profit from unfair liquidation
\`\`\`

**Detection:**
\`\`\`
Grep("getReserves|slot0\\\\(\\\\)|sqrtPriceX96", glob="**/*.sol")
\`\`\`

---

### 2. Governance Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Balance-based voting
function castVote(uint256 proposalId, bool support) external {
    uint256 votes = token.balanceOf(msg.sender); // Flash loanable!
    _recordVote(proposalId, msg.sender, votes, support);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use snapshot at proposal creation
function castVote(uint256 proposalId, bool support) external {
    uint256 snapshotBlock = proposals[proposalId].snapshotBlock;
    uint256 votes = token.getPastVotes(msg.sender, snapshotBlock);
    _recordVote(proposalId, msg.sender, votes, support);
}
\`\`\`

**Detection:**
\`\`\`
Grep("balanceOf.*vote|vote.*balanceOf", glob="**/*.sol")
Grep("propose|castVote|delegate", glob="**/*.sol")
\`\`\`

---

### 3. Collateral Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Instant collateral increase
function borrow(uint256 amount) external {
    uint256 collateralValue = getCollateralValue(msg.sender);
    require(amount <= collateralValue * LTV, "Insufficient collateral");
    // Borrow...
}

function getCollateralValue(address user) public view returns (uint256) {
    return token.balanceOf(address(this)) * userShare[user] / totalShares;
    // ↑ Can be inflated with flash loan deposit
}
\`\`\`

**Attack Flow:**
\`\`\`
1. Flash loan tokens
2. Deposit as collateral → inflate collateralValue
3. Borrow maximum amount
4. Withdraw collateral
5. Repay flash loan (but keep borrowed funds)
\`\`\`

---

### 4. Reward Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Balance-based rewards
function claimRewards() external {
    uint256 share = token.balanceOf(msg.sender) * 1e18 / token.totalSupply();
    uint256 reward = pendingRewards * share;
    // Distribute reward...
}
\`\`\`

**Detection:**
\`\`\`
Grep("reward.*balanceOf|balanceOf.*reward", glob="**/*.sol")
Grep("claim|harvest|distribute", glob="**/*.sol")
\`\`\`

---

### 5. Oracle Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: On-chain oracle from DEX
function updatePrice() external {
    uint256 spotPrice = dex.getSpotPrice(token0, token1);
    lastPrice = spotPrice; // Can be manipulated!
}
\`\`\`

**Mitigation:**
- Use TWAP with sufficient period (>= 30 minutes)
- Use manipulation-resistant oracles (Chainlink)
- Add price deviation checks

---

## Flash Loan Protection Patterns

### 1. Snapshot/Checkpoint Pattern
\`\`\`solidity
// Record state at specific block
mapping(address => mapping(uint256 => uint256)) private _checkpoints;

function getPastBalance(address account, uint256 blockNumber)
    public view returns (uint256)
{
    require(blockNumber < block.number, "Future lookup");
    return _checkpoints[account][blockNumber];
}
\`\`\`

### 2. Time-Weighted Average
\`\`\`solidity
// TWAP resists single-block manipulation
function getTWAP(uint32 period) public view returns (uint256) {
    require(period >= MIN_TWAP_PERIOD, "Period too short");
    (int56[] memory tickCumulatives,) = pool.observe([period, 0]);
    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
    return uint256(int256(tickDelta) / int256(uint256(period)));
}
\`\`\`

### 3. Same-Block Check
\`\`\`solidity
// Prevent same-block manipulation
mapping(address => uint256) private lastActionBlock;

modifier notSameBlock() {
    require(lastActionBlock[msg.sender] < block.number, "Same block");
    lastActionBlock[msg.sender] = block.number;
    _;
}
\`\`\`

### 4. Minimum Lock Period
\`\`\`solidity
// Require time commitment
mapping(address => uint256) private depositTime;

function withdraw() external {
    require(block.timestamp >= depositTime[msg.sender] + MIN_LOCK, "Locked");
    // Process withdrawal...
}
\`\`\`

---

## Flash Loan Audit Checklist

- [ ] No balance-based voting without snapshots
- [ ] No spot price usage from AMMs
- [ ] Collateral changes have time delay or checks
- [ ] Reward distribution uses checkpoints
- [ ] TWAP period is sufficient (>= 30 min)
- [ ] Same-block price changes detected
- [ ] Governance has proposal delay

## Flash Loan Sources

| Protocol | Max Amount | Fee |
|----------|------------|-----|
| AAVE V3 | Pool liquidity | 0.05% |
| dYdX | Pool liquidity | 0% |
| Balancer | Pool liquidity | 0% |
| Uniswap V3 | Pool liquidity | Pool fee |
| Maker | DAI supply | 0% |

## Severity Classification

### Critical
- Balance-based governance without snapshot
- Spot price for liquidations
- Unbounded collateral manipulation

### High
- TWAP period < 10 minutes
- No same-block protection for sensitive ops
- Reward distribution manipulation

### Medium
- Flash loan callback allows arbitrary calls
- Incomplete snapshot coverage`,
}

const logic_errorSkill: BuiltinSkill = {
  name: "logic-error",
  description: `Auto-loaded by logic-auditor agent during Phase 2. Provides detection patterns for: division before multiplication, first depositor attacks, precision loss, unchecked blocks, missing slippage, edge cases. Core artifact: Calculation Flow Map.`,
  template: `# Business Logic Vulnerability Analysis

**2025 Statistics**: Logic errors caused **\$63.8M+** losses, Input validation = **34.6% of vulnerabilities**, Rounding attacks (Bunni) = **\$2.4M-\$8.3M**.

---

## Why Logic Bugs Happen (Root Causes)

### Root Cause 1: Integer-Only Arithmetic

Solidity has NO floating point. Every division truncates.

\`\`\`solidity
// In normal math: 5 / 2 = 2.5
// In Solidity:    5 / 2 = 2  ← Where does 0.5 go?

uint256 fee = amount / 10000 * feeRate;
// If amount = 5000, feeRate = 100:
// 5000 / 10000 = 0  ← Division first!
// 0 * 100 = 0       ← Fee bypassed!
\`\`\`

**Attacker's view**: "Every time they divide, precision is lost. I'll make sure it's lost to ME."

### Root Cause 2: Operation Order

Division before multiplication destroys precision.

\`\`\`solidity
// VULNERABLE: Divide first
uint256 result = a / b * c;  // @audit Precision lost!

// SECURE: Multiply first
uint256 result = a * c / b;  // Preserves more precision

// Example with a=100, b=3, c=3:
// Wrong order: 100/3*3 = 33*3 = 99  (lost 1)
// Right order: 100*3/3 = 300/3 = 100 (exact)
\`\`\`

**Detection**: Any \`X / Y * Z\` pattern is suspect. Check if \`X * Z / Y\` is possible.

### Root Cause 3: Rounding Direction Mismatch

Protocol rounds in attacker's favor, not protocol's favor.

\`\`\`solidity
// VULNERABLE: Rounding favors user on withdraw
function withdraw(uint256 shares) external {
    uint256 assets = shares * totalAssets / totalSupply;  // @audit Rounds DOWN
    // Attacker withdraws many small amounts
    // Each time keeps the rounded-down dust
}

// SECURE: Round against the user
function withdraw(uint256 shares) external {
    uint256 assets = shares * totalAssets / totalSupply;  // Still rounds down
    // But on DEPOSIT, also round down (user gets fewer shares)
    // Protocol never loses from rounding
}
\`\`\`

**Rule**: Round DOWN on withdraw (user gets less), round DOWN on deposit (user pays more).

### Root Cause 4: Missing Edge Case Handling

Zero, one, max, first, last - all create special behaviors.

\`\`\`solidity
// VULNERABLE: No zero check
function distribute(uint256 amount, uint256 recipients) external {
    uint256 perPerson = amount / recipients;  // @audit recipients = 0 → revert
    // Or recipients = 1000000 → perPerson = 0
}
\`\`\`

**Attacker's view**: "What happens at the boundaries? That's where bugs hide."

---

## The Calculation Flow Map (Core Artifact)

Trace every arithmetic operation:

\`\`\`
Input (amount, shares, etc.)
    ↓
Validation (bounds check? zero check?)
    ↓
Calculation (what order? division when?)
    ↓
Rounding (which direction? who loses?)
    ↓
State Update (invariant preserved?)
    ↓
Output (expected vs actual?)
\`\`\`

Document each calculation:

| Function | Operation | Order | Rounding | Risk |
|----------|-----------|-------|----------|------|
| mint() | shares = assets * supply / total | Mul first ✓ | Down (protocol wins) | First depositor |
| fee() | fee = amount / 10000 * rate | Div first ✗ | Down → zero | Fee bypass |
| redeem() | assets = shares * total / supply | Mul first ✓ | Down (user loses) | Check |

---

## Detection Patterns

### Pattern 1: Division Before Multiplication

**Root Cause**: Operation Order

\`\`\`solidity
// VULNERABLE: Precision loss
uint256 fee = amount / 10000 * feeRate;
// If amount < 10000, fee = 0 regardless of feeRate!

uint256 share = deposit / totalAssets * totalSupply;
// Small deposits get 0 shares!
\`\`\`

**Attack Flow**:
1. Find function with \`a / b * c\` pattern
2. Input value where \`a < b\`
3. Result = 0, bypassing intended logic
4. Repeat to accumulate benefit

**Search Queries**:
\`\`\`
Grep("/.*\\\\*", glob="**/*.sol")
Grep("\\\\*/", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Can the division result in zero?
- Would reordering to \`a * c / b\` be safe (no overflow)?
- What's the minimum input that gives non-zero result?

### Pattern 2: First Depositor / Vault Inflation Attack

**Root Cause**: Rounding + Empty State

\`\`\`solidity
// VULNERABLE: Standard ERC4626 share calculation
function deposit(uint256 assets) external returns (uint256 shares) {
    if (totalSupply == 0) {
        shares = assets;  // @audit First depositor sets the ratio!
    } else {
        shares = assets * totalSupply / totalAssets;
    }
}
\`\`\`

**Attack Flow** (Inflation Attack):
1. Deposit 1 wei → get 1 share
2. Donate 1,000,000 tokens directly to vault (not via deposit)
3. Now: totalAssets = 1,000,001, totalSupply = 1
4. Victim deposits 999,999 → shares = 999,999 * 1 / 1,000,001 = 0
5. Victim gets 0 shares, loses entire deposit
6. Attacker redeems 1 share → gets everything

**Search Queries**:
\`\`\`
Grep("totalSupply.*==.*0|totalSupply\\\\(\\\\).*==.*0", glob="**/*.sol")
Grep("balanceOf\\\\(address\\\\(this\\\\)\\\\)", glob="**/*.sol")
Grep("ERC4626|vault|shares", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- What happens when totalSupply = 0?
- Is there virtual shares/assets offset?
- Is there minimum deposit requirement?
- Can assets be donated without minting shares?

### Pattern 3: Unchecked Return Values

**Root Cause**: Silent Failure Assumption

\`\`\`solidity
// VULNERABLE: USDT returns false instead of reverting
IERC20(token).transfer(recipient, amount);  // @audit Return not checked!
// If transfer fails, execution continues with wrong state

// SECURE: Use SafeERC20
SafeERC20.safeTransfer(IERC20(token), recipient, amount);
\`\`\`

**Search Queries**:
\`\`\`
Grep("\\\\.transfer\\\\(|\\\\.transferFrom\\\\(", glob="**/*.sol")
Grep("safeTransfer|SafeERC20", glob="**/*.sol")
\`\`\`

### Pattern 4: Integer Overflow in Unchecked Blocks

**Root Cause**: Bypassing Solidity 0.8+ Safety

\`\`\`solidity
// VULNERABLE: Intentional unchecked can overflow
unchecked {
    balance += amount;  // @audit Can wrap to 0 if balance + amount > MAX
    counter--;          // @audit Can wrap to MAX if counter = 0
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("unchecked\\\\s*\\\\{", glob="**/*.sol")
Grep("assembly\\\\s*\\\\{", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Why is unchecked used here?
- Can inputs cause overflow/underflow?
- Is the unchecked block necessary?

### Pattern 5: Missing Slippage Protection

**Root Cause**: No Minimum Output Enforcement

\`\`\`solidity
// VULNERABLE: User accepts any output
function swap(uint256 amountIn) external {
    uint256 amountOut = calculateOutput(amountIn);
    token.transfer(msg.sender, amountOut);  // @audit No minimum check!
}

// SECURE: Enforce minimum
function swap(uint256 amountIn, uint256 minAmountOut) external {
    uint256 amountOut = calculateOutput(amountIn);
    require(amountOut >= minAmountOut, "Slippage");
    token.transfer(msg.sender, amountOut);
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("amountOutMin|minAmountOut|minOut|slippage", glob="**/*.sol")
Grep("swap|exchange|trade", glob="**/*.sol")
\`\`\`

### Pattern 6: Missing Zero/Address Validation

**Root Cause**: Missing Input Validation

\`\`\`solidity
// VULNERABLE: Zero address bricks contract
function setAdmin(address newAdmin) external onlyOwner {
    admin = newAdmin;  // @audit address(0) = no admin forever
}

// VULNERABLE: Division by zero
function distribute(uint256 total, uint256 count) external {
    uint256 each = total / count;  // @audit count = 0 → revert
}

// VULNERABLE: Zero amount wastes gas or causes issues
function deposit(uint256 amount) external {
    // @audit amount = 0 → user gets 0 shares, wasted gas
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("address.*=|= address", glob="**/*.sol")
Grep("require.*!=.*0|require.*>.*0", glob="**/*.sol")
\`\`\`

---

## Edge Case Testing Matrix

For EVERY value-handling function:

| Edge Case | Test Value | Common Bug | What to Check |
|-----------|------------|------------|---------------|
| **Zero** | \`0\` | Division by zero, empty transfer | Does it revert or return 0? |
| **One** | \`1\` | Rounds to zero, off-by-one | Minimum meaningful input? |
| **Max** | \`type(uint256).max\` | Overflow, gas exhaustion | Does unchecked wrap? |
| **First user** | Empty state | Ratio manipulation | Who sets initial ratio? |
| **Last user** | Only remaining | Stuck funds, dust | Can final user withdraw all? |
| **Boundary** | Just above/below limit | Off-by-one, \`<\` vs \`<=\` | Fencepost errors? |

---

## Invariant Verification Checklist

| Invariant | How to Verify | Common Violation |
|-----------|--------------|------------------|
| \`totalSupply == sum(balances)\` | Trace all mint/burn | Donation attack |
| \`totalAssets >= totalDebt\` | Check after each action | Flash loan attack |
| \`shares * pricePerShare >= deposit\` | Rounding check | Precision loss |
| \`sum(rewards) <= rewardPool\` | Trace all claims | Over-distribution |

---

## Search Query Reference

\`\`\`
# Find arithmetic operations
Grep("/.*\\\\*|\\\\*/", glob="**/*.sol")
Grep("mulDiv|wadMul|rayMul|FullMath", glob="**/*.sol")

# Find potential overflow
Grep("unchecked\\\\s*\\\\{", glob="**/*.sol")
Grep("assembly\\\\s*\\\\{", glob="**/*.sol")

# Find share calculations
Grep("totalSupply|totalAssets|pricePerShare", glob="**/*.sol")
Grep("ERC4626|vault|shares", glob="**/*.sol")

# Find missing checks
Grep("\\\\.transfer\\\\(|\\\\.transferFrom\\\\(", glob="**/*.sol")
Grep("require.*!=|require.*>", glob="**/*.sol")

# Find slippage
Grep("amountOutMin|minAmount|slippage", glob="**/*.sol")
\`\`\`

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "It's just rounding" | Bunni lost \$2.4M-\$8.3M to rounding. Repeated calls accumulate. |
| "Users won't send dust" | Attackers absolutely will. Dust inputs are the exploit. |
| "Math is too complex" | MEV bots automate arbitrarily complex calculations. |
| "First depositor is trusted" | First depositor attack is #1 vault exploit in 2025. |
| "Frontend validates" | On-chain must be secure standalone. |
| "This edge case is unlikely" | Every edge case is an attacker's opportunity. |
| "Solidity 0.8 prevents overflow" | Unchecked blocks and assembly bypass this. |`,
}

const oracleSkill: BuiltinSkill = {
  name: "oracle",
  description: `Auto-loaded by oracle-auditor agent during Phase 2. Provides detection patterns for: stale prices, deprecated Chainlink functions, L2 sequencer downtime, decimal mismatches, spot price manipulation, oracle DoS. Core artifact: Oracle Integration Matrix.`,
  template: `# Oracle Vulnerability Patterns

This skill provides comprehensive knowledge for identifying oracle-related vulnerabilities in smart contracts.

## Overview

Oracles bridge off-chain data to on-chain contracts. Every oracle integration is a trust assumption that can be exploited if not properly validated.

## Detection Patterns

### 1. Stale Price Data

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No freshness check
(, int256 price,,,) = priceFeed.latestRoundData();
return uint256(price);
\`\`\`

**Secure Pattern:**
\`\`\`solidity
(uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) =
    priceFeed.latestRoundData();
require(updatedAt > block.timestamp - HEARTBEAT, "Stale price");
require(answeredInRound >= roundId, "Stale round");
require(price > 0, "Invalid price");
\`\`\`

**Search Pattern:**
\`\`\`
Grep("latestRoundData", glob="**/*.sol")
\`\`\`
Then verify each usage checks \`updatedAt\` timestamp.

---

### 2. Deprecated Chainlink Functions

**Vulnerable Pattern:**
\`\`\`solidity
// DEPRECATED: Can return stale data
int256 price = priceFeed.latestAnswer();
\`\`\`

**Detection:**
\`\`\`
Grep("latestAnswer|latestTimestamp|latestRound\\\\(\\\\)", glob="**/*.sol")
\`\`\`

---

### 3. L2 Sequencer Downtime (Arbitrum/Optimism)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS on L2: No sequencer check
(, int256 price,,,) = priceFeed.latestRoundData();
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Check sequencer uptime feed first
(, int256 answer,, uint256 updatedAt,) = sequencerFeed.latestRoundData();
bool isSequencerUp = answer == 0;
require(isSequencerUp, "Sequencer down");
require(block.timestamp - updatedAt > GRACE_PERIOD, "Grace period");

// Then get price
(, int256 price,,,) = priceFeed.latestRoundData();
\`\`\`

**Detection:**
- Check if deployed on L2 (Arbitrum, Optimism, Base)
- Search for sequencer uptime feed integration
\`\`\`
Grep("sequencer|SEQUENCER|isSequencerUp", glob="**/*.sol")
\`\`\`

---

### 4. Decimal Precision Mismatch

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes 8 decimals
uint256 priceInUsd = uint256(price) * 1e10; // Scale to 18 decimals
\`\`\`

**Secure Pattern:**
\`\`\`solidity
uint8 decimals = priceFeed.decimals();
uint256 scaledPrice = uint256(price) * (10 ** (18 - decimals));
\`\`\`

**Detection:**
\`\`\`
Grep("decimals\\\\(\\\\)|1e10|1e8|\\\\* 10", glob="**/*.sol")
\`\`\`

---

### 5. Spot Price Manipulation (Flash Loan Vulnerable)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Manipulable in single tx
(uint112 reserve0, uint112 reserve1,) = pair.getReserves();
uint256 price = reserve1 * 1e18 / reserve0;
\`\`\`

**Secure Pattern:**
- Use TWAP (Time-Weighted Average Price)
- Use Chainlink or other manipulation-resistant oracle
- Add minimum TWAP period (>= 30 minutes)

**Detection:**
\`\`\`
Grep("getReserves|slot0|observe", glob="**/*.sol")
\`\`\`

---

### 6. Oracle Revert DoS

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Revert blocks entire function
function getPrice() external view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function getPrice() external view returns (uint256, bool) {
    try priceFeed.latestRoundData() returns (
        uint80, int256 price, uint256, uint256 updatedAt, uint80
    ) {
        if (price <= 0 || block.timestamp - updatedAt > HEARTBEAT) {
            return (0, false);
        }
        return (uint256(price), true);
    } catch {
        return (0, false);
    }
}
\`\`\`

---

### 7. Heartbeat Mismatch

Different price feeds have different update frequencies:

| Feed | Heartbeat | Deviation |
|------|-----------|-----------|
| ETH/USD | 1 hour | 0.5% |
| BTC/USD | 1 hour | 0.5% |
| Stablecoin | 24 hours | 0.25% |
| Low-cap | 24 hours | 1% |

**Detection:**
- Check staleness threshold matches the feed's heartbeat
- Verify threshold is not hardcoded for all feeds

---

## Oracle Audit Checklist

- [ ] Price freshness validated (\`updatedAt\` check)
- [ ] Zero/negative price rejected
- [ ] Round completeness verified (\`answeredInRound >= roundId\`)
- [ ] L2 sequencer uptime checked (if applicable)
- [ ] Decimal precision handled dynamically
- [ ] Heartbeat matches price feed specification
- [ ] No deprecated functions used
- [ ] Oracle revert handled gracefully
- [ ] No spot price from AMM (flash loan vulnerable)
- [ ] TWAP period sufficient (if using Uniswap)

## Common Oracle Vulnerabilities by Severity

### Critical
- Missing price freshness validation
- L2 sequencer check missing
- Spot price manipulation

### High
- Decimal precision hardcoded
- Heartbeat threshold too long
- No zero price check

### Medium
- Deprecated function usage
- Oracle revert not handled
- Single oracle dependency

## References

For detailed Chainlink integration patterns, see:
- \`integration-patterns/chainlink/SKILL.md\``,
}

const reentrancySkill: BuiltinSkill = {
  name: "reentrancy",
  description: `Auto-loaded by reentrancy-auditor agent during Phase 2. Provides detection patterns for: CEI violations, cross-function/cross-contract reentrancy, read-only reentrancy, token callback exploits (ERC721/777/1155). Core artifact: State Timeline map.`,
  template: `# Reentrancy Vulnerability Analysis

**2025 Statistics**: Reentrancy caused **\$350M+** historical losses, OWASP 2025 ranks it **#5**, 2024 attacks include Penpie, Clober, GemPad.

---

## Why Reentrancy Happens (Root Causes)

### Root Cause 1: State Update After External Call

The fundamental CEI (Checks-Effects-Interactions) violation.

\`\`\`solidity
// VULNERABLE: State update AFTER external call
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool success,) = msg.sender.call{value: amount}("");  // @audit External call
    require(success);
    balances[msg.sender] -= amount;  // @audit State update AFTER!
}
\`\`\`

**Attacker's view**: "Between the call and the state update, I control execution. I'll call withdraw again before my balance updates."

### Root Cause 2: Execution Flow Transfer

Every external call hands control to potentially hostile code.

\`\`\`solidity
// Even "safe" patterns can transfer control:
IERC20(token).transfer(recipient, amount);    // Could be ERC777 with hooks!
NFT.safeTransferFrom(from, to, id);           // Triggers onERC721Received!
Token1155.safeTransferFrom(...);              // Triggers onERC1155Received!
\`\`\`

**Detection**: Any external call is a potential callback. Check what standards the token implements.

### Root Cause 3: Shared State Dependency

Multiple contracts/functions depend on same state variable.

\`\`\`solidity
// Contract has two functions sharing \`balances\`
function withdraw() external {
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // @audit Callback opportunity
    balances[msg.sender] = 0;  // @audit Updated after
}

function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount);  // @audit Same balance!
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
// During withdraw callback, attacker calls transfer() with STALE balance!
\`\`\`

**Attacker's view**: "ReentrancyGuard on withdraw() doesn't protect transfer(). I'll call transfer() during withdraw callback."

### Root Cause 4: View Function Exposure

View functions return stale data during callbacks, affecting external protocols.

\`\`\`solidity
// Contract A (Vault)
function withdraw() external {
    uint256 assets = userAssets[msg.sender];
    msg.sender.call{value: assets}("");  // @audit Callback
    userAssets[msg.sender] = 0;
    totalAssets -= assets;  // @audit Updated after
}

function getTotalAssets() public view returns (uint256) {
    return totalAssets;  // @audit Returns STALE value during callback!
}

// Contract B (Lending) reads from Contract A
function getCollateralValue(address user) view returns (uint256) {
    return vaultA.getTotalAssets() * userShares / totalShares;
    // During withdraw callback, totalAssets is WRONG!
}
\`\`\`

**Attacker's view**: "The view function shows the old value. External protocols that read this will make wrong decisions."

---

## The State Timeline (Core Artifact)

Every reentrancy finding MUST include a state timeline:

\`\`\`
T0: balances[attacker] = 100, contract.balance = 1000
T1: withdraw(100) called
T2: call{value: 100}("") → attacker.receive() triggered
T3: [CALLBACK] balances[attacker] STILL = 100! ← INCONSISTENT STATE
T4: Re-enter withdraw(100) with same balance
T5: Another 100 sent
T6: ... repeat until drained
T7: balances[attacker] -= 100 (executed N times, but all see 100)
\`\`\`

Document each finding:

| Phase | Contract State | Attacker Action | Balance Check |
|-------|---------------|-----------------|---------------|
| T0 | Initial | - | 100 |
| T2 | Sending ETH | receive() callback | 100 (stale) |
| T4 | Re-entered | withdraw again | 100 (stale) |
| T7 | Unwind | - | Multiple decrements fail |

---

## Detection Patterns

### Pattern 1: Classic CEI Violation

**Root Cause**: State Update After External Call

\`\`\`solidity
// VULNERABLE: Textbook reentrancy
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);  // CHECK
    (bool success,) = msg.sender.call{value: amount}("");  // INTERACTION
    require(success);
    balances[msg.sender] -= amount;  // EFFECT - Wrong order!
}
\`\`\`

**Attack Flow**:
1. Attacker calls withdraw(100)
2. Contract sends ETH via call{value}
3. Attacker's receive() callback triggers
4. In callback: call withdraw(100) again (balance still 100!)
5. Repeat until contract drained
6. All state updates execute with wrong values

**Search Queries**:
\`\`\`
Grep("\\\\.call\\\\{value", glob="**/*.sol")
Grep("transfer\\\\(|send\\\\(", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Is state updated BEFORE external call?
- Is there a reentrancy guard?
- Can callback reach this function again?

### Pattern 2: Cross-Function Reentrancy

**Root Cause**: Shared State Dependency

\`\`\`solidity
// Both functions use same \`balances\` mapping
function withdraw() external nonReentrant {  // Has guard
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // @audit Callback
    balances[msg.sender] = 0;
}

function transfer(address to, uint256 amt) external {  // NO guard!
    require(balances[msg.sender] >= amt);  // @audit Same state!
    balances[msg.sender] -= amt;
    balances[to] += amt;
}
\`\`\`

**Attack Flow**:
1. Attacker calls withdraw() with 100 balance
2. During callback, attacker calls transfer(accomplice, 100)
3. transfer() sees balances[attacker] = 100 (not yet updated!)
4. Attacker "transfers" 100 to accomplice
5. withdraw() completes, sets balances[attacker] = 0
6. Accomplice has 100 tokens created from nothing

**Search Queries**:
\`\`\`
Grep("nonReentrant", glob="**/*.sol")
Grep("ReentrancyGuard", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Does guard cover ALL functions sharing this state?
- Can other functions be called during callback?
- What state do they depend on?

### Pattern 3: Cross-Contract Reentrancy

**Root Cause**: ReentrancyGuard Only Protects Single Contract

\`\`\`solidity
// Contract A
function withdraw() external nonReentrant {
    uint256 shares = userShares[msg.sender];
    msg.sender.call{value: shares}("");  // @audit Callback
    userShares[msg.sender] = 0;  // @audit Updated after
}

// Contract B (different contract, NO shared guard!)
function borrow() external {
    uint256 collateral = contractA.userShares(msg.sender);  // @audit Stale!
    require(collateral >= minCollateral);
    // Borrow against stale collateral value
}
\`\`\`

**Attack Flow**:
1. Attacker has 1000 shares in Contract A
2. Call withdraw() on Contract A
3. During callback, call borrow() on Contract B
4. Contract B reads userShares = 1000 (not yet zeroed!)
5. Attacker borrows against 1000 collateral
6. withdraw() completes, sets shares = 0
7. Attacker has borrowed funds + no collateral

**Search Queries**:
\`\`\`
Grep("external.*view.*returns", glob="**/*.sol")
Grep("\\\\.balanceOf\\\\(|\\\\.userShares\\\\(", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Do other contracts read this contract's state?
- Are those reads during callback windows?
- Is there cross-contract reentrancy protection?

### Pattern 4: Read-Only Reentrancy

**Root Cause**: View Function Returns Stale Data

\`\`\`solidity
// Vault contract
function withdraw() external {
    uint256 assets = userAssets[msg.sender];
    msg.sender.call{value: assets}("");  // @audit Callback
    totalAssets -= assets;  // @audit Updated AFTER
}

function pricePerShare() public view returns (uint256) {
    return totalAssets * 1e18 / totalSupply;  // @audit Stale totalAssets!
}
\`\`\`

**Attack Flow** (dForce \$3.7M exploit):
1. Attacker withdraws from Curve pool
2. During callback, Curve's get_virtual_price() returns stale value
3. dForce protocol reads this wrong price for collateral
4. Attacker borrows more than collateral allows
5. Profit from price discrepancy

**Search Queries**:
\`\`\`
Grep("view.*returns|external.*view", glob="**/*.sol")
Grep("getPrice|pricePerShare|totalAssets", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- Do view functions depend on state updated after external calls?
- Do external protocols use these view functions?
- Is there a "read-only reentrancy" lock?

### Pattern 5: Token Callback Reentrancy

**Root Cause**: Hidden Callbacks in Token Standards

\`\`\`solidity
// VULNERABLE: ERC721 safeTransferFrom triggers callback
function stake(uint256 tokenId) external {
    nft.safeTransferFrom(msg.sender, address(this), tokenId);  // @audit Callback!
    userStake[msg.sender] += 1;  // @audit After callback
}

// ERC777 tokensReceived hook
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);  // @audit ERC777 hook!
    userDeposit[msg.sender] += amount;  // @audit After callback
}

// ERC1155 onERC1155Received callback
function mint(uint256 id, uint256 amount) external {
    _mint(msg.sender, id, amount, "");  // @audit Triggers onERC1155Received!
    totalMinted += amount;  // @audit After callback
}
\`\`\`

**Attack Flow** (Omni \$1.43M exploit):
1. Attacker calls stake() with malicious NFT receiver
2. safeTransferFrom triggers onERC721Received callback
3. In callback, attacker re-enters stake() or other functions
4. State manipulated before original stake() completes

**Token Standards with Callbacks**:

| Standard | Callback Function | Trigger |
|----------|------------------|---------|
| ERC721 | onERC721Received | safeTransferFrom, safeMint |
| ERC777 | tokensReceived, tokensToSend | transfer, transferFrom |
| ERC1155 | onERC1155Received | safeTransferFrom, mint |
| ERC1363 | onTransferReceived | transferAndCall |

**Search Queries**:
\`\`\`
Grep("safeTransferFrom|safeMint|safeTransfer", glob="**/*.sol")
Grep("onERC721Received|onERC1155Received|tokensReceived", glob="**/*.sol")
Grep("ERC777|ERC1155|ERC1363|ERC721", glob="**/*.sol")
\`\`\`

**Verification Questions**:
- What token standard is used?
- Does the standard have callbacks?
- Is state updated before the token transfer?

---

## ReentrancyGuard Analysis

### Check Guard Coverage

\`\`\`
Grep("nonReentrant|ReentrancyGuard|_locked", glob="**/*.sol")
\`\`\`

### Verify Protection Scope

| Protection Level | Coverage | Bypass |
|-----------------|----------|--------|
| Single function | Only that function | Cross-function |
| Single contract | All functions in contract | Cross-contract |
| Cross-contract | Multiple contracts | Complex dependency |

### Common Guard Mistakes

\`\`\`solidity
// VULNERABLE: Guard on wrong function
contract Vault {
    function deposit() external nonReentrant { ... }  // Guarded
    function withdraw() external { ... }  // NOT guarded! ← BUG
}

// VULNERABLE: Internal function not protected
function _transfer() internal {  // No guard
    msg.sender.call{value: amount}("");
}
function publicTransfer() external nonReentrant {
    _transfer();  // Guard bypassed via other entry point
}
\`\`\`

---

## CEI Pattern Verification Checklist

For each function with external calls:

1. **Identify all external calls**
   - Low-level calls (.call, .delegatecall)
   - Token transfers (especially safe* variants)
   - External contract calls

2. **Map state dependencies**
   - Which state variables are read before call?
   - Which state variables are modified after call?

3. **Verify ordering**
   \`\`\`
   ✓ CORRECT: checks → state update → external call
   ✗ WRONG: checks → external call → state update
   \`\`\`

4. **Check cross-function**
   - Can other functions be called during callback?
   - Do they share the same state?

---

## Search Query Reference

\`\`\`
# Find external calls
Grep("\\\\.call\\\\{|transfer\\\\(|send\\\\(", glob="**/*.sol")
Grep("safeTransfer|safeMint|safeTransferFrom", glob="**/*.sol")

# Find callbacks
Grep("receive\\\\(\\\\)|fallback\\\\(\\\\)", glob="**/*.sol")
Grep("onERC721Received|onERC1155Received|tokensReceived", glob="**/*.sol")

# Find reentrancy guards
Grep("nonReentrant|ReentrancyGuard|_locked", glob="**/*.sol")

# Find view functions (read-only reentrancy)
Grep("view.*returns.*uint|external.*view", glob="**/*.sol")
Grep("totalAssets|pricePerShare|getPrice", glob="**/*.sol")

# Find token standards with hooks
Grep("ERC777|ERC1155|ERC721|ERC1363", glob="**/*.sol")
\`\`\`

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "We have ReentrancyGuard" | Guard only protects single contract. Cross-contract reentrancy bypasses it. |
| "We use SafeERC20" | SafeERC20 doesn't prevent callbacks, only handles return values. ERC777 still has hooks. |
| "The token is standard ERC20" | Verify on-chain. Many tokens implement ERC777 hooks silently. |
| "State is updated first" | Check cross-function. Other functions might read stale state during callback. |
| "It's just a view function" | Read-only reentrancy cost dForce \$3.7M. View functions expose stale state. |
| "External call is to trusted contract" | Trusted contracts can have callbacks to untrusted. Trace the full call chain. |
| "Nobody would do this" | Automated MEV bots scan for reentrancy 24/7. If it's exploitable, it will be exploited. |`,
}

const tokenSkill: BuiltinSkill = {
  name: "token",
  description: `Auto-loaded by token-auditor agent during Phase 2. Provides detection patterns for: fee-on-transfer, rebasing tokens, ERC777 hooks, ERC721/1155 callbacks, missing return values, blacklist/pausable, low decimals. Core artifact: Token Compatibility Matrix.`,
  template: `# Token Vulnerability Patterns

This skill provides comprehensive knowledge for identifying token-related vulnerabilities in smart contracts.

## Overview

Not all tokens follow the "happy path" of standard implementations. Protocols must handle edge cases from fee tokens, rebasing tokens, callback tokens, and malicious tokens.

## Token Weirdness Categories

### 1. Fee-On-Transfer Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes transfer amount equals received amount
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    balances[msg.sender] += amount; // May be more than received!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function deposit(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;
    balances[msg.sender] += received;
}
\`\`\`

**Common Fee Tokens:**
- PAXG (0.02% fee)
- STA (1% fee)
- USDT (potential fee, currently 0)

**Detection:**
\`\`\`
Grep("transferFrom.*\\\\+=|transfer.*\\\\+=", glob="**/*.sol")
\`\`\`

---

### 2. Rebasing Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Caches balance that will change
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakedAmount[msg.sender] = amount; // Becomes stale!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use shares instead of amounts
function stake(uint256 amount) external {
    uint256 totalBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - totalBefore;

    uint256 shares = totalShares == 0
        ? received
        : received * totalShares / totalBefore;
    userShares[msg.sender] += shares;
    totalShares += shares;
}
\`\`\`

**Common Rebasing Tokens:**
- stETH (positive rebase daily)
- AMPL (elastic supply)
- OHM (rebasing)
- aTokens (AAVE interest)

**Detection:**
- Look for balance caching
- Check if protocol claims to support stETH, AMPL

---

### 3. ERC777 Callback Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: State updated after transfer
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    token.transfer(msg.sender, amount); // Triggers tokensReceived!
    balances[msg.sender] -= amount; // Too late!
}
\`\`\`

**ERC777 Hooks:**
- \`tokensToSend()\` - Called BEFORE transfer on sender
- \`tokensReceived()\` - Called AFTER transfer on recipient

**Detection:**
\`\`\`
Grep("IERC777|tokensReceived|tokensToSend", glob="**/*.sol")
\`\`\`

---

### 4. ERC721/1155 Callback Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: safeTransfer triggers callback
function claimNFT(uint256 tokenId) external {
    nft.safeTransferFrom(address(this), msg.sender, tokenId);
    // onERC721Received callback runs HERE
    claimed[tokenId] = true; // State update after callback!
}
\`\`\`

**Callback Functions:**
- \`onERC721Received()\` - ERC721 safeTransfer
- \`onERC1155Received()\` - ERC1155 safeTransfer
- \`onERC1155BatchReceived()\` - ERC1155 safeBatchTransfer

**Detection:**
\`\`\`
Grep("safeTransferFrom|safeMint|safeTransfer", glob="**/*.sol")
\`\`\`

---

### 5. Missing Return Value (USDT)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: USDT doesn't return bool
function deposit(uint256 amount) external {
    bool success = token.transfer(address(this), amount);
    require(success, "Transfer failed"); // USDT reverts here!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

function deposit(uint256 amount) external {
    token.safeTransferFrom(msg.sender, address(this), amount);
}
\`\`\`

**Tokens Without Return:**
- USDT
- BNB
- Some older tokens

**Detection:**
\`\`\`
Grep("transfer\\\\(|transferFrom\\\\(", glob="**/*.sol")
\`\`\`
Check if using SafeERC20 wrapper.

---

### 6. Blacklist/Pausable Tokens

**Risk:** Transfers can be blocked, causing DoS.

**Affected Tokens:**
- USDC (blacklist)
- USDT (blacklist + pausable)
- DAI (pausable)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Can be blocked if recipient blacklisted
function withdraw() external {
    token.transfer(msg.sender, balances[msg.sender]); // May revert!
}
\`\`\`

**Mitigation:**
- Use pull-over-push pattern
- Allow alternate withdrawal addresses
- Handle transfer failures gracefully

---

### 7. Low Decimal Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Precision loss with low decimals
// WBTC has 8 decimals, not 18
uint256 priceInWei = wbtcAmount * ethPrice / 1e18; // Wrong scale!
\`\`\`

**Common Low Decimal Tokens:**
- WBTC (8 decimals)
- USDC (6 decimals)
- USDT (6 decimals)

**Detection:**
\`\`\`
Grep("decimals|1e18|1e6|1e8", glob="**/*.sol")
\`\`\`

---

### 8. Approval Race Condition

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Front-runnable approve
token.approve(spender, newAmount);
\`\`\`

**Attack:**
1. User has 100 approved
2. User calls approve(50) to reduce
3. Attacker front-runs: transferFrom(100)
4. Approve(50) executes
5. Attacker calls: transferFrom(50)
6. Total stolen: 150

**Secure Pattern:**
\`\`\`solidity
// Reset to 0 first, or use increaseAllowance
token.approve(spender, 0);
token.approve(spender, newAmount);

// Or use OZ increaseAllowance/decreaseAllowance
token.increaseAllowance(spender, amount);
\`\`\`

---

## Token Compatibility Matrix

| Token | Fee | Rebase | Blacklist | Callback | Return |
|-------|-----|--------|-----------|----------|--------|
| USDT | No* | No | Yes | No | None |
| USDC | No | No | Yes | No | Yes |
| DAI | No | No | No | No | Yes |
| stETH | No | Yes | No | No | Yes |
| WBTC | No | No | No | No | Yes |
| PAXG | Yes | No | No | No | Yes |
| ERC777 | No | No | No | Yes | Yes |

*USDT has fee mechanism but set to 0

---

## Token Audit Checklist

- [ ] Balance changes measured, not assumed (fee tokens)
- [ ] Shares used instead of amounts (rebasing tokens)
- [ ] CEI pattern followed for callbacks (ERC721/777/1155)
- [ ] SafeERC20 used for transfers
- [ ] Blacklist handling considered
- [ ] Decimal precision handled correctly
- [ ] Approval race condition mitigated
- [ ] Zero-amount transfers handled

## Severity Classification

### Critical
- ERC777 reentrancy
- ERC721/1155 callback reentrancy
- Fee token accounting mismatch

### High
- Rebasing token balance caching
- Missing return value handling
- Decimal precision errors

### Medium
- Blacklist DoS potential
- Approval race condition
- No zero-amount validation`,
}


export const builtinSkills: BuiltinSkill[] = [
  auditSkill,
  code_analysisSkill,
  docs_analysisSkill,
  pocSkill,
  lendingSkill,
  stakingSkill,
  vault_erc4626Skill,
  reportSkill,
  access_controlSkill,
  cross_chainSkill,
  economic_attackSkill,
  flashloanSkill,
  logic_errorSkill,
  oracleSkill,
  reentrancySkill,
  tokenSkill,
]

export function getBuiltinSkills(): BuiltinSkill[] {
  return builtinSkills
}

export function getBuiltinSkill(name: string): BuiltinSkill | undefined {
  return builtinSkills.find(s => s.name === name)
}
