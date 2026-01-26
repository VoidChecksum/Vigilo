---
name: oracle
description: >
  Auto-loaded by oracle-auditor agent during Phase 2.
  Provides detection patterns for: stale prices, deprecated Chainlink functions,
  L2 sequencer downtime, decimal mismatches, spot price manipulation, oracle DoS.
  Core artifact: Oracle Integration Matrix.
user-invocable: false
---

# Oracle Vulnerability Patterns

This skill provides comprehensive knowledge for identifying oracle-related vulnerabilities in smart contracts.

## Overview

Oracles bridge off-chain data to on-chain contracts. Every oracle integration is a trust assumption that can be exploited if not properly validated.

## Detection Patterns

### 1. Stale Price Data

**Vulnerable Pattern:**
```solidity
// DANGEROUS: No freshness check
(, int256 price,,,) = priceFeed.latestRoundData();
return uint256(price);
```

**Secure Pattern:**
```solidity
(uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) =
    priceFeed.latestRoundData();
require(updatedAt > block.timestamp - HEARTBEAT, "Stale price");
require(answeredInRound >= roundId, "Stale round");
require(price > 0, "Invalid price");
```

**Search Pattern:**
```
Grep("latestRoundData", glob="**/*.sol")
```
Then verify each usage checks `updatedAt` timestamp.

---

### 2. Deprecated Chainlink Functions

**Vulnerable Pattern:**
```solidity
// DEPRECATED: Can return stale data
int256 price = priceFeed.latestAnswer();
```

**Detection:**
```
Grep("latestAnswer|latestTimestamp|latestRound\\(\\)", glob="**/*.sol")
```

---

### 3. L2 Sequencer Downtime (Arbitrum/Optimism)

**Vulnerable Pattern:**
```solidity
// DANGEROUS on L2: No sequencer check
(, int256 price,,,) = priceFeed.latestRoundData();
```

**Secure Pattern:**
```solidity
// Check sequencer uptime feed first
(, int256 answer,, uint256 updatedAt,) = sequencerFeed.latestRoundData();
bool isSequencerUp = answer == 0;
require(isSequencerUp, "Sequencer down");
require(block.timestamp - updatedAt > GRACE_PERIOD, "Grace period");

// Then get price
(, int256 price,,,) = priceFeed.latestRoundData();
```

**Detection:**
- Check if deployed on L2 (Arbitrum, Optimism, Base)
- Search for sequencer uptime feed integration
```
Grep("sequencer|SEQUENCER|isSequencerUp", glob="**/*.sol")
```

---

### 4. Decimal Precision Mismatch

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Assumes 8 decimals
uint256 priceInUsd = uint256(price) * 1e10; // Scale to 18 decimals
```

**Secure Pattern:**
```solidity
uint8 decimals = priceFeed.decimals();
uint256 scaledPrice = uint256(price) * (10 ** (18 - decimals));
```

**Detection:**
```
Grep("decimals\\(\\)|1e10|1e8|\\* 10", glob="**/*.sol")
```

---

### 5. Spot Price Manipulation (Flash Loan Vulnerable)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Manipulable in single tx
(uint112 reserve0, uint112 reserve1,) = pair.getReserves();
uint256 price = reserve1 * 1e18 / reserve0;
```

**Secure Pattern:**
- Use TWAP (Time-Weighted Average Price)
- Use Chainlink or other manipulation-resistant oracle
- Add minimum TWAP period (>= 30 minutes)

**Detection:**
```
Grep("getReserves|slot0|observe", glob="**/*.sol")
```

---

### 6. Oracle Revert DoS

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Revert blocks entire function
function getPrice() external view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);
}
```

**Secure Pattern:**
```solidity
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
```

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

- [ ] Price freshness validated (`updatedAt` check)
- [ ] Zero/negative price rejected
- [ ] Round completeness verified (`answeredInRound >= roundId`)
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
- `integration-patterns/chainlink/SKILL.md`
