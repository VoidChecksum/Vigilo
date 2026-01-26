# Code4rena Report Template (Default)

Template for Code4rena competitive audit contest submissions.

---

## Individual Finding Format

Each High/Medium finding is submitted as a separate issue.

### Finding Template

```markdown
## [H-XX] Title of the Vulnerability

### Links to affected code

https://github.com/{org}/{repo}/blob/{commit}/src/Contract.sol#L100-L120

### Finding description and impact

[Detailed description of the vulnerability]

The function `vulnerable()` in `Contract.sol` is susceptible to [attack type] because:

1. [First reason]
2. [Second reason]

**Vulnerable Code:**

```solidity
function vulnerable(uint256 amount) external {
    // Code snippet showing the vulnerability
    balances[msg.sender] -= amount;  // State change
    (bool success, ) = msg.sender.call{value: amount}("");  // External call AFTER
}
```

### Impact

[Explain the impact in terms of:]
- What can an attacker achieve?
- Who is affected (users, protocol, LPs)?
- What is the severity of the damage?

### Recommended mitigation steps

[Provide specific code changes]

```solidity
function fixed(uint256 amount) external nonReentrant {
    uint256 balance = balances[msg.sender];
    require(balance >= amount, "Insufficient");
    balances[msg.sender] = balance - amount;  // State change FIRST
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

### Proof of Concept

<details>
<summary>Click to expand PoC</summary>

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Contract.sol";

contract ExploitTest is Test {
    Contract target;
    Attacker attacker;

    function setUp() public {
        target = new Contract();
        attacker = new Attacker(address(target));
        // Setup initial state
        vm.deal(address(target), 10 ether);
    }

    function test_Exploit() public {
        uint256 beforeBalance = address(attacker).balance;
        attacker.attack{value: 1 ether}();
        uint256 afterBalance = address(attacker).balance;

        // Assert attacker gained funds
        assertGt(afterBalance, beforeBalance + 9 ether);
    }
}

contract Attacker {
    Contract target;

    constructor(address _target) {
        target = Contract(_target);
    }

    function attack() external payable {
        target.deposit{value: msg.value}();
        target.vulnerable(msg.value);
    }

    receive() external payable {
        if (address(target).balance >= 1 ether) {
            target.vulnerable(1 ether);
        }
    }
}
```

Run with: `forge test --match-test test_Exploit -vvv`

</details>
```

---

## QA Report Format

All Low severity findings are bundled into a single QA Report.

### QA Report Template

```markdown
# QA Report

## Summary

| ID | Title | Severity |
|----|-------|----------|
| L-01 | Missing zero address check | Low |
| L-02 | Event not emitted on state change | Low |
| NC-01 | Inconsistent naming convention | Non-Critical |

---

## Low Risk Findings

### [L-01] Missing zero address check

**Location:** `src/Contract.sol#L50`

```solidity
function setAdmin(address _admin) external onlyOwner {
    admin = _admin;  // No zero address check
}
```

**Recommendation:**
```solidity
function setAdmin(address _admin) external onlyOwner {
    require(_admin != address(0), "Zero address");
    admin = _admin;
}
```

---

### [L-02] Event not emitted on state change

**Location:** `src/Contract.sol#L75`

State change in `updateConfig()` does not emit an event, making off-chain monitoring difficult.

**Recommendation:** Add event emission after state changes.

---

## Non-Critical Findings

### [NC-01] Inconsistent naming convention

**Location:** Multiple files

Some variables use camelCase while others use snake_case.

**Recommendation:** Use consistent naming throughout the codebase.
```

---

## Gas Report Format

```markdown
# Gas Optimization Report

## Summary

| ID | Title | Gas Saved |
|----|-------|-----------|
| G-01 | Use `unchecked` for safe arithmetic | ~200 gas/call |
| G-02 | Cache storage reads | ~100 gas/call |
| G-03 | Use `calldata` instead of `memory` | ~60 gas/call |

---

## Gas Optimizations

### [G-01] Use `unchecked` for safe arithmetic

**Location:** `src/Contract.sol#L100`

Loop counter `i` will never overflow in practice.

**Before:**
```solidity
for (uint256 i = 0; i < length; i++) {
```

**After:**
```solidity
for (uint256 i = 0; i < length; ) {
    // ...
    unchecked { ++i; }
}
```

**Gas Saved:** ~200 gas per iteration
```

---

## Severity Guidelines

| Severity | Criteria | Submission Type |
|----------|----------|-----------------|
| High (3) | Direct fund loss, protocol insolvency | Individual issue |
| Medium (2) | Conditional fund loss, limited impact | Individual issue |
| Low | Best practices, edge cases | QA Report |
| Gas | Efficiency improvements | Gas Report |

---

## Best Practices

1. **One finding per issue** - Don't combine unrelated vulnerabilities
2. **Include code links** - Link to exact lines on GitHub
3. **Provide PoC** - Especially for High/Medium severity
4. **Be specific** - Vague reports get invalidated
5. **Check known issues** - Read the contest README thoroughly
6. **Follow submission format** - Use the exact template structure

---

## Common Mistakes

- Submitting known issues from the README
- Combining multiple findings into one submission
- Missing code references
- Theoretical attacks without realistic path
- Incorrect severity classification
- No PoC for complex vulnerabilities
