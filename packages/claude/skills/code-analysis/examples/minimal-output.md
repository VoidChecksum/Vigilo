# Code Reconnaissance Findings

**Project**: SimpleVault
**Protocol Type**: Vault

## Overview
ERC4626-style vault that accepts ETH deposits and issues shares.

## Contracts
| Contract | Purpose |
|----------|---------|
| Vault | Main deposit/withdraw logic |
| VaultToken | Share token (ERC20) |

## Main Flows
- **Entry**: `deposit()` → ETH in, shares minted
- **Exit**: `withdraw()` → shares burned, ETH out
- **Admin**: `setFee()` → owner can change fee

## Notable Patterns
| Location | Pattern |
|----------|---------|
| Vault.sol:45 | `.call{value:}` |
| Vault.sol:80 | `onlyOwner` |
