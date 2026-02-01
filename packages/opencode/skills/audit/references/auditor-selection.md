# Auditor Selection Guide

Select 3 auditors based on protocol type identified in Phase 1 recon.

---

## Protocol Type Detection

From Phase 1 code analysis, identify protocol type by key signatures:

| Key Indicators | Protocol Type |
|----------------|---------------|
| `swap`, `getReserves`, `addLiquidity`, `removeLiquidity` | AMM/DEX |
| `borrow`, `repay`, `liquidate`, `collateral`, `interestRate` | Lending |
| `totalAssets`, `convertToShares`, `deposit`, `withdraw` (ERC4626) | Vault |
| `propose`, `vote`, `execute`, `quorum`, `timelock` | Governance |
| `relayMessage`, `validateSignature`, `nonce`, `bridgeMessage` | Bridge |
| `stake`, `rewardPerToken`, `epoch`, `claim` | Staking |
| `mint`, `tokenURI`, `royaltyInfo`, `safeMint` | NFT/Gaming |

### Interface Detection

```solidity
// ERC4626 Vault
interface IERC4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
}

// Compound-style Lending
interface ICToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
}

// Uniswap-style AMM
interface IUniswapV2Pair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function getReserves() external view returns (uint112, uint112, uint32);
}
```

---

## Protocol Type → Auditors

| Protocol Type | Primary | Secondary | Tertiary | Rationale |
|--------------|---------|-----------|----------|-----------|
| **AMM/DEX** | flashloan-auditor | oracle-auditor | reentrancy-auditor | Price manipulation, sandwich |
| **Lending** | oracle-auditor | logic-auditor | flashloan-auditor | Collateral valuation, liquidation |
| **Vault/ERC4626** | logic-auditor | reentrancy-auditor | defi-auditor | Share calculation, first depositor |
| **Governance** | flashloan-auditor | access-control-auditor | logic-auditor | Flash loan voting, timelock bypass |
| **Bridge** | cross-chain-auditor | access-control-auditor | reentrancy-auditor | Message forgery, replay attacks |
| **Staking** | logic-auditor | reentrancy-auditor | defi-auditor | Reward calculation, timing |
| **NFT/Gaming** | access-control-auditor | token-auditor | logic-auditor | Mint permissions, randomness |

---

## Available Auditors

| Agent | Specialization | Key Patterns |
|-------|---------------|--------------|
| `reentrancy-auditor` | CEI violations, callbacks | External calls, state windows |
| `access-control-auditor` | Privilege escalation | Missing auth, modifier logic |
| `logic-auditor` | Calculation errors | Precision loss, edge cases |
| `oracle-auditor` | Price feed manipulation | Stale data, spot price abuse |
| `flashloan-auditor` | Atomic manipulation | Governance, oracle attacks |
| `defi-auditor` | DeFi composability | Lending, vault, staking |
| `token-auditor` | Token standard edge cases | ERC20/721/777/1155 |
| `cross-chain-auditor` | Bridge verification | Replay, message validation |

---

## Protocol-Specific Audit Focus

### AMM/DEX
| Function | Risk Areas |
|----------|------------|
| `swap()` | Slippage, reentrancy, price calculation |
| `addLiquidity()` | First depositor attack, share calculation |
| `removeLiquidity()` | Reentrancy, minimum amounts |
| `flashLoan()` | Callback security, fee calculation |

### Lending
| Function | Risk Areas |
|----------|------------|
| `deposit()` | Share calculation, first depositor |
| `borrow()` | Collateral valuation, health check |
| `repay()` | Interest calculation, rounding |
| `liquidate()` | Bad debt handling, incentives |

### Vault/ERC4626
| Function | Risk Areas |
|----------|------------|
| `deposit()` | Share inflation, first depositor |
| `withdraw()` | Reentrancy, share calculation |
| `harvest()` | Reward manipulation, MEV |
| `compound()` | Slippage, flash loan |

### Governance
| Function | Risk Areas |
|----------|------------|
| `propose()` | Threshold bypass, malicious actions |
| `vote()` | Flash loan voting, double voting |
| `execute()` | Timelock bypass, reentrancy |

### Bridge
| Function | Risk Areas |
|----------|------------|
| `deposit()` | Token accounting, event emission |
| `withdraw()` | Signature validation, replay |
| `processMessage()` | Message verification, execution |

---

## Multiple Protocol Types

If protocol combines multiple types (e.g., Lending + Vault):
1. Select primary type based on TVL concentration
2. Add auditors from secondary type as 3rd choice
3. Maximum 3 auditors per run (prevent context overload)

---

## Auditor Prompt Template

```
Analyze contracts for {vulnerability_focus}.

Read recon from: .vigilo/recon/
Write findings to: .vigilo/findings/{severity}/{auditor-name}/

Generate ATTACK SCENARIOS only. NO PoC code.
```
