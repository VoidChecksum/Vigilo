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

---

## Additional Token Patterns (2025-2026)

### 9. ERC-2612 Permit Vulnerabilities

**Vulnerable Pattern:**
```solidity
// DANGEROUS: No deadline validation
function depositWithPermit(
    uint256 amount,
    uint8 v, bytes32 r, bytes32 s
) external {
    token.permit(msg.sender, address(this), amount, type(uint256).max, v, r, s);
    // @audit deadline = max allows signature to be used forever
    token.transferFrom(msg.sender, address(this), amount);
}
```

**Secure Pattern:**
```solidity
function depositWithPermit(
    uint256 amount,
    uint256 deadline,
    uint8 v, bytes32 r, bytes32 s
) external {
    require(deadline >= block.timestamp, "Expired");
    token.permit(msg.sender, address(this), amount, deadline, v, r, s);
    token.transferFrom(msg.sender, address(this), amount);
}
```

**Signature Replay Risks:**
- Same signature valid on multiple chains (missing chainId)
- Permit can be front-run if deadline is far future
- DoS by calling permit with invalid signature (some implementations)

**Search Queries:**
```
Grep("permit|Permit|PERMIT_TYPEHASH|nonces", glob="**/*.sol")
Grep("ecrecover|ECDSA|v.*r.*s", glob="**/*.sol")
```

---

### 10. Permit2 Vulnerabilities (Uniswap)

**Overview**: Permit2 is a universal approval system that introduces new attack vectors.

**Vulnerable Pattern:**
```solidity
// DANGEROUS: No expiration check on permit2
function swapWithPermit2(
    ISignatureTransfer.PermitTransferFrom calldata permit,
    ISignatureTransfer.SignatureTransferDetails calldata transferDetails,
    bytes calldata signature
) external {
    permit2.permitTransferFrom(permit, transferDetails, msg.sender, signature);
    // @audit What if permit.deadline is far in future?
}
```

**Permit2 Specific Risks:**
1. **Batch Permits**: Single signature approves multiple tokens
2. **Witness Data**: Additional data can be signed but misinterpreted
3. **Signature Malleability**: Different signatures for same approval
4. **Nonce Invalidation**: Can invalidate others' permits

**Search Queries:**
```
Grep("Permit2|permit2|ISignatureTransfer|IAllowanceTransfer", glob="**/*.sol")
Grep("permitTransferFrom|permitWitnessTransferFrom", glob="**/*.sol")
```

**Security Checklist:**
- [ ] Deadline always validated
- [ ] Nonce management understood
- [ ] Witness data properly validated
- [ ] Signature cannot be reused maliciously

---

### 11. ERC-4626 Token Integration Risks

When integrating ERC-4626 vaults as collateral or tokens:

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Trusting vault's reported value
function getCollateralValue(address user) external view returns (uint256) {
    uint256 shares = vault.balanceOf(user);
    return vault.convertToAssets(shares);  // @audit Can be manipulated via donation!
}
```

**Attack Vector:**
1. Attacker donates to vault, inflating `totalAssets`
2. `convertToAssets()` returns inflated value
3. Protocol accepts as collateral at wrong price
4. Attacker borrows against inflated collateral

**Secure Pattern:**
```solidity
// Use time-weighted or oracle-based pricing for ERC-4626 tokens
function getCollateralValue(address user) external view returns (uint256) {
    uint256 shares = vault.balanceOf(user);
    // Use external oracle for share price, NOT vault.convertToAssets()
    uint256 sharePrice = oracle.getPrice(address(vault));
    return shares * sharePrice / 1e18;
}
```

**Search Queries:**
```
Grep("ERC4626|convertToAssets|convertToShares|previewDeposit", glob="**/*.sol")
Grep("vault.*balanceOf|collateral.*vault", glob="**/*.sol")
```

---

### 12. ERC-1363 (transferAndCall) Reentrancy

**Vulnerable Pattern:**
```solidity
// DANGEROUS: ERC-1363 triggers callback on receive
function receiveApproval(
    address from,
    uint256 amount,
    address token,
    bytes calldata data
) external {
    // @audit This is called during transferAndCall/approveAndCall
    // State may not be updated yet!
}
```

**Search Queries:**
```
Grep("ERC1363|transferAndCall|approveAndCall|onApprovalReceived", glob="**/*.sol")
```

---

## Updated Token Compatibility Matrix (2025-2026)

| Token | Fee | Rebase | Blacklist | Callback | Permit | Notes |
|-------|-----|--------|-----------|----------|--------|-------|
| USDT | No* | No | Yes | No | No | Missing return |
| USDC | No | No | Yes | No | Yes | v2 has permit |
| DAI | No | No | No | No | Yes | Original permit |
| stETH | No | Yes | No | No | Yes | Rebases daily |
| wstETH | No | No | No | No | Yes | Wrapped stETH |
| WBTC | No | No | No | No | No | 8 decimals |
| PAXG | Yes | No | No | No | No | 0.02% fee |
| ERC777 | No | No | No | Yes | No | Deprecated |
| LRTs | Varies | No | No | No | Yes | Check implementation |

*USDT has fee mechanism but set to 0

---

## Search Query Reference

```
# Find permit patterns
Grep("permit|Permit|DOMAIN_SEPARATOR|PERMIT_TYPEHASH", glob="**/*.sol")
Grep("permit2|Permit2|ISignatureTransfer", glob="**/*.sol")

# Find callback tokens
Grep("ERC777|ERC1363|tokensReceived|onTransferReceived", glob="**/*.sol")
Grep("safeTransfer|safeMint|onERC721Received", glob="**/*.sol")

# Find vault integrations
Grep("ERC4626|convertToAssets|convertToShares", glob="**/*.sol")

# Find decimal handling
Grep("decimals\\(\\)|10\\*\\*.*decimals", glob="**/*.sol")
```
