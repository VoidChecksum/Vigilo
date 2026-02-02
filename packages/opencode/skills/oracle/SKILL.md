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

---

### 8. Pyth Network Vulnerabilities

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Not checking confidence interval
PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
return uint256(price.price);  // @audit No confidence or timestamp check!
```

**Secure Pattern:**
```solidity
PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, MAX_AGE);
require(price.price > 0, "Invalid price");
// Check confidence interval (price.conf should be small relative to price)
require(price.conf * 100 / uint64(price.price) < MAX_CONFIDENCE_PERCENT, "Price uncertain");
```

**Search Queries:**
```
Grep("pyth|Pyth|PythStructs|getPriceUnsafe", glob="**/*.sol")
```

---

### 9. Redstone / API3 Patterns

**Redstone:**
```solidity
// Redstone uses signature-based price feeds
// VULNERABLE: Not validating timestamp
function getPrice(bytes calldata redstoneData) external view returns (uint256) {
    // Redstone data includes signatures - verify freshness
}
```

**API3:**
```solidity
// VULNERABLE: No timestamp check
(int224 value,) = api3Reader.read(dataFeedId);

// SECURE: Check timestamp
(int224 value, uint32 timestamp) = api3ReaderProxy.read();
require(block.timestamp - timestamp < MAX_AGE, "Stale");
```

**Search Queries:**
```
Grep("redstone|Redstone|api3|API3|dataFeedId", glob="**/*.sol")
```

---

### 10. New L2 Oracle Considerations (2025-2026)

| L2 Chain | Sequencer Feed | Special Considerations |
|----------|----------------|------------------------|
| Arbitrum | Yes (required) | L1 block numbers via `ArbSys` |
| Optimism | Yes (required) | Uses L1 blockhash for randomness |
| Base | Yes (required) | Same as Optimism |
| Blast | Yes (required) | Native yield may affect pricing |
| Linea | Yes (recommended) | zkEVM specific timing |
| zkSync Era | No feed yet | Sequencer centralized |
| Scroll | No feed yet | zkEVM, check centralization |

**Base/Optimism Sequencer Check:**
```solidity
address constant SEQUENCER_FEED = 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433;

function checkSequencer() internal view {
    (, int256 answer, uint256 startedAt,,) = 
        AggregatorV3Interface(SEQUENCER_FEED).latestRoundData();
    
    require(answer == 0, "Sequencer down");
    require(block.timestamp - startedAt > GRACE_PERIOD, "Grace period");
}
```

---

### 11. Multi-Oracle / Fallback Patterns

**Secure Multi-Oracle:**
```solidity
function getPrice() public view returns (uint256) {
    // Try primary oracle
    (uint256 price1, bool valid1) = _getChainlinkPrice();
    (uint256 price2, bool valid2) = _getPythPrice();
    
    if (valid1 && valid2) {
        // Both valid - check deviation
        uint256 deviation = _calculateDeviation(price1, price2);
        require(deviation < MAX_DEVIATION, "Oracle deviation");
        return (price1 + price2) / 2;
    }
    
    if (valid1) return price1;
    if (valid2) return price2;
    
    revert("No valid oracle");
}
```

**Search Queries:**
```
Grep("fallback.*oracle|backup.*price|secondary.*feed", glob="**/*.sol")
```

---

### 12. Chronicle Protocol (Scribe)

**Architecture:**
Chronicle implements Scribe, a Schnorr multi-signature based optimistic oracle. Key components:
- **Schnorr Signatures**: Aggregated multi-signature scheme (constant verification cost regardless of validator count)
- **Optimistic Poke**: `opPoke()` submits price updates optimistically; signature verified only if challenged
- **Challenge Period**: 10-minute window to challenge invalid signatures (as of Feb 2025)
- **Toll Gate**: Whitelisted addresses only can read prices on-chain

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Not validating Schnorr signature or challenge period
IScribe scribe = IScribe(0x...);
uint256 price = scribe.read();  // @audit No freshness or signature check!
```

**Secure Pattern:**
```solidity
// SECURE: Verify price freshness and challenge period
IScribe scribe = IScribe(0x...);
(uint256 price, uint256 timestamp) = scribe.readWithAge();
require(block.timestamp - timestamp < MAX_AGE, "Stale price");
// Challenge period: verify no active challenge window
require(scribe.isChallenged() == false, "Price challenged");
```

**Critical Vulnerabilities:**
- **Stale Poke Data**: Using price before challenge period expires
- **Signature Bypass**: Calling `read()` without validating Schnorr aggregation
- **Toll Gate Bypass**: Non-whitelisted caller accessing price feed
- **Challenge Frontrun**: Submitting transaction during active challenge

**Search Queries:**
```
Grep("IScribe|opPoke|poke\\(|read\\(|Chronicle", glob="**/*.sol")
Grep("scribe\\.read|scribe\\.poke", glob="**/*.sol")
```

---

## References

For detailed Chainlink integration patterns, see:
- Chainlink Docs: https://docs.chain.link
- Pyth Network: https://docs.pyth.network
- API3: https://docs.api3.org
- Chronicle Protocol: https://chroniclelabs.org
- Scribe Docs: https://docs.chronicle.build
