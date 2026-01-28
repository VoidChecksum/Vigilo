---
name: lending
description: >
  Auto-loaded by defi-auditor agent during Phase 2 when analyzing lending protocols.
  Provides patterns for: liquidation logic, interest rate models, collateral management,
  health factor calculations, bad debt handling. Core vulnerabilities: self-liquidation,
  precision loss, oracle manipulation, collateral factor attacks.
user-invocable: false
---

# Lending Protocol Patterns

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
```solidity
// DANGEROUS: Liquidator bonus too high
uint256 constant LIQUIDATION_BONUS = 15e16; // 15%

function liquidate(address user, uint256 repayAmount) external {
    // Attacker can:
    // 1. Borrow at 80% LTV
    // 2. Wait for tiny price drop
    // 3. Self-liquidate with 15% bonus
    // = Free 15% - (100% - 80%) = Net profit!
}
```

**Check:** Liquidation bonus should be less than (100% - Max LTV).

### 2. Liquidation Cascade

```solidity
// When one liquidation triggers another
// Large position liquidated → price drops → more liquidations

// Mitigations:
// - Gradual liquidation (partial)
// - Circuit breakers
// - Liquidation delays
```

### 3. Bad Debt Accumulation

**Vulnerable Pattern:**
```solidity
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
```

---

## Interest Rate Model

### Standard Jump Rate Model

```solidity
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
```

### Interest Rate Vulnerabilities

**1. Rate Manipulation**
```solidity
// Attacker can manipulate utilization
// 1. Flash loan large amount
// 2. Deposit → lower utilization → lower rates
// 3. Borrow at low rate
// 4. Withdraw and repay flash loan
```

**2. Precision Loss**
```solidity
// DANGEROUS: Interest rounds to 0 for small amounts
uint256 interest = principal * rate / SECONDS_PER_YEAR;
// If principal * rate < SECONDS_PER_YEAR, interest = 0

// SOLUTION: Accumulate interest with high precision
uint256 interestAccumulator; // Ray (1e27) precision
```

---

## Collateral Vulnerabilities

### 1. Collateral Factor Changes

```solidity
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
```

### 2. Collateral Oracle Manipulation

```solidity
// Collateral valued using manipulable oracle
// Attacker inflates collateral value → borrows more → profits
// See oracle vulnerability patterns
```

### 3. Toxic Collateral

```solidity
// Collateral that can't be liquidated:
// - Pausable tokens
// - Blacklistable tokens
// - Low liquidity tokens

// Mitigation: Whitelist collateral carefully
```

---

## Borrowing Vulnerabilities

### 1. Borrow Cap Bypass

```solidity
// VULNERABLE: Cap checked only on new borrows
function borrow(uint256 amount) external {
    require(totalBorrowed + amount <= borrowCap);
    // Interest accrual can push over cap!
}

// Check on any state-changing operation
```

### 2. Same-Block Borrow-Repay

```solidity
// EXPLOIT: Borrow and repay in same block
// No interest accrued = free leverage

function borrow(uint256 amount) external {
    require(lastBorrowBlock[msg.sender] < block.number);
    lastBorrowBlock[msg.sender] = block.number;
    // ...
}
```

---

## Health Factor Calculations

### Standard Formula

```
Health Factor = (Collateral Value × LTV) / Debt Value

Health Factor > 1: Safe
Health Factor < 1: Liquidatable
```

### Vulnerabilities

**1. Stale Health Factor**
```solidity
// DANGEROUS: Cached health factor
mapping(address => uint256) public healthFactors;

// Health factors become stale as prices change
// Always compute in real-time
```

**2. Rounding Direction**
```solidity
// SECURE: Round health factor DOWN (safer)
uint256 healthFactor = collateralValue * 1e18 / debtValue;

// Round debt UP when calculating
uint256 debt = (borrowed * (1e18 + interest) + 1e18 - 1) / 1e18;
```

---

## Common AAVE/Compound Patterns

### Reserve Factor

```solidity
// Protocol takes cut of interest
uint256 interestToProtocol = interest * reserveFactor / 1e18;
uint256 interestToSuppliers = interest - interestToProtocol;
```

### Supply Index

```solidity
// Track earnings per token
// supplyIndex increases as interest accrues
uint256 newIndex = oldIndex + (interest * 1e18 / totalSupply);

// User earnings = balance * (currentIndex - userIndex) / 1e18
```

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
- Rate model edge cases
