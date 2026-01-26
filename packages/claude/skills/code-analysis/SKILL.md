---
name: code-analysis
description: >
  Auto-loaded by code-analyzer agent during Audit Phase 1 (Reconnaissance).
  Provides methodology for: contract structure mapping, execution flow tracing,
  protocol type classification, and entry point identification.
  Output: .vigilo/recon/code-findings.md
user-invocable: false
---

# Code Reconnaissance Methodology

## Purpose

Rapidly understand **what the code does** through structural analysis and flow tracing.
This is reconnaissance, not vulnerability hunting.

---

## 1. File Discovery

### By Language

| Language | Find Files | Framework Markers |
|----------|------------|-------------------|
| Solidity | `Glob("**/*.sol")` | `foundry.toml`, `hardhat.config.*` |
| Rust | `Glob("**/programs/**/*.rs")` | `Anchor.toml`, `Cargo.toml` |
| Cairo | `Glob("**/*.cairo")` | `Scarb.toml` |
| Move | `Glob("**/*.move")` | `Move.toml` |

### Skip These
- `test/`, `tests/`, `*.t.sol`, `*.test.sol`
- `mock/`, `mocks/`, `*Mock.sol`
- `node_modules/`, `lib/` (dependencies)
- Generated/compiled files

---

## 2. Contract Structure Analysis

### For Each Contract, Extract:

```
Contract: {Name}
File: {path}
Purpose: {one line description}
Inherits: {parent contracts}
Key State: {important state variables}
Entry Points: {external/public functions}
```

### Inheritance Mapping

```
BaseContract
├── ChildA
│   └── GrandchildA1
└── ChildB
```

### External Dependencies

| Import | Type | Notes |
|--------|------|-------|
| @openzeppelin/... | Standard lib | Usually safe |
| @chainlink/... | Oracle | Price dependency |
| @uniswap/... | DEX integration | External call |

---

## 3. Flow Tracing

### The Core Question
**"How does value enter, move through, and exit this protocol?"**

### Entry Flows (How users put value in)

| Pattern | Function Names | What Happens |
|---------|---------------|--------------|
| Deposit | `deposit`, `supply`, `provide` | Assets in, receipts out |
| Stake | `stake`, `lock`, `bond` | Assets locked, tracking updated |
| Swap In | `swap`, `exchange` | Asset A in, Asset B out |
| Mint | `mint`, `create` | Payment in, tokens created |

### Internal Flows (How value transforms)

| Pattern | What to Look For |
|---------|------------------|
| Calculations | Fee deductions, interest accrual, share pricing |
| State Changes | Balance updates, position tracking |
| Internal Calls | Function-to-function flow within contract |
| External Calls | Interactions with other contracts |

### Exit Flows (How users get value out)

| Pattern | Function Names | What Happens |
|---------|---------------|--------------|
| Withdraw | `withdraw`, `remove`, `redeem` | Receipts burned, assets out |
| Unstake | `unstake`, `unlock`, `unbond` | Assets released |
| Claim | `claim`, `harvest`, `collect` | Rewards distributed |

### Privileged Flows (Admin operations)

| Pattern | Risk Level | What to Note |
|---------|------------|--------------|
| `emergencyWithdraw` | High | Can bypass normal checks |
| `sweep`, `rescue` | High | Can move arbitrary tokens |
| `pause`, `unpause` | Medium | Can halt operations |
| `setFee`, `setRate` | Medium | Can change economics |

---

## 4. Protocol Type Classification

### Identify by Code Patterns

| Protocol Type | Key Indicators | Main Flows |
|---------------|----------------|------------|
| **AMM/DEX** | `reserve0`, `reserve1`, `k`, `swap()`, `addLiquidity()` | swap, add/remove liquidity |
| **Lending** | `borrow()`, `collateral`, `liquidate()`, `interestRate` | supply, borrow, repay, liquidate |
| **Vault** | `totalAssets()`, `totalSupply()`, `shares`, ERC4626 | deposit, withdraw, yield |
| **Governance** | `propose()`, `vote()`, `execute()`, `quorum` | propose, vote, execute |
| **Staking** | `stake()`, `rewards`, `epoch`, `rewardPerToken` | stake, claim rewards |
| **Bridge** | `lock()`, `mint()`, `relayMessage()`, `nonce` | lock on L1, mint on L2 |

---

## 5. Asset Storage Patterns

### ETH Storage

```solidity
// Direct balance
address(this).balance

// Wrapped
WETH.balanceOf(address(this))
```

### Token Storage

```solidity
// External balance check
IERC20(token).balanceOf(address(this))

// Internal accounting
mapping(address => uint256) balances;
uint256 totalDeposited;
```

### Share/Receipt Tokens

```solidity
// Protocol issues these
mapping(address => uint256) shares;
uint256 totalSupply;
function balanceOf(address) external view returns (uint256);
```

---

## 6. Notable Patterns to Mark

Mark location only. No analysis needed - Phase 2 handles that.

| Pattern | Why Notable |
|---------|-------------|
| `.call{value:}` | External call with ETH |
| `delegatecall` | Code execution delegation |
| External contract calls | Trust boundary crossing |
| `onlyOwner`, `onlyAdmin` | Privileged operations |
| Oracle integration | External data dependency |
| Complex math | Potential calculation issues |
| Assembly blocks | Low-level operations |

---

## 7. Search Queries

### Find Entry Points

```
Grep("function.*external|function.*public", glob="**/*.sol")
```

### Find Asset Movements

```
Grep("transfer\\(|transferFrom\\(|safeTransfer", glob="**/*.sol")
```

### Find Privileged Functions

```
Grep("onlyOwner|onlyAdmin|onlyRole|require.*msg\\.sender", glob="**/*.sol")
```

### Find External Calls

```
Grep("\\.call\\{|\\.delegatecall\\(|address\\(.*\\)\\..*\\(", glob="**/*.sol")
```

---

## Output

Write findings to `.vigilo/recon/code-findings.md` following the format in
[template.md](template.md).

---

## Additional Resources

- [template.md](template.md) - Output template for code reconnaissance findings
- [examples/minimal-output.md](examples/minimal-output.md) - Minimal output example for small projects
