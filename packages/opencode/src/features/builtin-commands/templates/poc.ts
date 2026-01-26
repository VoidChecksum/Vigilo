export const POC_TEMPLATE = `# /poc - Proof of Concept Generation & Validation

Generates and validates Foundry PoC tests from attack scenario documents.

## Usage

\`\`\`
/poc [finding-path.md]         # Generate PoC for specific finding
/poc .vigilo/findings/high/    # Generate PoCs for all high findings
/poc --validate-only           # Re-run validation without regenerating
\`\`\`

---

## Core Principle

\`\`\`
1 Attack Scenario = 1 PoC Code
\`\`\`

---

## Workflow

<critical>
**TodoWrite for each finding. Track validation status.**
\`\`\`
TodoWrite([
  { id: "read-scenario", content: "Read attack scenario from finding", status: "pending", priority: "high" },
  { id: "generate-poc", content: "Generate Foundry PoC test", status: "pending", priority: "high" },
  { id: "run-test", content: "Execute forge test", status: "pending", priority: "high" },
  { id: "validate-impact", content: "Verify PoC proves claimed impact", status: "pending", priority: "high" },
  { id: "log-result", content: "Write validation log", status: "pending", priority: "medium" }
])
\`\`\`
</critical>

---

## Part 1: PoC Code Generation

### Step 1: Read Attack Scenario

\`\`\`
Read(".vigilo/findings/{severity}/{auditor}/{Severity}-{id}-{title}.md")
\`\`\`

Extract: Finding ID, Bug Class, Preconditions, Attack Steps, Impact, Vulnerable Code

### Step 2: Generate PoC

**File**: \`test/poc/{Severity}-{id}-{title}.t.sol\`

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
        console2.log("=== Initial State ===");
        
        // 2. Execute attack steps
        console2.log("=== Executing Attack ===");
        
        // 3. Log final state
        console2.log("=== Final State ===");
        
        // 4. Assert impact
        // CRITICAL: Must prove the claimed impact
    }
}
\`\`\`

### Step 3: PoC Checklist

- [ ] setUp(): Fully reproduce preconditions
- [ ] Actor labels: Use \`makeAddr()\` for all addresses
- [ ] console2.log: Output before/after attack state
- [ ] Attack steps: Follow scenario order exactly
- [ ] **Impact assertion: Directly prove scenario's claimed impact** (required)

---

## Part 2: Foundry Validation

### Core Principle

\`\`\`
Test Pass ≠ Vulnerability Validated
\`\`\`

**Goal**: Verify that the Attack Scenario's claimed Impact actually occurs

### Step 1: Execute Test

\`\`\`bash
forge test --match-test "test_Exploit_{ID}" -vvv
\`\`\`

| Verbosity | Use Case |
|-----------|----------|
| \`-vvv\` | Default recommended |
| \`-vvvvv\` | Detailed debugging |

### Step 2: Analyze Results

| Result | Meaning | Action |
|--------|---------|--------|
| PASS + Impact proven | Vulnerability valid | → Complete, mark VALIDATED |
| PASS + Impact unclear | Insufficient verification | → Strengthen assertions |
| FAIL | Issue occurred | → Fix PoC (max 3 attempts) |

### Step 3: Impact Verification

\`\`\`
Scenario Impact → Assertion Mapping
─────────────────────────────────────
"Vault drain"     → assertGt(attackerAfter, attackerBefore)
"Collateral loss" → assertLt(userAfter, userBefore)
"Admin bypass"    → assertTrue(attacker.hasRole(ADMIN))
"Price manipulation" → assertGt(priceAfter, priceBefore * 2)
"DoS"             → vm.expectRevert()
\`\`\`

### Step 4: Modification Workflow

\`\`\`
Test failure or Impact mismatch
          ↓
    Fix PoC (max 3 attempts)
          ↓
    After 3 failures → Review Attack Scenario
          ↓
    If scenario needs update → Reverse-modify finding
\`\`\`

**If PoC validation differs from scenario, update Attack Scenario**:
- Expected profit ≠ actual profit → Update Impact numbers
- Additional precondition needed → Update Preconditions
- Exploit impossible → Downgrade severity or mark Invalid

---

## Output Files

**Files** (use same naming format \`{Severity}-{id}-{title}\`):
\`\`\`
test/poc/H-01-donation-attack.t.sol            # PoC code (project root)
.vigilo/poc/H-01-donation-attack.md            # Validation log
.vigilo/findings/high/logic/H-01-donation-attack.md  # (Modified) Attack Scenario
\`\`\`

### Validation Log Format

\`\`\`markdown
# PoC Validation: H-01-donation-attack

## Status: VALIDATED | NEEDS_REVIEW | INVALIDATED

## Test Command
\\\`\\\`\\\`bash
forge test --match-test test_Exploit_H01 -vvv
\\\`\\\`\\\`

## Console Output
\\\`\\\`\\\`
[PASS] test_Exploit_H01()
=== Initial State ===
  Attacker balance: 1 ETH
  Vault balance: 100 ETH
=== Final State ===
  Attacker balance: 101 ETH
  Vault balance: 0 ETH
\\\`\\\`\\\`

## Impact Verification
- Claimed: "Drain entire vault"
- Proven: Attacker gained 100 ETH from vault
- Assessment: VALIDATED - impact matches claim

## Attempts
1. Initial: PASS
\`\`\`

---

## Anti-Patterns

| Pattern | Why Wrong |
|---------|-----------|
| Empty assertions | Test passes but proves nothing |
| Hardcoded values | Fragile, doesn't adapt to setup |
| Missing console.log | Can't verify what happened |
| Single assertion | Need before/after to prove change |
| Skipping failures | Must investigate why test fails |

---

## Final Report

\`\`\`
=== PoC Validation Complete ===

Finding: {finding_id}
Status: {VALIDATED | NEEDS_REVIEW | INVALIDATED}

Files:
  PoC:  test/poc/{finding_id}.t.sol
  Log:  .vigilo/poc/{finding_id}.md

Test Result: {PASS | FAIL}
Attempts: {N}
Impact Verified: {Yes | No | Partial}
\`\`\``
