---
name: vault-erc4626
description: >
  Auto-loaded by defi-auditor agent during Phase 2 when analyzing ERC4626 vaults.
  Provides patterns for: share/asset conversion, inflation attack mitigations,
  rounding direction rules, donation attacks. Critical: first depositor attack,
  virtual shares offset, dead shares burning.
user-invocable: false
---

# ERC4626 Vault Patterns

This skill provides comprehensive knowledge for auditing ERC4626 tokenized vaults.

## ERC4626 Overview

ERC4626 standardizes tokenized vaults:
- Deposit assets → receive shares
- Shares represent proportional ownership
- Redeem shares → receive assets

```
shares = assets × totalSupply / totalAssets
assets = shares × totalAssets / totalSupply
```

---

## Why ERC4626 Vault Attacks Happen (Root Causes)

### Root Cause 1: Share Price Manipulation via Donation

Attacker donates assets directly to vault without minting shares, inflating `price = totalAssets / totalSupply`. Next depositor pays inflated price; attacker's shares gain value.

**Detection**: Verify `totalAssets()` uses internal accounting, not `balanceOf()`.

### Root Cause 2: First Depositor Advantage

When `totalSupply = 0`, first depositor deposits 1 wei (gets 1 share), then donates massive assets. Subsequent depositors suffer rounding losses: `2e18 * 1 / (1e18 + 1) = 1 share` (rounds down).

**Detection**: Check for virtual shares, dead shares, or minimum deposit mitigations.

### Root Cause 3: Rounding Direction Errors

Wrong rounding direction allows value extraction. Withdraw should round UP (burn more shares), not DOWN.

```solidity
// Vulnerable: withdraw(assets) returns assets * supply / totalAssets (rounds DOWN)
// Correct: withdraw(assets) returns (assets * supply + totalAssets - 1) / totalAssets (rounds UP)
```

**Detection**: Verify deposit↓, mint↑, withdraw↑, redeem↓ rounding directions.

### Root Cause 4: State Desynchronization with External Yield

`totalAssets()` depends on external protocol state (Aave, Lido). If external protocol pauses or is manipulated, vault accounting breaks.

**Detection**: Check if `totalAssets()` can be manipulated by external protocols.

---

## Inflation Attack (First Depositor Attack)

### The Attack

```
1. Vault is empty (totalSupply = 0, totalAssets = 0)
2. Attacker deposits 1 wei → gets 1 share
3. Attacker donates 1e18 tokens directly to vault
4. Now: totalSupply = 1, totalAssets = 1e18 + 1
5. Victim deposits 2e18 tokens
6. Victim gets: 2e18 × 1 / (1e18 + 1) = 1 share (rounds down!)
7. Attacker and victim each have 1 share
8. Attacker redeems: gets half of 3e18 + 1 = 1.5e18 tokens
9. Attacker profit: ~0.5e18 tokens stolen from victim
```

### Vulnerable Pattern

```solidity
// DANGEROUS: No inflation protection
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = totalSupply() == 0
        ? assets
        : assets * totalSupply() / totalAssets();

    _mint(msg.sender, shares);
    asset.transferFrom(msg.sender, address(this), assets);
}
```

### Mitigation 1: Virtual Shares/Assets

```solidity
// Add virtual offset to prevent manipulation
uint256 constant VIRTUAL_SHARES = 1e3;
uint256 constant VIRTUAL_ASSETS = 1;

function totalSupply() public view override returns (uint256) {
    return super.totalSupply() + VIRTUAL_SHARES;
}

function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this)) + VIRTUAL_ASSETS;
}
```

### Mitigation 2: Dead Shares (Burn on First Deposit)

```solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = _convertToShares(assets);

    if (totalSupply() == 0) {
        // Burn first 1000 shares to dead address
        uint256 deadShares = 1000;
        _mint(address(0xdead), deadShares);
        shares -= deadShares;
    }

    _mint(msg.sender, shares);
    asset.transferFrom(msg.sender, address(this), assets);
}
```

### Mitigation 3: Minimum Deposit

```solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    require(assets >= MIN_DEPOSIT, "Below minimum");
    // ...
}
```

---

## Rounding Direction

### The Rule

| Operation | Round | Reason |
|-----------|-------|--------|
| deposit | shares DOWN | User gets less shares |
| mint | assets UP | User pays more |
| withdraw | shares UP | User burns more |
| redeem | assets DOWN | User gets less |

**Always round in favor of the vault (against the user).**

### Implementation

