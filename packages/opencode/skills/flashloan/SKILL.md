---
name: flashloan
description: >
  Auto-loaded by flashloan-auditor agent during Phase 2.
  Provides detection patterns for: price manipulation, governance manipulation,
  collateral manipulation, reward manipulation, oracle manipulation via flash loans.
  Core artifact: Flash Loan Attack Flow diagram.
user-invocable: false
---

# Flash Loan Attack Patterns

This skill provides comprehensive knowledge for identifying flash loan attack vulnerabilities in smart contracts.

## Overview

Flash loans provide unlimited capital for a single transaction. Any logic that depends on current state (balances, prices, voting power) without proper protection is potentially vulnerable.

## Why Flash Loan Attacks Happen (Root Causes)

### Root Cause 1: Atomic Transaction Assumption Violation

Developers assume state remains consistent within a transaction. Flash loans break this assumption by allowing unlimited capital injection and withdrawal within a single block.

```solidity
// VULNERABLE: Assumes balance is stable within transaction
function liquidate(address user) external {
    uint256 collateral = collateralBalance[user];  // @audit Can be inflated
    uint256 debt = debtBalance[user];
    require(debt > collateral * LTV, "Healthy");
    // Liquidate...
}

// Attacker's flow:
// 1. Flash loan 1M tokens
// 2. Deposit as collateral → collateralBalance[attacker] += 1M
// 3. Call liquidate(victim) at manipulated state
// 4. Withdraw collateral
// 5. Repay flash loan
```

**Attacker's view**: "I can temporarily inflate any balance-based metric within a single transaction. The contract assumes state is stable, but I control it."

### Root Cause 2: Balance-Based Logic Without Time Lock

Any function that reads balances (token, collateral, voting power) and makes decisions in the same transaction is vulnerable.

```solidity
// DANGEROUS: Balance read and action in same tx
function borrow(uint256 amount) external {
    uint256 collateralValue = getCollateralValue(msg.sender);  // @audit Flashloan-inflatable
    require(amount <= collateralValue * LTV, "Insufficient collateral");
    _borrow(amount);
}

function getCollateralValue(address user) public view returns (uint256) {
    return token.balanceOf(address(this)) * userShare[user] / totalShares;
}
```

**Attacker's view**: "I deposit tokens, borrow against them, then withdraw. The contract never checks if I actually own the collateral after the transaction."

### Root Cause 3: Price Derivation from Manipulable Sources

Spot prices from DEXes can be manipulated within a single block via flash loans.

```solidity
// DANGEROUS: Spot price from AMM
function getPrice() public view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
    return reserve1 * 1e18 / reserve0;  // @audit Manipulable!
}

function liquidate(address user) external {
    uint256 price = getPrice();  // Attacker controls this
    uint256 collateralValue = collateral[user] * price;
    require(debt[user] > collateralValue, "Healthy");
    // Liquidate at wrong price...
}
```

**Attacker's view**: "I flash loan one side of the pair, dump it to crash the price, then liquidate at the manipulated rate."

### Root Cause 4: Governance Without Historical Snapshots

Voting power based on current balance allows flash loan governance attacks.

```solidity
// DANGEROUS: Current balance voting
function castVote(uint256 proposalId, bool support) external {
    uint256 votes = token.balanceOf(msg.sender);  // @audit Flash loanable!
    _recordVote(proposalId, msg.sender, votes, support);
}
```

**Attacker's view**: "I flash loan governance tokens, vote with them, then repay. The proposal passes with my temporary voting power."

---

## Attack Categories

### 1. Price Manipulation Attacks

**Root Cause**: Root Cause 3 (Price Derivation from Manipulable Sources)

**Vulnerable Pattern:**
```solidity
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
```

**Attack Flow:**
```
1. Flash loan large amount of token0
2. Dump into AMM → reserve1/reserve0 crashes
3. Call liquidate() at manipulated price
4. Buy back token0 cheap
5. Repay flash loan
6. Profit from unfair liquidation
```

**Detection:**
```
Grep("getReserves|slot0\\(\\)|sqrtPriceX96", glob="**/*.sol")
```

---

### 2. Governance Manipulation

