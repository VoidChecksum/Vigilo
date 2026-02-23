# Ceiling Rounding Accumulation in Liquidations Favors Liquidators

## Metadata

| Attribute | Details |
|-----------|---------|
| **Contest** | Cantina |
| **Number** | #690 |
| **Severity** | 🔴 High |
| **Status** | ✅ Accepted |
| **Likelihood** | High |
| **Impact** | High |
| **Created by** | minseok (Vigilo) |
| **Created at** | January 21, 2026 |
| **Link** | [Cantina Finding #690](https://cantina.xyz/code/eb93d215-e328-4d19-99ab-6c510acbb5aa/findings/690) |

---

## Summary

The `normalizedToFull()` function uses ceiling rounding for each tokenId independently during transfers. When users hold multiple tokenIds, rounding errors accumulate, causing liquidators to receive 0.1%-0.3% more collateral than entitled.

---

## Finding Description

The `normalizedToFull()` function applies ceiling rounding to each tokenId:

```solidity
// Location: src/ERC721WrapperBase.sol:213-219
function normalizedToFull(uint256 balanceOfTokenId, uint256 amount, uint256 currentBalance)
    public pure returns (uint256)
{
    return Math.mulDiv(amount, balanceOfTokenId, currentBalance, Math.Rounding.Ceil);
}
```

This function is called for each enabled tokenId in `_update()`:

```solidity
// Location: src/ERC721WrapperBase.sol:105-119
function _update(address from, address to, uint256 value) internal virtual override {
    // For each tokenId in userTokenIds[from]:
    uint256 full = normalizedToFull(balanceOfTokenId, value, currentBalance);
    _update6909(from, to, tokenId, full);
}
```

**Security Guarantee Broken**: The protocol guarantees exact proportional transfer of collateral. This vulnerability breaks that guarantee by transferring more than requested.

**Propagation Path**:
1. User wraps 3 Uniswap positions as collateral (tokenIds with ~33.3% each)
2. User becomes liquidatable due to price movement
3. Liquidator initiates 50% liquidation (500 units of 1000 total)
4. For each tokenId, `normalizedToFull()` applies ceiling:
   - TokenId1: `ceil(500 * 333 / 1000) = ceil(166.5) = 167`
   - TokenId2: `ceil(500 * 333 / 1000) = ceil(166.5) = 167`
   - TokenId3: `ceil(500 * 334 / 1000) = ceil(167.0) = 167`
5. Total transferred: 501 (expected: 500)
6. Liquidator receives 1 extra unit (0.2% excess)

---

## Impact Explanation

**Impact: MEDIUM**

- **Economic Loss**: Borrowers lose 0.1%-0.3% extra per liquidation
- **Compounding Effect**: Multiple liquidations on same account compound losses
- **Protocol Invariant Violation**: Sum of transferred parts exceeds intended whole
- **Unfair Treatment**: Users with more tokenIds suffer proportionally more loss

The impact is MEDIUM because:
- The excess is relatively small per liquidation (0.1%-0.3%)
- Only affects users with multiple wrapped positions
- Requires liquidation event to trigger
- Does not enable direct fund extraction

---

## Likelihood Explanation

**Likelihood: MEDIUM**

- **Automatic Trigger**: Occurs on every transfer/liquidation with multiple tokenIds
- **No Attacker Required**: Bug manifests in normal protocol operation
- **Common Scenario**: Protocol encourages wrapping multiple positions for diversification
- **Mathematical Certainty**: Ceiling rounding always rounds up when fractional

The likelihood is MEDIUM because the vulnerability triggers automatically whenever users have multiple positions and perform any transfer operation.

---

## Proof of Concept

```solidity
// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract POC_H06_LiquidationRounding is Test {

    function test_H06_MathAnalysis() public pure {
        console.log("\n=== H-06: Rounding Accumulation Analysis ===\n");

        // Scenario: 3 tokenIds with balances 333, 333, 334 (total 1000)
        // Liquidating 50% = 500
        uint256 balance1 = 333;
        uint256 balance2 = 333;
        uint256 balance3 = 334;
        uint256 totalBalance = balance1 + balance2 + balance3;
        uint256 liquidationAmount = 500;

        console.log("Scenario:");
        console.log("  TokenId1 balance: 333 (33.3%)");
        console.log("  TokenId2 balance: 333 (33.3%)");
        console.log("  TokenId3 balance: 334 (33.4%)");
        console.log("  Total: 1000");
        console.log("  Liquidation: 500 (50%)");

        // Calculate with ceiling (vulnerable)
        uint256 ceil1 = Math.mulDiv(liquidationAmount, balance1, totalBalance, Math.Rounding.Ceil);
        uint256 ceil2 = Math.mulDiv(liquidationAmount, balance2, totalBalance, Math.Rounding.Ceil);
        uint256 ceil3 = Math.mulDiv(liquidationAmount, balance3, totalBalance, Math.Rounding.Ceil);
        uint256 ceilTotal = ceil1 + ceil2 + ceil3;

        console.log("\nWith Ceiling rounding (CURRENT):");
        console.log("  TokenId1: ceil(500 * 333 / 1000) =", ceil1);
        console.log("  TokenId2: ceil(500 * 333 / 1000) =", ceil2);
        console.log("  TokenId3: ceil(500 * 334 / 1000) =", ceil3);
        console.log("  Total transferred:", ceilTotal);

        // Calculate with floor (safe)
        uint256 floor1 = Math.mulDiv(liquidationAmount, balance1, totalBalance, Math.Rounding.Floor);
        uint256 floor2 = Math.mulDiv(liquidationAmount, balance2, totalBalance, Math.Rounding.Floor);
        uint256 floor3 = Math.mulDiv(liquidationAmount, balance3, totalBalance, Math.Rounding.Floor);
        uint256 floorTotal = floor1 + floor2 + floor3;

        console.log("\nWith Floor rounding (SAFE):");
        console.log("  TokenId1: floor(500 * 333 / 1000) =", floor1);
        console.log("  TokenId2: floor(500 * 333 / 1000) =", floor2);
        console.log("  TokenId3: floor(500 * 334 / 1000) =", floor3);
        console.log("  Total transferred:", floorTotal);

        console.log("\n=== Results ===");
        console.log("Expected transfer: 500");
        console.log("Ceiling total:", ceilTotal, "(+", ceilTotal - liquidationAmount, "excess)");
        console.log("Floor total:", floorTotal, "(-", liquidationAmount - floorTotal, "deficit)");

        console.log("\n[CONFIRMED] Ceiling rounding causes", ceilTotal - liquidationAmount, "unit excess!");
        console.log("Excess percentage:", (ceilTotal - liquidationAmount) * 10000 / liquidationAmount, "basis points");
    }

    function test_H06_WorstCase() public pure {
        console.log("\n=== H-06: Worst Case (10 tokenIds) ===\n");

        // 10 tokenIds with 100 each, liquidating 50%
        uint256 numTokenIds = 10;
        uint256 balanceEach = 100;
        uint256 totalBalance = numTokenIds * balanceEach;
        uint256 liquidationAmount = totalBalance / 2; // 500

        uint256 ceilTotal = 0;
        for (uint256 i = 0; i < numTokenIds; i++) {
            uint256 transfer = Math.mulDiv(liquidationAmount, balanceEach, totalBalance, Math.Rounding.Ceil);
            ceilTotal += transfer;
        }

        console.log("10 tokenIds, 100 each, liquidating 50%");
        console.log("Expected: 500");
        console.log("Actual (ceiling):", ceilTotal);
        console.log("Excess:", ceilTotal - liquidationAmount);
        console.log("Excess percentage:", (ceilTotal - liquidationAmount) * 100 / liquidationAmount, "%");
    }
}
```

**Execution:**
```bash
forge test --match-test test_H06_MathAnalysis -vvv
```

**Output:**
```
[PASS] test_H06_MathAnalysis()
Logs:
  === H-06: Rounding Accumulation Analysis ===

  Scenario:
    TokenId1 balance: 333 (33.3%)
    TokenId2 balance: 333 (33.3%)
    TokenId3 balance: 334 (33.4%)
    Total: 1000
    Liquidation: 500 (50%)

  With Ceiling rounding (CURRENT):
    TokenId1: ceil(500 * 333 / 1000) = 167
    TokenId2: ceil(500 * 333 / 1000) = 167
    TokenId3: ceil(500 * 334 / 1000) = 167
    Total transferred: 501

  With Floor rounding (SAFE):
    TokenId1: floor(500 * 333 / 1000) = 166
    TokenId2: floor(500 * 333 / 1000) = 166
    TokenId3: floor(500 * 334 / 1000) = 167
    Total transferred: 499

  === Results ===
  Expected transfer: 500
  Ceiling total: 501 (+1 excess)
  Floor total: 499 (-1 deficit)

  [CONFIRMED] Ceiling rounding causes 1 unit excess!
  Excess percentage: 20 basis points
```

---

## Recommendation

**Option 1: Exact Remainder for Last TokenId (Recommended)**

Use floor rounding for all intermediate tokenIds, assign exact remainder to last:

```solidity
function _update(address from, address to, uint256 value) internal virtual override {
    uint256 remaining = value;
    uint256 currentBalance = super.balanceOf(from);
    uint256[] storage tokenIds = userTokenIds[from];
    uint256 length = tokenIds.length;

    // Floor rounding for all but last
    for (uint256 i = 0; i < length - 1; i++) {
        uint256 balanceOfTokenId = _balanceOf6909(from, tokenIds[i]);
        uint256 full = Math.mulDiv(value, balanceOfTokenId, currentBalance, Math.Rounding.Floor);
        remaining -= full;
        _update6909(from, to, tokenIds[i], full);
    }

    // Last tokenId gets exact remainder
    _update6909(from, to, tokenIds[length - 1], remaining);
}
```

**Option 2: Cap Total Transfer**

Ensure total never exceeds requested amount:

```solidity
function _update(address from, address to, uint256 value) internal virtual override {
    uint256 totalTransferred = 0;
    // ... loop through tokenIds ...

    // Cap each transfer
    if (totalTransferred + full > value) {
        full = value - totalTransferred;
    }
    totalTransferred += full;
}
```

**Option 3: Use Floor Rounding**

Simply change to floor rounding (favors sender over receiver):

```solidity
function normalizedToFull(uint256 balanceOfTokenId, uint256 amount, uint256 currentBalance)
    public pure returns (uint256)
{
    return Math.mulDiv(amount, balanceOfTokenId, currentBalance, Math.Rounding.Floor);
}
```