```solidity
// Round DOWN (default)
function _convertToShares(uint256 assets) internal view returns (uint256) {
    uint256 supply = totalSupply();
    return supply == 0 ? assets : assets * supply / totalAssets();
}

// Round UP
function _convertToSharesRoundUp(uint256 assets) internal view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return assets;
    return (assets * supply + totalAssets() - 1) / totalAssets();
}
```

### Vulnerable Pattern

```solidity
// DANGEROUS: Wrong rounding direction
function withdraw(uint256 assets) public returns (uint256 shares) {
    // Should round UP, but rounds DOWN
    shares = assets * totalSupply() / totalAssets();
    // Attacker can withdraw dust repeatedly, extracting value
}
```

---

## Donation Attack

### The Attack

```
1. Attacker deposits normally, gets shares
2. Attacker donates assets directly to vault (not through deposit)
3. Share price increases
4. Attacker has fewer shares but same value
5. Other share calculations become incorrect
```

### Vulnerable Scenarios

```solidity
// If vault uses asset balance directly
function totalAssets() public view returns (uint256) {
    return asset.balanceOf(address(this)); // Manipulable!
}

// If reward distribution based on balance
function distribute() external {
    uint256 rewards = asset.balanceOf(address(this)) - lastBalance;
    // Donated amount included in rewards!
}
```

### Mitigations

```solidity
// Track assets internally
uint256 internal _totalAssets;

function deposit(uint256 assets) public {
    // ...
    _totalAssets += assets;
}

function totalAssets() public view returns (uint256) {
    return _totalAssets; // Not manipulable
}
```

---

## Share Calculation Edge Cases

### Zero Total Supply

```solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    uint256 supply = totalSupply();
    // Handle first deposit
    return supply == 0 ? assets : assets * supply / totalAssets();
}
```

### Zero Total Assets

```solidity
// Can happen after total withdrawal or loss event
function convertToAssets(uint256 shares) public view returns (uint256) {
    uint256 assets = totalAssets();
    // Avoid division by zero
    return assets == 0 ? shares : shares * assets / totalSupply();
}
```

### Very Small Amounts

```solidity
// 1 wei deposit might get 0 shares due to rounding
uint256 shares = 1 * totalSupply / totalAssets; // Could be 0!

// Mitigation: Minimum deposit requirement
require(shares > 0, "Deposit too small");
```

---

## maxDeposit / maxWithdraw

### Standard Implementation

```solidity
function maxDeposit(address) public view returns (uint256) {
    // Consider:
    // - Deposit caps
    // - Available capacity
    // - User-specific limits
    return type(uint256).max; // Or actual limit
}

function maxWithdraw(address owner) public view returns (uint256) {
    // Consider:
    // - Owner's balance
    // - Available liquidity
    // - Withdrawal limits
    return convertToAssets(balanceOf(owner));
}
```

### Vulnerabilities

```solidity
// DANGEROUS: maxDeposit doesn't account for cap
function maxDeposit(address) public view returns (uint256) {
    return type(uint256).max; // But there's actually a cap!
}

// User calls deposit with max, expecting it to work
// Transaction reverts unexpectedly
```

---

## Yield Source Integration

### External Yield Vaults

```solidity
contract YieldVault is ERC4626 {
    IYieldSource public yieldSource;

    function totalAssets() public view override returns (uint256) {
        // Include yield from external source
        return asset.balanceOf(address(this)) +
               yieldSource.balanceOf(address(this));
    }

    // Risk: External yield source could be manipulated
    // Risk: External protocol could pause/fail
}
```

---

## ERC-7540 Async Vaults

ERC-7540 extends ERC4626 with asynchronous deposit and redemption flows, essential for Real-World Assets (RWAs) with T+1/T+2 settlement cycles. The key innovation is the **Request Lifecycle**: Pending → Claimable → Claimed.

### Request/Claim Pattern

```solidity
// User initiates async redemption request
function requestRedeem(uint256 shares) external returns (uint256 requestId) {
    // Shares are locked, not burned yet
    // Request moves to "Pending" state
    // Off-chain processing occurs (e.g., asset settlement)
}

// Once off-chain processing completes, request becomes "Claimable"
function claimRedeem(uint256 requestId) external returns (uint256 assets) {
    // User claims their redeemed assets
    // Shares are burned, assets transferred
    // Request moves to "Claimed" state
}

// Similar pattern for deposits
function requestDeposit(uint256 assets) external returns (uint256 requestId) {
    // Assets are locked, not minted yet
}

function claimDeposit(uint256 requestId) external returns (uint256 shares) {
    // User claims their shares after off-chain processing
}
```

### Controller Address Vulnerabilities

