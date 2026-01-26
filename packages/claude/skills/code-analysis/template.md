# Code Reconnaissance Findings

**Generated**: {YYYY-MM-DD HH:MM}
**Project**: {project name}
**Language**: {Solidity/Rust/Cairo/Move}
**Framework**: {Foundry/Hardhat/Anchor/Scarb}
**Protocol Type**: {AMM/Lending/Vault/Governance/Staking/Bridge}

---

## Project Overview

{2-3 sentences: What does this protocol do based on the code?}

---

## Contracts

| Contract | File | Purpose | LOC |
|----------|------|---------|-----|
| {Name} | {path} | {one-line purpose} | {N} |

### Inheritance

```
{BaseContract}
├── {ChildA}
└── {ChildB}
```

### Dependencies

| Import | Type |
|--------|------|
| @openzeppelin/... | Standard |
| @chainlink/... | Oracle |

---

## Main Flows

### Entry (How value comes in)

```
User → {function}() → Contract
       └── {what happens: tokens transferred, shares minted, etc.}
```

| Function | Contract | What Happens |
|----------|----------|--------------|
| deposit() | Vault | Assets in, shares minted |
| stake() | Staking | Tokens locked |

### Exit (How value goes out)

```
Contract → {function}() → User
       └── {what happens: shares burned, tokens returned, etc.}
```

| Function | Contract | What Happens |
|----------|----------|--------------|
| withdraw() | Vault | Shares burned, assets out |
| claim() | Staking | Rewards distributed |

### Admin/Privileged

| Function | Contract | What It Can Do |
|----------|----------|----------------|
| emergencyWithdraw() | Vault | Bypass normal checks |
| setFee() | Pool | Change fee rate |

---

## Asset Storage

| Contract | Asset Type | Storage Pattern | Location |
|----------|------------|-----------------|----------|
| {Name} | ETH | `address(this).balance` | {file:line} |
| {Name} | ERC20 | `balanceOf(address(this))` | {file:line} |
| {Name} | Shares | `mapping(address => uint256)` | {file:line} |

---

## Protocol Classification

| Indicator | Found | Evidence |
|-----------|-------|----------|
| AMM patterns | {Yes/No} | {swap, reserves, k} |
| Lending patterns | {Yes/No} | {borrow, collateral} |
| Vault patterns | {Yes/No} | {shares, totalAssets} |

**Determination**: {Protocol Type}

---

## Notable Patterns

Locations for Phase 2 to investigate:

| Location | Pattern | Category |
|----------|---------|----------|
| {file:line} | `.call{value:}` | External call |
| {file:line} | `delegatecall` | Delegation |
| {file:line} | oracle call | Price data |
| {file:line} | `onlyOwner` | Admin function |

---

## Summary

| Metric | Count |
|--------|-------|
| Contracts | {N} |
| Entry Functions | {N} |
| Exit Functions | {N} |
| Admin Functions | {N} |
| Notable Patterns | {N} |

---

## Notes

{Any observations about code structure, complexity, unusual patterns}
