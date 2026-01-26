---
name: token
description: >
  Auto-loaded by token-auditor agent during Phase 2.
  Provides detection patterns for: fee-on-transfer, rebasing tokens, ERC777 hooks,
  ERC721/1155 callbacks, missing return values, blacklist/pausable, low decimals.
  Core artifact: Token Compatibility Matrix.
user-invocable: false
---

# Token Vulnerability Patterns

This skill provides comprehensive knowledge for identifying token-related vulnerabilities in smart contracts.

## Overview

Not all tokens follow the "happy path" of standard implementations. Protocols must handle edge cases from fee tokens, rebasing tokens, callback tokens, and malicious tokens.

## Token Weirdness Categories

### 1. Fee-On-Transfer Tokens

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Assumes transfer amount equals received amount
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    balances[msg.sender] += amount; // May be more than received!
}
```

**Secure Pattern:**
```solidity
function deposit(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;
    balances[msg.sender] += received;
}
```

**Common Fee Tokens:**
- PAXG (0.02% fee)
- STA (1% fee)
- USDT (potential fee, currently 0)

**Detection:**
```
Grep("transferFrom.*\\+=|transfer.*\\+=", glob="**/*.sol")
```

---

### 2. Rebasing Tokens

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Caches balance that will change
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakedAmount[msg.sender] = amount; // Becomes stale!
}
```

**Secure Pattern:**
```solidity
// Use shares instead of amounts
function stake(uint256 amount) external {
    uint256 totalBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - totalBefore;

    uint256 shares = totalShares == 0
        ? received
        : received * totalShares / totalBefore;
    userShares[msg.sender] += shares;
    totalShares += shares;
}
```

**Common Rebasing Tokens:**
- stETH (positive rebase daily)
- AMPL (elastic supply)
- OHM (rebasing)
- aTokens (AAVE interest)

**Detection:**
- Look for balance caching
- Check if protocol claims to support stETH, AMPL

---

### 3. ERC777 Callback Reentrancy

**Vulnerable Pattern:**
```solidity
// DANGEROUS: State updated after transfer
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    token.transfer(msg.sender, amount); // Triggers tokensReceived!
    balances[msg.sender] -= amount; // Too late!
}
```

**ERC777 Hooks:**
- `tokensToSend()` - Called BEFORE transfer on sender
- `tokensReceived()` - Called AFTER transfer on recipient

**Detection:**
```
Grep("IERC777|tokensReceived|tokensToSend", glob="**/*.sol")
```

---

### 4. ERC721/1155 Callback Reentrancy

**Vulnerable Pattern:**
```solidity
// DANGEROUS: safeTransfer triggers callback
function claimNFT(uint256 tokenId) external {
    nft.safeTransferFrom(address(this), msg.sender, tokenId);
    // onERC721Received callback runs HERE
    claimed[tokenId] = true; // State update after callback!
}
```

**Callback Functions:**
- `onERC721Received()` - ERC721 safeTransfer
- `onERC1155Received()` - ERC1155 safeTransfer
- `onERC1155BatchReceived()` - ERC1155 safeBatchTransfer

**Detection:**
```
Grep("safeTransferFrom|safeMint|safeTransfer", glob="**/*.sol")
```

---

### 5. Missing Return Value (USDT)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: USDT doesn't return bool
function deposit(uint256 amount) external {
    bool success = token.transfer(address(this), amount);
    require(success, "Transfer failed"); // USDT reverts here!
}
```

**Secure Pattern:**
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

function deposit(uint256 amount) external {
    token.safeTransferFrom(msg.sender, address(this), amount);
}
```

**Tokens Without Return:**
- USDT
- BNB
- Some older tokens

**Detection:**
```
Grep("transfer\\(|transferFrom\\(", glob="**/*.sol")
```
Check if using SafeERC20 wrapper.

---

### 6. Blacklist/Pausable Tokens

**Risk:** Transfers can be blocked, causing DoS.

**Affected Tokens:**
- USDC (blacklist)
- USDT (blacklist + pausable)
- DAI (pausable)

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Can be blocked if recipient blacklisted
function withdraw() external {
    token.transfer(msg.sender, balances[msg.sender]); // May revert!
}
```

**Mitigation:**
- Use pull-over-push pattern
- Allow alternate withdrawal addresses
- Handle transfer failures gracefully

---

### 7. Low Decimal Tokens

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Precision loss with low decimals
// WBTC has 8 decimals, not 18
uint256 priceInWei = wbtcAmount * ethPrice / 1e18; // Wrong scale!
```

**Common Low Decimal Tokens:**
- WBTC (8 decimals)
- USDC (6 decimals)
- USDT (6 decimals)

**Detection:**
```
Grep("decimals|1e18|1e6|1e8", glob="**/*.sol")
```

---

### 8. Approval Race Condition

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Front-runnable approve
token.approve(spender, newAmount);
```

**Attack:**
1. User has 100 approved
2. User calls approve(50) to reduce
3. Attacker front-runs: transferFrom(100)
4. Approve(50) executes
5. Attacker calls: transferFrom(50)
6. Total stolen: 150

**Secure Pattern:**
```solidity
// Reset to 0 first, or use increaseAllowance
token.approve(spender, 0);
token.approve(spender, newAmount);

// Or use OZ increaseAllowance/decreaseAllowance
token.increaseAllowance(spender, amount);
```

---

## Token Compatibility Matrix

| Token | Fee | Rebase | Blacklist | Callback | Return |
|-------|-----|--------|-----------|----------|--------|
| USDT | No* | No | Yes | No | None |
| USDC | No | No | Yes | No | Yes |
| DAI | No | No | No | No | Yes |
| stETH | No | Yes | No | No | Yes |
| WBTC | No | No | No | No | Yes |
| PAXG | Yes | No | No | No | Yes |
| ERC777 | No | No | No | Yes | Yes |

*USDT has fee mechanism but set to 0

---

## Token Audit Checklist

- [ ] Balance changes measured, not assumed (fee tokens)
- [ ] Shares used instead of amounts (rebasing tokens)
- [ ] CEI pattern followed for callbacks (ERC721/777/1155)
- [ ] SafeERC20 used for transfers
- [ ] Blacklist handling considered
- [ ] Decimal precision handled correctly
- [ ] Approval race condition mitigated
- [ ] Zero-amount transfers handled

## Severity Classification

### Critical
- ERC777 reentrancy
- ERC721/1155 callback reentrancy
- Fee token accounting mismatch

### High
- Rebasing token balance caching
- Missing return value handling
- Decimal precision errors

### Medium
- Blacklist DoS potential
- Approval race condition
- No zero-amount validation