The vault controller (often a multisig or governance contract) has critical permissions:

```solidity
// VULNERABLE: Controller can manipulate pending requests
address public controller;

function claimRedeem(uint256 requestId) external {
    require(msg.sender == controller || msg.sender == owner);
    // If controller is compromised, attacker can:
    // 1. Claim requests with wrong asset amounts
    // 2. Claim requests for wrong users
    // 3. Prevent legitimate claims
}

// VULNERABLE: No access control on controller update
function setController(address newController) external {
    controller = newController;  // Missing onlyOwner!
}
```

**Detection**: Check if controller address can be changed without governance. Verify controller permissions are minimal and time-locked.

### Pending Redemption Price Manipulation

Between request and claim, the share price can change. An attacker can exploit this:

```solidity
// Attack scenario:
// 1. User requests redemption of 100 shares (worth 100 ETH at current price)
// 2. Attacker manipulates vault yield or donates assets
// 3. Share price increases to 2 ETH per share
// 4. User claims redemption → gets 200 ETH instead of 100 ETH
// 5. OR: Share price crashes to 0.5 ETH per share
// 6. User claims redemption → gets 50 ETH instead of 100 ETH

// Vulnerable implementation:
function claimRedeem(uint256 requestId) external returns (uint256 assets) {
    uint256 shares = pendingRequests[requestId].shares;
    assets = convertToAssets(shares);  // Price at claim time, not request time!
    // Attacker can manipulate this conversion
}
```

**Detection**: Check if redemption amount is locked at request time or recalculated at claim time. Look for price manipulation vectors between request and claim.

### Search Queries for ERC-7540 Vulnerabilities

- "ERC-7540 controller address manipulation"
- "Async vault pending request price manipulation"
- "ERC-7540 requestRedeem claimRedeem race condition"
- "Async vault settlement delay exploitation"
- "ERC-7540 RWA vault access control"

---

## ERC4626 Audit Checklist

### Inflation Attack
- [ ] Virtual shares/assets implemented
- [ ] OR dead shares burned on first deposit
- [ ] OR minimum deposit enforced
- [ ] First depositor cannot profit from donation

### Rounding
- [ ] deposit: shares round DOWN
- [ ] mint: assets round UP
- [ ] withdraw: shares round UP
- [ ] redeem: assets round DOWN
- [ ] All conversions favor vault

### Edge Cases
- [ ] Zero totalSupply handled
- [ ] Zero totalAssets handled
- [ ] Very small deposits handled
- [ ] Very small withdrawals handled

### Limits
- [ ] maxDeposit returns accurate limit
- [ ] maxMint returns accurate limit
- [ ] maxWithdraw considers liquidity
- [ ] maxRedeem considers liquidity

### Integration
- [ ] totalAssets cannot be manipulated
- [ ] Donations don't break accounting
- [ ] External yield properly accounted

## Severity Classification

### Critical
- First depositor inflation attack
- Wrong rounding direction
- totalAssets manipulable

### High
- Donation breaks reward distribution
- maxDeposit/maxWithdraw incorrect
- Zero supply/assets crashes

### Medium
- Minimum deposit not enforced
- Edge case precision loss
- Missing slippage protection

---

## Rationalization Table

| Vulnerability | Root Cause | Detection Method | Severity | Mitigation |
|---|---|---|---|---|
| First Depositor Inflation | Root Cause 2 | Check for virtual shares, dead shares, or min deposit | Critical | Burn 1000 shares on first deposit or use virtual offset |
| Donation Attack | Root Cause 1 | Verify totalAssets uses internal accounting, not balance() | Critical | Track assets internally, don't rely on balanceOf() |
| Wrong Rounding Direction | Root Cause 3 | Audit all four operations: deposit (↓), mint (↑), withdraw (↑), redeem (↓) | Critical | Use (a * b + c - 1) / c for rounding UP |
| External Yield Desync | Root Cause 4 | Check if totalAssets depends on external protocol state | High | Cache external yields, implement pause mechanisms |
| maxDeposit/maxWithdraw Incorrect | Root Cause 2 | Verify limits account for caps and liquidity | High | Return actual limits, not type(uint256).max |
| Zero Supply Edge Case | Root Cause 2 | Test deposit when totalSupply == 0 | High | Handle first deposit specially with inflation protection |
| Rounding Precision Loss | Root Cause 3 | Check for dust amounts that round to 0 | Medium | Enforce minimum deposit or use higher precision |
| Controller Compromise (ERC-7540) | Root Cause 4 | Verify controller is multisig with timelock | High | Use governance for controller updates, implement delays |