**Root Cause**: Root Cause 4 (Governance Without Historical Snapshots)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Balance-based voting
function castVote(uint256 proposalId, bool support) external {
    uint256 votes = token.balanceOf(msg.sender); // Flash loanable!
    _recordVote(proposalId, msg.sender, votes, support);
}
```

**Secure Pattern:**
```solidity
// Use snapshot at proposal creation
function castVote(uint256 proposalId, bool support) external {
    uint256 snapshotBlock = proposals[proposalId].snapshotBlock;
    uint256 votes = token.getPastVotes(msg.sender, snapshotBlock);
    _recordVote(proposalId, msg.sender, votes, support);
}
```

**Detection:**
```
Grep("balanceOf.*vote|vote.*balanceOf", glob="**/*.sol")
Grep("propose|castVote|delegate", glob="**/*.sol")
```

---

### 3. Collateral Manipulation

**Root Cause**: Root Cause 2 (Balance-Based Logic Without Time Lock)

**Vulnerable Pattern:**
```solidity
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
```

**Attack Flow:**
```
1. Flash loan tokens
2. Deposit as collateral → inflate collateralValue
3. Borrow maximum amount
4. Withdraw collateral
5. Repay flash loan (but keep borrowed funds)
```

---

### 4. Reward Manipulation

**Root Cause**: Root Cause 2 (Balance-Based Logic Without Time Lock)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Balance-based rewards
function claimRewards() external {
    uint256 share = token.balanceOf(msg.sender) * 1e18 / token.totalSupply();
    uint256 reward = pendingRewards * share;
    // Distribute reward...
}
```

**Detection:**
```
Grep("reward.*balanceOf|balanceOf.*reward", glob="**/*.sol")
Grep("claim|harvest|distribute", glob="**/*.sol")
```

---

### 5. Oracle Manipulation

**Root Cause**: Root Cause 3 (Price Derivation from Manipulable Sources)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: On-chain oracle from DEX
function updatePrice() external {
    uint256 spotPrice = dex.getSpotPrice(token0, token1);
    lastPrice = spotPrice; // Can be manipulated!
}
```

**Mitigation:**
- Use TWAP with sufficient period (>= 30 minutes)
- Use manipulation-resistant oracles (Chainlink)
- Add price deviation checks

---

## Flash Loan Protection Patterns

### 1. Snapshot/Checkpoint Pattern
```solidity
// Record state at specific block
mapping(address => mapping(uint256 => uint256)) private _checkpoints;

function getPastBalance(address account, uint256 blockNumber)
    public view returns (uint256)
{
    require(blockNumber < block.number, "Future lookup");
    return _checkpoints[account][blockNumber];
}
```

### 2. Time-Weighted Average
```solidity
// TWAP resists single-block manipulation
function getTWAP(uint32 period) public view returns (uint256) {
    require(period >= MIN_TWAP_PERIOD, "Period too short");
    (int56[] memory tickCumulatives,) = pool.observe([period, 0]);
    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
    return uint256(int256(tickDelta) / int256(uint256(period)));
}
```

### 3. Same-Block Check
```solidity
// Prevent same-block manipulation
mapping(address => uint256) private lastActionBlock;

modifier notSameBlock() {
    require(lastActionBlock[msg.sender] < block.number, "Same block");
    lastActionBlock[msg.sender] = block.number;
    _;
}
```

### 4. Minimum Lock Period
```solidity
// Require time commitment
mapping(address => uint256) private depositTime;

function withdraw() external {
    require(block.timestamp >= depositTime[msg.sender] + MIN_LOCK, "Locked");
    // Process withdrawal...
}
```

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
- Incomplete snapshot coverage

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "We use TWAP, so we're safe" | TWAP period might be too short (< 10 min). Attacker can still manipulate within the window. Verify period >= 30 min. |
| "Flash loans are too expensive" | dYdX and Balancer offer 0% fees. Attacker only needs profit > gas costs. Even 0.05% AAVE fee is negligible for large attacks. |
| "Our collateral is locked" | Lock period doesn't prevent same-block attacks. Attacker deposits, borrows, withdraws all in one tx before lock expires. |
| "We have snapshot voting" | Snapshot must be taken BEFORE proposal creation. If snapshot is at proposal block, attacker can still flash loan vote. |
| "Spot price is from Uniswap V3" | V3 slot0 is even more manipulable than V2. Attacker can move price with single large swap. Use TWAP or Chainlink. |
| "Nobody would attack us" | Automated MEV bots scan for flash loan vulnerabilities 24/7. If exploitable, it WILL be exploited. |
| "We're a small protocol" | Flash loan attacks scale. Attacker profits from ANY unprotected balance-based logic, regardless of TVL. |
