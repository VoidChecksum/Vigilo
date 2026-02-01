# Standard Audit Report Template

General-purpose security audit report template for professional engagements.

---

## Full Report Structure

```markdown
# Security Audit Report

**Protocol:** {Protocol Name}
**Version:** {Commit Hash / Version}
**Date:** {YYYY-MM-DD}
**Auditor:** Vigilo Security Framework

---

## Executive Summary

### Overview

{Protocol Name} is a {brief description of what the protocol does}.
This security audit was conducted on {date range} covering {X} smart contracts
totaling {Y} lines of Solidity code.

### Scope

| Contract | Lines | Description |
|----------|-------|-------------|
| `Vault.sol` | 250 | Main vault logic |
| `Token.sol` | 150 | ERC20 token |
| `Router.sol` | 300 | Swap routing |

### Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 5 |
| Informational | 4 |

### Risk Rating

**Overall Risk: MEDIUM**

The protocol demonstrates solid security practices in most areas, but critical
attention should be paid to the access control and reentrancy findings before
mainnet deployment.

---

## Findings

### Critical Severity

*No critical severity findings.*

---

### High Severity

#### [H-01] Reentrancy in withdraw() allows complete fund drain

**Severity:** High
**Status:** Open
**Location:** `src/Vault.sol#L100-L110`

##### Description

The `withdraw()` function violates the Checks-Effects-Interactions pattern by
making an external call before updating state.

```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");

    (bool success, ) = msg.sender.call{value: amount}("");  // External call
    require(success, "Transfer failed");

    balances[msg.sender] -= amount;  // State update AFTER - vulnerable
}
```

##### Impact

An attacker can recursively call `withdraw()` before their balance is decremented,
draining all funds from the contract.

##### Proof of Concept

See: `test/poc/H-01-reentrancy.t.sol`

##### Recommendation

1. Add OpenZeppelin's `nonReentrant` modifier
2. Follow CEI pattern - update state before external calls

```solidity
function withdraw(uint256 amount) external nonReentrant {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount;  // State update FIRST
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

---

#### [H-02] Missing access control on setAdmin()

**Severity:** High
**Status:** Open
**Location:** `src/Vault.sol#L50`

##### Description

The `setAdmin()` function lacks access control, allowing anyone to claim admin
privileges.

```solidity
function setAdmin(address _admin) external {  // No modifier!
    admin = _admin;
}
```

##### Impact

Any user can call this function and become admin, gaining access to all
privileged functions including `emergencyWithdraw()`.

##### Recommendation

Add `onlyOwner` or `onlyAdmin` modifier:

```solidity
function setAdmin(address _admin) external onlyOwner {
    require(_admin != address(0), "Zero address");
    admin = _admin;
    emit AdminChanged(_admin);
}
```

---

### Medium Severity

#### [M-01] Oracle price can be manipulated via flash loan

**Severity:** Medium
**Status:** Open
**Location:** `src/Oracle.sol#L75`

##### Description

The oracle reads spot price from a single DEX pool, which can be manipulated
within a single transaction using flash loans.

##### Impact

Attacker can manipulate the oracle price to:
- Borrow more than their collateral should allow
- Liquidate healthy positions
- Manipulate swap rates

##### Recommendation

1. Use TWAP (Time-Weighted Average Price) instead of spot price
2. Implement price deviation checks
3. Use multiple oracle sources (Chainlink + DEX)

---

### Low Severity

#### [L-01] Missing event emission on state change

**Severity:** Low
**Status:** Open
**Location:** `src/Vault.sol#L75`

##### Description

The `updateConfig()` function changes critical protocol parameters but does not
emit an event.

##### Impact

Off-chain monitoring and indexing services cannot track configuration changes.

##### Recommendation

Emit events for all state changes:

```solidity
event ConfigUpdated(uint256 oldValue, uint256 newValue);

function updateConfig(uint256 newValue) external onlyAdmin {
    emit ConfigUpdated(config, newValue);
    config = newValue;
}
```

---

### Informational

#### [I-01] Use of floating pragma

**Severity:** Informational
**Location:** All contracts

##### Description

Contracts use `pragma solidity ^0.8.0;` instead of a fixed version.

##### Recommendation

Lock pragma to a specific version: `pragma solidity 0.8.20;`

---

## Appendix

### A. Methodology

This audit employed the following techniques:

1. **Manual Code Review** - Line-by-line analysis of all in-scope contracts
2. **Static Analysis** - Automated scanning with Slither and Aderyn
3. **Dynamic Testing** - Foundry-based PoC development
4. **Invariant Testing** - Property-based testing of protocol invariants

### B. Severity Classification

| Severity | Criteria |
|----------|----------|
| Critical | Direct fund loss, protocol insolvency |
| High | Significant fund loss, privilege escalation |
| Medium | Limited fund loss, conditional exploits |
| Low | Best practice violations, edge cases |
| Informational | Code quality, gas optimization |

### C. Disclaimer

This audit does not guarantee the absence of vulnerabilities. The scope was
limited to the contracts and commit hash specified above. The auditor makes
no warranties regarding the security of the protocol.

---

*Report generated by Vigilo Security Framework*
```

---

## Individual Finding Template

For use in `.vigilo/findings/{severity}/{category}/` files:

```markdown
# {ID}: {Title}

## Metadata

- **Severity:** {Critical|High|Medium|Low}
- **Category:** {access-control|reentrancy|logic-error|economic|external-call}
- **Status:** {Open|Confirmed|Fixed|Acknowledged|Disputed}
- **Location:** `{file}#{lines}`

## Description

{Detailed description of the vulnerability}

## Vulnerable Code

```solidity
// Location: src/Contract.sol#L100-L110
{code snippet}
```

## Attack Scenario

### Preconditions

1. {First precondition}
2. {Second precondition}

### Attack Steps

1. {First step}
2. {Second step}
3. {Third step}

### Expected Outcome

{What the attacker achieves}

## Impact

{Qualitative description of impact - NO dollar amounts}

## Recommendation

{Specific fix with code example}

```solidity
// Fixed code
{code snippet}
```

## References

- {Link to similar vulnerability}
- {Relevant documentation}
```

---

## Validation Status Markers

| Status | Meaning |
|--------|---------|
| `VALIDATED` | PoC executed successfully, vulnerability confirmed |
| `NEEDS_REVIEW` | PoC failed or inconclusive, requires manual review |
| `INVALIDATED` | False positive, not a real vulnerability |
| `CONFIRMED` | Protocol team confirmed the issue |
| `FIXED` | Protocol team has deployed a fix |
| `ACKNOWLEDGED` | Protocol team aware but won't fix |
