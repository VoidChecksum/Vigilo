import type { BuiltinSkill } from "./types"

export const codeAnalysisSkill: BuiltinSkill = {
  name: "code-analysis",
  description: `Auto-loaded by explorator agent during Audit Phase 1 (Reconnaissance).
Provides methodology for: contract structure mapping, execution flow tracing,
protocol type classification, and entry point identification.
Output: .vigilo/recon/code-findings.md`,
  template: `# Code Reconnaissance Methodology

## Purpose

Rapidly understand **what the code does** through structural analysis and flow tracing.
This is reconnaissance, not vulnerability hunting.

---

## 1. File Discovery

### By Language

| Language | Find Files | Framework Markers |
|----------|------------|-------------------|
| Solidity | \`Glob("**/*.sol")\` | \`foundry.toml\`, \`hardhat.config.*\` |
| Rust | \`Glob("**/programs/**/*.rs")\` | \`Anchor.toml\`, \`Cargo.toml\` |
| Cairo | \`Glob("**/*.cairo")\` | \`Scarb.toml\` |
| Move | \`Glob("**/*.move")\` | \`Move.toml\` |

### Skip These
- \`test/\`, \`tests/\`, \`*.t.sol\`, \`*.test.sol\`
- \`mock/\`, \`mocks/\`, \`*Mock.sol\`
- \`node_modules/\`, \`lib/\` (dependencies)
- Generated/compiled files

---

## 2. Contract Structure Analysis

### For Each Contract, Extract:

\`\`\`
Contract: {Name}
File: {path}
Purpose: {one line description}
Inherits: {parent contracts}
Key State: {important state variables}
Entry Points: {external/public functions}
\`\`\`

### Inheritance Mapping

\`\`\`
BaseContract
├── ChildA
│   └── GrandchildA1
└── ChildB
\`\`\`

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
| Deposit | \`deposit\`, \`supply\`, \`provide\` | Assets in, receipts out |
| Stake | \`stake\`, \`lock\`, \`bond\` | Assets locked, tracking updated |
| Swap In | \`swap\`, \`exchange\` | Asset A in, Asset B out |
| Mint | \`mint\`, \`create\` | Payment in, tokens created |

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
| Withdraw | \`withdraw\`, \`remove\`, \`redeem\` | Receipts burned, assets out |
| Unstake | \`unstake\`, \`unlock\`, \`unbond\` | Assets released |
| Claim | \`claim\`, \`harvest\`, \`collect\` | Rewards distributed |

### Privileged Flows (Admin operations)

| Pattern | Risk Level | What to Note |
|---------|------------|--------------|
| \`emergencyWithdraw\` | High | Can bypass normal checks |
| \`sweep\`, \`rescue\` | High | Can move arbitrary tokens |
| \`pause\`, \`unpause\` | Medium | Can halt operations |
| \`setFee\`, \`setRate\` | Medium | Can change economics |

---

## 4. Protocol Type Classification

### Identify by Code Patterns

| Protocol Type | Key Indicators | Main Flows |
|---------------|----------------|------------|
| **AMM/DEX** | \`reserve0\`, \`reserve1\`, \`k\`, \`swap()\`, \`addLiquidity()\` | swap, add/remove liquidity |
| **Lending** | \`borrow()\`, \`collateral\`, \`liquidate()\`, \`interestRate\` | supply, borrow, repay, liquidate |
| **Vault** | \`totalAssets()\`, \`totalSupply()\`, \`shares\`, ERC4626 | deposit, withdraw, yield |
| **Governance** | \`propose()\`, \`vote()\`, \`execute()\`, \`quorum\` | propose, vote, execute |
| **Staking** | \`stake()\`, \`rewards\`, \`epoch\`, \`rewardPerToken\` | stake, claim rewards |
| **Bridge** | \`lock()\`, \`mint()\`, \`relayMessage()\`, \`nonce\` | lock on L1, mint on L2 |

---

## 5. Asset Storage Patterns

### ETH Storage

\`\`\`solidity
// Direct balance
address(this).balance

// Wrapped
WETH.balanceOf(address(this))
\`\`\`

### Token Storage

\`\`\`solidity
// External balance check
IERC20(token).balanceOf(address(this))

// Internal accounting
mapping(address => uint256) balances;
uint256 totalDeposited;
\`\`\`

### Share/Receipt Tokens

\`\`\`solidity
// Protocol issues these
mapping(address => uint256) shares;
uint256 totalSupply;
function balanceOf(address) external view returns (uint256);
\`\`\`

---

## 6. Notable Patterns to Mark

Mark location only. No analysis needed - Phase 2 handles that.

| Pattern | Why Notable |
|---------|-------------|
| \`.call{value:}\` | External call with ETH |
| \`delegatecall\` | Code execution delegation |
| External contract calls | Trust boundary crossing |
| \`onlyOwner\`, \`onlyAdmin\` | Privileged operations |
| Oracle integration | External data dependency |
| Complex math | Potential calculation issues |
| Assembly blocks | Low-level operations |

---

## 7. Search Queries

### Find Entry Points

\`\`\`
Grep("function.*external|function.*public", glob="**/*.sol")
\`\`\`

### Find Asset Movements

\`\`\`
Grep("transfer\\\\(|transferFrom\\\\(|safeTransfer", glob="**/*.sol")
\`\`\`

### Find Privileged Functions

\`\`\`
Grep("onlyOwner|onlyAdmin|onlyRole|require.*msg\\\\.sender", glob="**/*.sol")
\`\`\`

### Find External Calls

\`\`\`
Grep("\\\\.call\\\\{|\\\\.delegatecall\\\\(|address\\\\(.*\\\\)\\\\..*\\\\(", glob="**/*.sol")
\`\`\`

---

## Output

Write findings to \`.vigilo/recon/code-findings.md\`.
`,
}

export const docsAnalysisSkill: BuiltinSkill = {
  name: "docs-analysis",
  description: `Auto-loaded by speculator agent during Audit Phase 1 (Reconnaissance).
Provides methodology for: documentation analysis, invariant extraction,
trust assumption mapping, and protocol type classification from docs.
Output: .vigilo/recon/docs-findings.md`,
  template: `# Documentation Reconnaissance Methodology

## Purpose

Rapidly understand **what the protocol should do** through documentation analysis.
This is reconnaissance, not code analysis.

---

## 1. Documentation Discovery

### Search Patterns

\`\`\`
Glob("**/README*")
Glob("**/*.md")
Glob("**/docs/**/*")
Glob("**/SECURITY*")
Glob("**/*.pdf")
\`\`\`

### Priority Order

| Priority | File | What to Extract |
|----------|------|-----------------|
| 1 | Root README | Project overview, quick start |
| 2 | docs/README.md | Documentation entry point |
| 3 | SECURITY.md | Security considerations, contacts |
| 4 | Whitepaper/spec | Formal specification |
| 5 | Audit reports | Known issues, past findings |

### Skip These
- Code files (\`.sol\`, \`.rs\`, etc.)
- Test documentation
- CI/CD configuration

---

## 2. The 4 Essential Questions

### Question 1: Where Is the Money?

| Asset Type | What to Look For |
|------------|------------------|
| Native tokens | ETH, MATIC, AVAX holdings |
| ERC20 tokens | USDC, USDT, DAI, protocol tokens |
| LP tokens | Uniswap, Curve, Balancer positions |
| NFTs | ERC721, ERC1155 assets |
| Shares/receipts | Vault shares, staked positions |

**Extract**: Which contracts hold assets, TVL mentions, treasury.

### Question 2: Who Can Move the Money?

**User Paths**:
| Action | Function Names |
|--------|---------------|
| Deposit | \`deposit()\`, \`stake()\`, \`supply()\`, \`mint()\` |
| Withdraw | \`withdraw()\`, \`unstake()\`, \`redeem()\`, \`burn()\` |

**Privileged Paths**:
| Action | Function Names | Risk Level |
|--------|---------------|------------|
| Emergency | \`emergencyWithdraw()\`, \`pause()\` | High |
| Recovery | \`sweep()\`, \`rescue()\`, \`skim()\` | High |
| Config | \`setFee()\`, \`setOracle()\`, \`upgradeTo()\` | Medium |

**Extract**: Function names, who can call, conditions.

### Question 3: What Invariants Must Hold?

**Explicit Invariants** - Keywords:
- "must", "always", "never", "guaranteed", "ensures"
- Mathematical relationships: \`x + y = z\`, \`a <= b * c\`
- NatSpec: \`@invariant\`, \`@notice\`

**Implicit Invariants** - By Protocol Type:

| Protocol Type | Common Invariant |
|---------------|------------------|
| Vault | \`totalAssets >= totalShares * minPrice\` |
| Lending | \`userDebt <= userCollateral * LTV\` |
| AMM | \`reserveX * reserveY >= k\` |
| Staking | \`sum(userStakes) == totalStaked\` |
| Bridge | \`mintedOnL2 == lockedOnL1\` |

Mark inferred invariants with \`[INFERRED]\`.

### Question 4: What Trust Assumptions Exist?

| Trusted Party | What They Control | Questions to Answer |
|--------------|-------------------|---------------------|
| Owner | Contract upgrades | Timelock? Multisig? |
| Admin | Parameter changes | Bounds? Frequency? |
| Oracle | Price feeds | Freshness? Backup? |
| Keeper | Liquidations | Incentives? Constraints? |

**Extract**: Who is trusted, for what, with what safeguards.

---

## 3. Protocol Type Classification

| Pattern in Docs | Protocol Type | Priority Vectors |
|-----------------|---------------|------------------|
| swap, liquidity, reserves | AMM/DEX | Price manipulation, sandwich |
| borrow, collateral, liquidate | Lending | Oracle manipulation, bad debt |
| deposit, shares, yield | Vault | Share inflation, first depositor |
| vote, propose, execute | Governance | Flash loan voting, timelock |
| lock, mint, bridge | Bridge | Double spend, replay |
| stake, reward, epoch | Staking | Reward calculation, timing |

---

## 4. Extraction Process

### Step 1: High-Level Understanding

Read overview documents to understand:
- Protocol purpose and value proposition
- Target users and use cases
- Integration with other protocols
- Economic model

### Step 2: Mechanism Analysis

For each mechanism described:
1. Identify inputs and outputs
2. Note preconditions and postconditions
3. Extract mathematical relationships
4. Identify external dependencies

### Step 3: Security Information

Look for:
- Security considerations sections
- Known limitations and risks
- Threat model descriptions
- Emergency procedures

### Step 4: Gap Identification

Note what's MISSING:
- Undefined edge cases
- Unclear trust assumptions
- Missing invariants
- Ambiguous specifications

---

## 5. Quality Assessment

| Rating | Criteria |
|--------|----------|
| Excellent | Complete invariants, clear trust model, all mechanisms documented |
| Good | Most information present, some inference needed |
| Adequate | Basic coverage, significant gaps |
| Poor | Minimal documentation, heavy inference required |
| Minimal | Almost no documentation |

---

## 6. Edge Cases

### Minimal Documentation
1. Note quality as "Poor" or "Minimal"
2. Flag ALL missing critical information
3. Infer what possible, mark as \`[INFERRED]\`
4. Recommend documentation improvements
5. Note increased audit risk

### Conflicting Information
1. Note the conflict explicitly
2. List all versions found
3. Flag for clarification
4. Do not assume which is correct

### Non-English Documentation
1. Note the language limitation
2. Extract what is possible
3. Flag for native speaker review

---

## Output

Write findings to \`.vigilo/recon/docs-findings.md\`.
`,
}

export const lendingSkill: BuiltinSkill = {
  name: "lending",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing lending protocols.
Provides patterns for: liquidation logic, interest rate models, collateral management,
health factor calculations, bad debt handling. Core vulnerabilities: self-liquidation,
precision loss, oracle manipulation, collateral factor attacks.`,
  template: `# Lending Protocol Patterns

This skill provides comprehensive knowledge for auditing DeFi lending protocols.

## Core Lending Concepts

| Concept | Description |
|---------|-------------|
| Collateral Factor | Max borrow % against collateral |
| Liquidation Threshold | Health level triggering liquidation |
| Utilization Rate | Borrowed / Total Supplied |
| Interest Rate | Function of utilization |
| Health Factor | Collateral value / Debt value |

---

## Liquidation Vulnerabilities

### 1. Profitable Self-Liquidation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Liquidator bonus too high
uint256 constant LIQUIDATION_BONUS = 15e16; // 15%

function liquidate(address user, uint256 repayAmount) external {
    // Attacker can:
    // 1. Borrow at 80% LTV
    // 2. Wait for tiny price drop
    // 3. Self-liquidate with 15% bonus
    // = Free 15% - (100% - 80%) = Net profit!
}
\`\`\`

**Check:** Liquidation bonus should be less than (100% - Max LTV).

### 2. Liquidation Cascade

\`\`\`solidity
// When one liquidation triggers another
// Large position liquidated → price drops → more liquidations

// Mitigations:
// - Gradual liquidation (partial)
// - Circuit breakers
// - Liquidation delays
\`\`\`

### 3. Bad Debt Accumulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No bad debt handling
function liquidate(address user) external {
    // If collateral < debt after liquidation
    // Bad debt remains in protocol
    // Eventually becomes insolvent
}

// SECURE: Handle underwater positions
function liquidate(address user) external {
    uint256 collateralValue = getCollateralValue(user);
    uint256 debtValue = getDebtValue(user);

    if (collateralValue < debtValue) {
        // Socialize bad debt or use insurance fund
        uint256 badDebt = debtValue - collateralValue;
        insuranceFund -= min(badDebt, insuranceFund);
    }
}
\`\`\`

---

## Interest Rate Model

### Standard Jump Rate Model

\`\`\`solidity
contract JumpRateModel {
    uint256 public baseRate;      // Rate at 0% utilization
    uint256 public multiplier;    // Rate increase per utilization
    uint256 public jumpMultiplier; // Rate increase above kink
    uint256 public kink;          // Utilization % where jump occurs

    function getBorrowRate(uint256 cash, uint256 borrows)
        public view returns (uint256)
    {
        uint256 utilization = borrows * 1e18 / (cash + borrows);

        if (utilization <= kink) {
            return baseRate + utilization * multiplier / 1e18;
        } else {
            uint256 normalRate = baseRate + kink * multiplier / 1e18;
            uint256 excessUtil = utilization - kink;
            return normalRate + excessUtil * jumpMultiplier / 1e18;
        }
    }
}
\`\`\`

### Interest Rate Vulnerabilities

**1. Rate Manipulation**
\`\`\`solidity
// Attacker can manipulate utilization
// 1. Flash loan large amount
// 2. Deposit → lower utilization → lower rates
// 3. Borrow at low rate
// 4. Withdraw and repay flash loan
\`\`\`

**2. Precision Loss**
\`\`\`solidity
// DANGEROUS: Interest rounds to 0 for small amounts
uint256 interest = principal * rate / SECONDS_PER_YEAR;
// If principal * rate < SECONDS_PER_YEAR, interest = 0

// SOLUTION: Accumulate interest with high precision
uint256 interestAccumulator; // Ray (1e27) precision
\`\`\`

---

## Collateral Vulnerabilities

### 1. Collateral Factor Changes

\`\`\`solidity
// DANGEROUS: Instant collateral factor reduction
function setCollateralFactor(address token, uint256 newFactor) external {
    collateralFactors[token] = newFactor;
    // Existing borrowers may become instantly liquidatable!
}

// SECURE: Grace period or gradual reduction
function setCollateralFactor(address token, uint256 newFactor) external {
    require(newFactor >= collateralFactors[token] - MAX_DECREASE);
    pendingFactors[token] = newFactor;
    factorEffectiveTime[token] = block.timestamp + TIMELOCK;
}
\`\`\`

### 2. Collateral Oracle Manipulation

\`\`\`solidity
// Collateral valued using manipulable oracle
// Attacker inflates collateral value → borrows more → profits
// See oracle vulnerability patterns
\`\`\`

### 3. Toxic Collateral

\`\`\`solidity
// Collateral that can't be liquidated:
// - Pausable tokens
// - Blacklistable tokens
// - Low liquidity tokens

// Mitigation: Whitelist collateral carefully
\`\`\`

---

## Health Factor Calculations

### Standard Formula

\`\`\`
Health Factor = (Collateral Value × LTV) / Debt Value

Health Factor > 1: Safe
Health Factor < 1: Liquidatable
\`\`\`

### Vulnerabilities

**1. Stale Health Factor**
\`\`\`solidity
// DANGEROUS: Cached health factor
mapping(address => uint256) public healthFactors;

// Health factors become stale as prices change
// Always compute in real-time
\`\`\`

**2. Rounding Direction**
\`\`\`solidity
// SECURE: Round health factor DOWN (safer)
uint256 healthFactor = collateralValue * 1e18 / debtValue;

// Round debt UP when calculating
uint256 debt = (borrowed * (1e18 + interest) + 1e18 - 1) / 1e18;
\`\`\`

---

## Lending Audit Checklist

### Liquidation
- [ ] Liquidation bonus < (100% - max LTV)
- [ ] Bad debt handling exists
- [ ] Partial liquidation supported
- [ ] Liquidation can't be blocked (pausable tokens)
- [ ] Self-liquidation not profitable

### Interest
- [ ] Interest accrues correctly over time
- [ ] No precision loss on small amounts
- [ ] Rate manipulation resistance
- [ ] Compound interest handled

### Collateral
- [ ] Oracle is manipulation-resistant
- [ ] Collateral factor changes have timelock
- [ ] Collateral whitelist is reasonable
- [ ] Handles rebasing/weird tokens properly

### Health Factor
- [ ] Computed in real-time
- [ ] Rounding favors protocol safety
- [ ] Handles all edge cases (0 debt, 0 collateral)

### Access Control
- [ ] Only authorized can change parameters
- [ ] Emergency pause exists
- [ ] Parameter bounds enforced

## Severity Classification

### Critical
- Self-liquidation profitable
- Bad debt not handled
- Oracle manipulation allows draining

### High
- Interest precision loss
- Collateral factor instant changes
- Same-block manipulation

### Medium
- Missing borrow caps
- Liquidation can be blocked
- Rate model edge cases
`,
}

export const stakingSkill: BuiltinSkill = {
  name: "staking",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing staking mechanisms.
Provides patterns for: reward-per-token accumulator (Synthetix style), lock periods,
multi-reward tokens, boosted staking. Critical: precision loss, first staker advantage,
late staker dilution, unstake reentrancy.`,
  template: `# Staking Protocol Patterns

This skill provides comprehensive knowledge for auditing DeFi staking and reward distribution mechanisms.

## Common Staking Patterns

### 1. Simple Staking (No Rewards)

\`\`\`solidity
contract SimpleStaking {
    mapping(address => uint256) public staked;

    function stake(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        staked[msg.sender] += amount;
    }

    function unstake(uint256 amount) external {
        require(staked[msg.sender] >= amount);
        staked[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
    }
}
\`\`\`

### 2. Reward Per Token Accumulator (Synthetix Style)

\`\`\`solidity
contract StakingRewards {
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        return rewardPerTokenStored +
            (rewardRate * (block.timestamp - lastUpdateTime) * 1e18 / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return (balanceOf[account] *
            (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) +
            rewards[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
}
\`\`\`

---

## Reward Distribution Vulnerabilities

### 1. Precision Loss

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Low precision accumulator
function rewardPerToken() public view returns (uint256) {
    // If rewardRate * timeDelta < totalSupply, result is 0!
    return rewardPerTokenStored +
        (rewardRate * (block.timestamp - lastUpdateTime) / totalSupply);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use high precision (1e18 or 1e27)
function rewardPerToken() public view returns (uint256) {
    return rewardPerTokenStored +
        (rewardRate * (block.timestamp - lastUpdateTime) * 1e18 / totalSupply);
}
\`\`\`

### 2. First Staker Advantage

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: First staker gets all pending rewards
function stake(uint256 amount) external {
    // If totalSupply was 0, rewardPerTokenStored didn't update
    // First staker claims all rewards since lastUpdateTime
    _updateReward(msg.sender);
    // ...
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function stake(uint256 amount) external {
    _updateReward(msg.sender);
    // If first staker, reset lastUpdateTime
    if (totalSupply == 0) {
        lastUpdateTime = block.timestamp;
    }
    // ...
}
\`\`\`

### 3. Late Staker Dilution Attack

\`\`\`
1. Attacker waits for rewards to accumulate
2. Stakes large amount just before reward distribution
3. Claims disproportionate rewards
4. Unstakes immediately

Mitigation: Time-weighted rewards or lock periods
\`\`\`

### 4. Reward Calculation Overflow

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Can overflow with large values
uint256 pending = balance * rewardPerToken / 1e18;
// If balance and rewardPerToken are both large...
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use mulDiv to avoid overflow
uint256 pending = FullMath.mulDiv(balance, rewardPerToken, 1e18);
\`\`\`

---

## Lock Period Vulnerabilities

### 1. Lockup Bypass

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Lock only checked on unstake
function unstake(uint256 amount) external {
    require(block.timestamp >= lockEnd[msg.sender], "Locked");
    // But user can transfer stake tokens!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Non-transferable during lock, or track per-deposit locks
function _beforeTokenTransfer(address from, address to, uint256) internal {
    if (from != address(0) && to != address(0)) {
        require(block.timestamp >= lockEnd[from], "Locked");
    }
}
\`\`\`

### 2. Lock Extension Manipulation

\`\`\`solidity
// If lock period extends on additional stake
// User might be tricked into longer lock than expected

// Always show clear lock end time before stake
\`\`\`

---

## Unstaking Vulnerabilities

### 1. Unstake Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Reward sent before state update
function unstake(uint256 amount) external {
    uint256 reward = earned(msg.sender);
    rewardToken.transfer(msg.sender, reward); // External call!
    balances[msg.sender] -= amount; // State update after
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function unstake(uint256 amount) external nonReentrant {
    uint256 reward = earned(msg.sender);
    balances[msg.sender] -= amount; // State first
    rewards[msg.sender] = 0;
    rewardToken.transfer(msg.sender, reward);
    stakedToken.transfer(msg.sender, amount);
}
\`\`\`

### 2. Dust Stuck in Contract

\`\`\`solidity
// Rounding can leave tiny amounts stuck
// Ensure users can withdraw their full balance

function unstake(uint256 amount) external {
    if (amount == type(uint256).max) {
        amount = balances[msg.sender];
    }
    // ...
}
\`\`\`

---

## Staking Audit Checklist

### Reward Calculation
- [ ] High precision used (1e18 minimum)
- [ ] No overflow in multiplication
- [ ] Division before multiplication avoided
- [ ] Zero totalSupply handled

### First/Late Staker
- [ ] First staker doesn't get all pending rewards
- [ ] Late staker can't dilute existing stakers unfairly
- [ ] Rewards accrue correctly when totalSupply changes

### Lock Periods
- [ ] Lock enforced on transfers (not just unstake)
- [ ] Lock extension clearly communicated
- [ ] No lock bypass via stake token transfer

### Reentrancy
- [ ] CEI pattern followed
- [ ] nonReentrant modifier on sensitive functions
- [ ] State updated before external calls

### Edge Cases
- [ ] Zero stake amount handled
- [ ] Full unstake (max amount) works
- [ ] Dust doesn't get stuck
- [ ] Reward period end handled

## Severity Classification

### Critical
- Reentrancy on unstake/claim
- First staker steals all rewards
- Precision loss loses significant value

### High
- Lock bypass possible
- Late staker dilution attack
- Reward overflow

### Medium
- Dust stuck in contract
- Boost manipulation
- Reward token update desync
`,
}

export const vaultErc4626Skill: BuiltinSkill = {
  name: "vault-erc4626",
  description: `Auto-loaded by defi-auditor agent during Phase 2 when analyzing ERC4626 vaults.
Provides patterns for: share/asset conversion, inflation attack mitigations,
rounding direction rules, donation attacks. Critical: first depositor attack,
virtual shares offset, dead shares burning.`,
  template: `# ERC4626 Vault Patterns

This skill provides comprehensive knowledge for auditing ERC4626 tokenized vaults.

## ERC4626 Overview

ERC4626 standardizes tokenized vaults:
- Deposit assets → receive shares
- Shares represent proportional ownership
- Redeem shares → receive assets

\`\`\`
shares = assets × totalSupply / totalAssets
assets = shares × totalAssets / totalSupply
\`\`\`

---

## Inflation Attack (First Depositor Attack)

### The Attack

\`\`\`
1. Vault is empty (totalSupply = 0, totalAssets = 0)
2. Attacker deposits 1 wei → gets 1 share
3. Attacker donates 1e18 tokens directly to vault
4. Now: totalSupply = 1, totalAssets = 1e18 + 1
5. Victim deposits 2e18 tokens
6. Victim gets: 2e18 × 1 / (1e18 + 1) = 1 share (rounds down!)
7. Attacker and victim each have 1 share
8. Attacker redeems: gets half of 3e18 + 1 = 1.5e18 tokens
9. Attacker profit: ~0.5e18 tokens stolen from victim
\`\`\`

### Vulnerable Pattern

\`\`\`solidity
// DANGEROUS: No inflation protection
function deposit(uint256 assets) public returns (uint256 shares) {
    shares = totalSupply() == 0
        ? assets
        : assets * totalSupply() / totalAssets();

    _mint(msg.sender, shares);
    asset.transferFrom(msg.sender, address(this), assets);
}
\`\`\`

### Mitigation 1: Virtual Shares/Assets

\`\`\`solidity
// Add virtual offset to prevent manipulation
uint256 constant VIRTUAL_SHARES = 1e3;
uint256 constant VIRTUAL_ASSETS = 1;

function totalSupply() public view override returns (uint256) {
    return super.totalSupply() + VIRTUAL_SHARES;
}

function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this)) + VIRTUAL_ASSETS;
}
\`\`\`

### Mitigation 2: Dead Shares (Burn on First Deposit)

\`\`\`solidity
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
\`\`\`

### Mitigation 3: Minimum Deposit

\`\`\`solidity
function deposit(uint256 assets) public returns (uint256 shares) {
    require(assets >= MIN_DEPOSIT, "Below minimum");
    // ...
}
\`\`\`

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

\`\`\`solidity
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
\`\`\`

### Vulnerable Pattern

\`\`\`solidity
// DANGEROUS: Wrong rounding direction
function withdraw(uint256 assets) public returns (uint256 shares) {
    // Should round UP, but rounds DOWN
    shares = assets * totalSupply() / totalAssets();
    // Attacker can withdraw dust repeatedly, extracting value
}
\`\`\`

---

## Donation Attack

### The Attack

\`\`\`
1. Attacker deposits normally, gets shares
2. Attacker donates assets directly to vault (not through deposit)
3. Share price increases
4. Attacker has fewer shares but same value
5. Other share calculations become incorrect
\`\`\`

### Vulnerable Scenarios

\`\`\`solidity
// If vault uses asset balance directly
function totalAssets() public view returns (uint256) {
    return asset.balanceOf(address(this)); // Manipulable!
}

// If reward distribution based on balance
function distribute() external {
    uint256 rewards = asset.balanceOf(address(this)) - lastBalance;
    // Donated amount included in rewards!
}
\`\`\`

### Mitigations

\`\`\`solidity
// Track assets internally
uint256 internal _totalAssets;

function deposit(uint256 assets) public {
    // ...
    _totalAssets += assets;
}

function totalAssets() public view returns (uint256) {
    return _totalAssets; // Not manipulable
}
\`\`\`

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
`,
}

export const reentrancySkill: BuiltinSkill = {
  name: "reentrancy",
  description: `Auto-loaded by reentrancy-auditor agent during Phase 2.
Provides detection patterns for: CEI violations, cross-function/cross-contract
reentrancy, read-only reentrancy, token callback exploits (ERC721/777/1155).
Core artifact: State Timeline map.`,
  template: `# Reentrancy Vulnerability Analysis

**2025 Statistics**: Reentrancy caused **$350M+** historical losses, OWASP 2025 ranks it **#5**, 2024 attacks include Penpie, Clober, GemPad.

---

## Why Reentrancy Happens (Root Causes)

### Root Cause 1: State Update After External Call

The fundamental CEI (Checks-Effects-Interactions) violation.

\`\`\`solidity
// VULNERABLE: State update AFTER external call
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool success,) = msg.sender.call{value: amount}("");  // @audit External call
    require(success);
    balances[msg.sender] -= amount;  // @audit State update AFTER!
}
\`\`\`

**Attacker's view**: "Between the call and the state update, I control execution. I'll call withdraw again before my balance updates."

### Root Cause 2: Execution Flow Transfer

Every external call hands control to potentially hostile code.

\`\`\`solidity
// Even "safe" patterns can transfer control:
IERC20(token).transfer(recipient, amount);    // Could be ERC777 with hooks!
NFT.safeTransferFrom(from, to, id);           // Triggers onERC721Received!
Token1155.safeTransferFrom(...);              // Triggers onERC1155Received!
\`\`\`

**Detection**: Any external call is a potential callback. Check what standards the token implements.

### Root Cause 3: Shared State Dependency

Multiple contracts/functions depend on same state variable.

\`\`\`solidity
// Contract has two functions sharing \`balances\`
function withdraw() external {
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // @audit Callback opportunity
    balances[msg.sender] = 0;  // @audit Updated after
}

function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount);  // @audit Same balance!
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
// During withdraw callback, attacker calls transfer() with STALE balance!
\`\`\`

**Attacker's view**: "ReentrancyGuard on withdraw() doesn't protect transfer(). I'll call transfer() during withdraw callback."

### Root Cause 4: View Function Exposure

View functions return stale data during callbacks, affecting external protocols.

\`\`\`solidity
// Contract A (Vault)
function withdraw() external {
    uint256 assets = userAssets[msg.sender];
    msg.sender.call{value: assets}("");  // @audit Callback
    userAssets[msg.sender] = 0;
    totalAssets -= assets;  // @audit Updated after
}

function getTotalAssets() public view returns (uint256) {
    return totalAssets;  // @audit Returns STALE value during callback!
}

// Contract B (Lending) reads from Contract A
function getCollateralValue(address user) view returns (uint256) {
    return vaultA.getTotalAssets() * userShares / totalShares;
    // During withdraw callback, totalAssets is WRONG!
}
\`\`\`

**Attacker's view**: "The view function shows the old value. External protocols that read this will make wrong decisions."

---

## The State Timeline (Core Artifact)

Every reentrancy finding MUST include a state timeline:

\`\`\`
T0: balances[attacker] = 100, contract.balance = 1000
T1: withdraw(100) called
T2: call{value: 100}("") → attacker.receive() triggered
T3: [CALLBACK] balances[attacker] STILL = 100! ← INCONSISTENT STATE
T4: Re-enter withdraw(100) with same balance
T5: Another 100 sent
T6: ... repeat until drained
T7: balances[attacker] -= 100 (executed N times, but all see 100)
\`\`\`

---

## Detection Patterns

### Pattern 1: Classic CEI Violation

**Root Cause**: State Update After External Call

\`\`\`solidity
// VULNERABLE: Textbook reentrancy
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);  // CHECK
    (bool success,) = msg.sender.call{value: amount}("");  // INTERACTION
    require(success);
    balances[msg.sender] -= amount;  // EFFECT - Wrong order!
}
\`\`\`

**Search Queries**:
\`\`\`
Grep("\\\\.call\\\\{value", glob="**/*.sol")
Grep("transfer\\\\(|send\\\\(", glob="**/*.sol")
\`\`\`

### Pattern 2: Cross-Function Reentrancy

**Root Cause**: Shared State Dependency

\`\`\`solidity
// Both functions use same \`balances\` mapping
function withdraw() external nonReentrant {  // Has guard
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // @audit Callback
    balances[msg.sender] = 0;
}

function transfer(address to, uint256 amt) external {  // NO guard!
    require(balances[msg.sender] >= amt);  // @audit Same state!
    balances[msg.sender] -= amt;
    balances[to] += amt;
}
\`\`\`

### Pattern 3: Cross-Contract Reentrancy

**Root Cause**: ReentrancyGuard Only Protects Single Contract

\`\`\`solidity
// Contract A
function withdraw() external nonReentrant {
    uint256 shares = userShares[msg.sender];
    msg.sender.call{value: shares}("");  // @audit Callback
    userShares[msg.sender] = 0;  // @audit Updated after
}

// Contract B (different contract, NO shared guard!)
function borrow() external {
    uint256 collateral = contractA.userShares(msg.sender);  // @audit Stale!
    require(collateral >= minCollateral);
    // Borrow against stale collateral value
}
\`\`\`

### Pattern 4: Read-Only Reentrancy

**Root Cause**: View Function Returns Stale Data

\`\`\`solidity
// Vault contract
function withdraw() external {
    uint256 assets = userAssets[msg.sender];
    msg.sender.call{value: assets}("");  // @audit Callback
    totalAssets -= assets;  // @audit Updated AFTER
}

function pricePerShare() public view returns (uint256) {
    return totalAssets * 1e18 / totalSupply;  // @audit Stale totalAssets!
}
\`\`\`

### Pattern 5: Token Callback Reentrancy

**Root Cause**: Hidden Callbacks in Token Standards

\`\`\`solidity
// VULNERABLE: ERC721 safeTransferFrom triggers callback
function stake(uint256 tokenId) external {
    nft.safeTransferFrom(msg.sender, address(this), tokenId);  // @audit Callback!
    userStake[msg.sender] += 1;  // @audit After callback
}
\`\`\`

**Token Standards with Callbacks**:

| Standard | Callback Function | Trigger |
|----------|------------------|---------|
| ERC721 | onERC721Received | safeTransferFrom, safeMint |
| ERC777 | tokensReceived, tokensToSend | transfer, transferFrom |
| ERC1155 | onERC1155Received | safeTransferFrom, mint |
| ERC1363 | onTransferReceived | transferAndCall |

---

## ReentrancyGuard Analysis

### Check Guard Coverage

\`\`\`
Grep("nonReentrant|ReentrancyGuard|_locked", glob="**/*.sol")
\`\`\`

### Verify Protection Scope

| Protection Level | Coverage | Bypass |
|-----------------|----------|--------|
| Single function | Only that function | Cross-function |
| Single contract | All functions in contract | Cross-contract |
| Cross-contract | Multiple contracts | Complex dependency |

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "We have ReentrancyGuard" | Guard only protects single contract. Cross-contract reentrancy bypasses it. |
| "We use SafeERC20" | SafeERC20 doesn't prevent callbacks, only handles return values. ERC777 still has hooks. |
| "The token is standard ERC20" | Verify on-chain. Many tokens implement ERC777 hooks silently. |
| "State is updated first" | Check cross-function. Other functions might read stale state during callback. |
| "It's just a view function" | Read-only reentrancy cost dForce $3.7M. View functions expose stale state. |
`,
}

export const oracleSkill: BuiltinSkill = {
  name: "oracle",
  description: `Auto-loaded by oracle-auditor agent during Phase 2.
Provides detection patterns for: stale prices, deprecated Chainlink functions,
L2 sequencer downtime, decimal mismatches, spot price manipulation, oracle DoS.
Core artifact: Oracle Integration Matrix.`,
  template: `# Oracle Vulnerability Patterns

This skill provides comprehensive knowledge for identifying oracle-related vulnerabilities in smart contracts.

## Overview

Oracles bridge off-chain data to on-chain contracts. Every oracle integration is a trust assumption that can be exploited if not properly validated.

## Detection Patterns

### 1. Stale Price Data

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No freshness check
(, int256 price,,,) = priceFeed.latestRoundData();
return uint256(price);
\`\`\`

**Secure Pattern:**
\`\`\`solidity
(uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) =
    priceFeed.latestRoundData();
require(updatedAt > block.timestamp - HEARTBEAT, "Stale price");
require(answeredInRound >= roundId, "Stale round");
require(price > 0, "Invalid price");
\`\`\`

**Search Pattern:**
\`\`\`
Grep("latestRoundData", glob="**/*.sol")
\`\`\`
Then verify each usage checks \`updatedAt\` timestamp.

---

### 2. Deprecated Chainlink Functions

**Vulnerable Pattern:**
\`\`\`solidity
// DEPRECATED: Can return stale data
int256 price = priceFeed.latestAnswer();
\`\`\`

**Detection:**
\`\`\`
Grep("latestAnswer|latestTimestamp|latestRound\\\\(\\\\)", glob="**/*.sol")
\`\`\`

---

### 3. L2 Sequencer Downtime (Arbitrum/Optimism)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS on L2: No sequencer check
(, int256 price,,,) = priceFeed.latestRoundData();
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Check sequencer uptime feed first
(, int256 answer,, uint256 updatedAt,) = sequencerFeed.latestRoundData();
bool isSequencerUp = answer == 0;
require(isSequencerUp, "Sequencer down");
require(block.timestamp - updatedAt > GRACE_PERIOD, "Grace period");

// Then get price
(, int256 price,,,) = priceFeed.latestRoundData();
\`\`\`

**Detection:**
- Check if deployed on L2 (Arbitrum, Optimism, Base)
- Search for sequencer uptime feed integration
\`\`\`
Grep("sequencer|SEQUENCER|isSequencerUp", glob="**/*.sol")
\`\`\`

---

### 4. Decimal Precision Mismatch

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes 8 decimals
uint256 priceInUsd = uint256(price) * 1e10; // Scale to 18 decimals
\`\`\`

**Secure Pattern:**
\`\`\`solidity
uint8 decimals = priceFeed.decimals();
uint256 scaledPrice = uint256(price) * (10 ** (18 - decimals));
\`\`\`

---

### 5. Spot Price Manipulation (Flash Loan Vulnerable)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Manipulable in single tx
(uint112 reserve0, uint112 reserve1,) = pair.getReserves();
uint256 price = reserve1 * 1e18 / reserve0;
\`\`\`

**Secure Pattern:**
- Use TWAP (Time-Weighted Average Price)
- Use Chainlink or other manipulation-resistant oracle
- Add minimum TWAP period (>= 30 minutes)

---

### 6. Oracle Revert DoS

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Revert blocks entire function
function getPrice() external view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
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
\`\`\`

---

### 7. Heartbeat Mismatch

Different price feeds have different update frequencies:

| Feed | Heartbeat | Deviation |
|------|-----------|-----------|
| ETH/USD | 1 hour | 0.5% |
| BTC/USD | 1 hour | 0.5% |
| Stablecoin | 24 hours | 0.25% |
| Low-cap | 24 hours | 1% |

---

## Oracle Audit Checklist

- [ ] Price freshness validated (\`updatedAt\` check)
- [ ] Zero/negative price rejected
- [ ] Round completeness verified (\`answeredInRound >= roundId\`)
- [ ] L2 sequencer uptime checked (if applicable)
- [ ] Decimal precision handled dynamically
- [ ] Heartbeat matches price feed specification
- [ ] No deprecated functions used
- [ ] Oracle revert handled gracefully
- [ ] No spot price from AMM (flash loan vulnerable)
- [ ] TWAP period sufficient (if using Uniswap)

## Severity Classification

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
`,
}

export const accessControlSkill: BuiltinSkill = {
  name: "access-control",
  description: `Auto-loaded by access-control-auditor agent during Phase 2.
Provides detection patterns for: missing modifiers, privilege escalation,
tx.origin phishing, OR/AND logic errors, missing two-step transfer.
Core artifact: Permission Matrix.`,
  template: `# Access Control Vulnerability Analysis

**2025 Statistics**: Access Control is **#1 vulnerability class** with **$953.2M in losses**.

---

## Why Access Control Bugs Happen (Root Causes)

### Root Cause 1: Intent-Implementation Gap

Developer thinks "only admin can call this" but forgets to add modifier.

\`\`\`solidity
// Developer INTENDED: only admin
// ACTUAL: anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit No modifier!
}
\`\`\`

**Detection**: Find external/public functions without modifiers, then verify intent.

### Root Cause 2: Visibility ≠ Permission

\`external\`/\`public\` means "anyone can call" - not a permission system.

\`\`\`solidity
// Visibility is NOT access control
function withdraw() public {  // @audit public ≠ "user's own funds"
    // Without checks, ANYONE withdraws ANYONE's funds
}
\`\`\`

### Root Cause 3: Undefined Trust Boundary

Who is "admin"? What can they do? Often undocumented.

\`\`\`solidity
// VULNERABLE: Admin powers undefined
function emergencyWithdraw() external onlyAdmin {
    // Can admin steal all user funds?
    // Is this documented? Intended?
}
\`\`\`

### Root Cause 4: Broken Permission Hierarchy

Admin can create admins → single key compromise = total system takeover.

\`\`\`solidity
// VULNERABLE: Flat admin hierarchy
function addAdmin(address newAdmin) external onlyAdmin {
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}
\`\`\`

---

## The Permission Matrix (Core Artifact)

Build this for every contract:

| Contract | Function | Sensitivity | Required Role | Actual Check | Gap? |
|----------|----------|-------------|---------------|--------------|------|
| Vault | withdraw | CRITICAL | User (own funds) | None | **YES** |
| Vault | setFee | HIGH | Admin | onlyOwner | No |
| Vault | pause | HIGH | Guardian | onlyAdmin | **WRONG ROLE** |
| Token | mint | CRITICAL | Minter | None | **YES** |

---

## Detection Patterns

### Pattern 1: Missing Access Control

\`\`\`solidity
// VULNERABLE: Anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit Anyone can manipulate price!
}

function withdrawAll() external {
    payable(msg.sender).transfer(address(this).balance);  // @audit No modifier!
}
\`\`\`

### Pattern 2: Privilege Escalation

\`\`\`solidity
// VULNERABLE: Admin can add arbitrary admins
function addAdmin(address newAdmin) external {
    require(admins[msg.sender], "Not admin");
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}

// VULNERABLE: Self-grant role
function grantRole(bytes32 role, address account) public {
    _grantRole(role, account);  // @audit No permission check!
}
\`\`\`

### Pattern 3: tx.origin Phishing

\`\`\`solidity
// VULNERABLE: Phishing via malicious contract
function withdraw() external {
    require(tx.origin == owner);  // @audit Phishing target!
    // Attacker tricks owner to call malicious contract
    // Malicious contract calls this function
    // tx.origin is still owner!
}
\`\`\`

### Pattern 4: Incorrect Permission Logic (OR vs AND)

\`\`\`solidity
// VULNERABLE: Should be AND, not OR
function sensitiveAction() external {
    require(hasRole(ADMIN) || hasRole(GUARDIAN));  // @audit OR allows either
    // Should require BOTH roles for high-sensitivity actions
}
\`\`\`

### Pattern 5: Missing Two-Step Transfer

\`\`\`solidity
// VULNERABLE: Single transaction transfer
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;  // @audit Typo in address = permanent loss
}

// SECURE: Two-step pattern
function transferOwnership(address newOwner) external onlyOwner {
    pendingOwner = newOwner;
}
function acceptOwnership() external {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
}
\`\`\`

---

## Centralization Risk Assessment

Document admin powers that can harm users:

| Admin Power | Risk Level | Impact |
|-------------|------------|--------|
| Pause withdrawals | High | Users locked out |
| Change fee to 100% | Critical | Rug pull |
| Upgrade implementation | Critical | Arbitrary code execution |
| Mint unlimited tokens | Critical | Inflation attack |
| Change oracle | Critical | Price manipulation |

**Flag as finding if**:
- Power is undocumented
- No timelock protection
- Single key (not multisig)

---

## Rationalization Table (Reject These Excuses)

| Excuse | Reality |
|--------|---------|
| "It's an internal function" | Internal functions can be called via public entry points |
| "Only admin can call this" | Admin keys get compromised; document the risk |
| "This is by design" | Document it as centralization risk if undocumented |
| "Low likelihood" | Access control bugs caused $953M in losses |
| "Frontend prevents this" | On-chain must be secure standalone |
`,
}

export const flashloanSkill: BuiltinSkill = {
  name: "flashloan",
  description: `Auto-loaded by flashloan-auditor agent during Phase 2.
Provides detection patterns for: price manipulation, governance manipulation,
collateral manipulation, reward manipulation, oracle manipulation via flash loans.
Core artifact: Flash Loan Attack Flow diagram.`,
  template: `# Flash Loan Attack Patterns

This skill provides comprehensive knowledge for identifying flash loan attack vulnerabilities in smart contracts.

## Overview

Flash loans provide unlimited capital for a single transaction. Any logic that depends on current state (balances, prices, voting power) without proper protection is potentially vulnerable.

## Attack Categories

### 1. Price Manipulation Attacks

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Spot price from AMM
function getPrice() public view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
    return reserve1 * 1e18 / reserve0;
}

function liquidate(address user) external {
    uint256 price = getPrice(); // Manipulable!
    uint256 collateralValue = collateral[user] * price;
    require(debt[user] > collateralValue, "Healthy");
    // Liquidate...
}
\`\`\`

**Attack Flow:**
\`\`\`
1. Flash loan large amount of token0
2. Dump into AMM → reserve1/reserve0 crashes
3. Call liquidate() at manipulated price
4. Buy back token0 cheap
5. Repay flash loan
6. Profit from unfair liquidation
\`\`\`

### 2. Governance Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Balance-based voting
function castVote(uint256 proposalId, bool support) external {
    uint256 votes = token.balanceOf(msg.sender); // Flash loanable!
    _recordVote(proposalId, msg.sender, votes, support);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
// Use snapshot at proposal creation
function castVote(uint256 proposalId, bool support) external {
    uint256 snapshotBlock = proposals[proposalId].snapshotBlock;
    uint256 votes = token.getPastVotes(msg.sender, snapshotBlock);
    _recordVote(proposalId, msg.sender, votes, support);
}
\`\`\`

### 3. Collateral Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Instant collateral increase
function borrow(uint256 amount) external {
    uint256 collateralValue = getCollateralValue(msg.sender);
    require(amount <= collateralValue * LTV, "Insufficient collateral");
    // Borrow...
}

function getCollateralValue(address user) public view returns (uint256) {
    return token.balanceOf(address(this)) * userShare[user] / totalShares;
    // ↑ Can be inflated with flash loan deposit
}
\`\`\`

### 4. Reward Manipulation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Balance-based rewards
function claimRewards() external {
    uint256 share = token.balanceOf(msg.sender) * 1e18 / token.totalSupply();
    uint256 reward = pendingRewards * share;
    // Distribute reward...
}
\`\`\`

---

## Flash Loan Protection Patterns

### 1. Snapshot/Checkpoint Pattern
\`\`\`solidity
// Record state at specific block
mapping(address => mapping(uint256 => uint256)) private _checkpoints;

function getPastBalance(address account, uint256 blockNumber)
    public view returns (uint256)
{
    require(blockNumber < block.number, "Future lookup");
    return _checkpoints[account][blockNumber];
}
\`\`\`

### 2. Time-Weighted Average
\`\`\`solidity
// TWAP resists single-block manipulation
function getTWAP(uint32 period) public view returns (uint256) {
    require(period >= MIN_TWAP_PERIOD, "Period too short");
    (int56[] memory tickCumulatives,) = pool.observe([period, 0]);
    int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
    return uint256(int256(tickDelta) / int256(uint256(period)));
}
\`\`\`

### 3. Same-Block Check
\`\`\`solidity
// Prevent same-block manipulation
mapping(address => uint256) private lastActionBlock;

modifier notSameBlock() {
    require(lastActionBlock[msg.sender] < block.number, "Same block");
    lastActionBlock[msg.sender] = block.number;
    _;
}
\`\`\`

### 4. Minimum Lock Period
\`\`\`solidity
// Require time commitment
mapping(address => uint256) private depositTime;

function withdraw() external {
    require(block.timestamp >= depositTime[msg.sender] + MIN_LOCK, "Locked");
    // Process withdrawal...
}
\`\`\`

---

## Flash Loan Audit Checklist

- [ ] No balance-based voting without snapshots
- [ ] No spot price usage from AMMs
- [ ] Collateral changes have time delay or checks
- [ ] Reward distribution uses checkpoints
- [ ] TWAP period is sufficient (>= 30 min)
- [ ] Same-block price changes detected
- [ ] Governance has proposal delay

## Flash Loan Sources

| Protocol | Max Amount | Fee |
|----------|------------|-----|
| AAVE V3 | Pool liquidity | 0.05% |
| dYdX | Pool liquidity | 0% |
| Balancer | Pool liquidity | 0% |
| Uniswap V3 | Pool liquidity | Pool fee |
| Maker | DAI supply | 0% |

## Severity Classification

### Critical
- Balance-based governance without snapshot
- Spot price for liquidations
- Unbounded collateral manipulation

### High
- TWAP period < 10 minutes
- No same-block protection for sensitive ops
- Reward distribution manipulation

### Medium
- Flash loan callback allows arbitrary calls
- Incomplete snapshot coverage
`,
}

export const logicErrorSkill: BuiltinSkill = {
  name: "logic-error",
  description: `Auto-loaded by logic-auditor agent during Phase 2.
Provides detection patterns for: division before multiplication, first depositor
attacks, precision loss, unchecked blocks, missing slippage, edge cases.
Core artifact: Calculation Flow Map.`,
  template: `# Business Logic Vulnerability Analysis

**2025 Statistics**: Logic errors caused **$63.8M+** losses, Input validation = **34.6% of vulnerabilities**, Rounding attacks (Bunni) = **$2.4M-$8.3M**.

---

## Why Logic Bugs Happen (Root Causes)

### Root Cause 1: Integer-Only Arithmetic

Solidity has NO floating point. Every division truncates.

\`\`\`solidity
// In normal math: 5 / 2 = 2.5
// In Solidity:    5 / 2 = 2  ← Where does 0.5 go?

uint256 fee = amount / 10000 * feeRate;
// If amount = 5000, feeRate = 100:
// 5000 / 10000 = 0  ← Division first!
// 0 * 100 = 0       ← Fee bypassed!
\`\`\`

### Root Cause 2: Operation Order

Division before multiplication destroys precision.

\`\`\`solidity
// VULNERABLE: Divide first
uint256 result = a / b * c;  // @audit Precision lost!

// SECURE: Multiply first
uint256 result = a * c / b;  // Preserves more precision

// Example with a=100, b=3, c=3:
// Wrong order: 100/3*3 = 33*3 = 99  (lost 1)
// Right order: 100*3/3 = 300/3 = 100 (exact)
\`\`\`

### Root Cause 3: Rounding Direction Mismatch

Protocol rounds in attacker's favor, not protocol's favor.

\`\`\`solidity
// VULNERABLE: Rounding favors user on withdraw
function withdraw(uint256 shares) external {
    uint256 assets = shares * totalAssets / totalSupply;  // @audit Rounds DOWN
    // Attacker withdraws many small amounts
    // Each time keeps the rounded-down dust
}

// SECURE: Round against the user
function withdraw(uint256 shares) external {
    uint256 assets = shares * totalAssets / totalSupply;  // Still rounds down
    // But on DEPOSIT, also round down (user gets fewer shares)
    // Protocol never loses from rounding
}
\`\`\`

**Rule**: Round DOWN on withdraw (user gets less), round DOWN on deposit (user pays more).

### Root Cause 4: Missing Edge Case Handling

Zero, one, max, first, last - all create special behaviors.

\`\`\`solidity
// VULNERABLE: No zero check
function distribute(uint256 amount, uint256 recipients) external {
    uint256 perPerson = amount / recipients;  // @audit recipients = 0 → revert
    // Or recipients = 1000000 → perPerson = 0
}
\`\`\`

---

## Detection Patterns

### Pattern 1: Division Before Multiplication

\`\`\`solidity
// VULNERABLE: Precision loss
uint256 fee = amount / 10000 * feeRate;
// If amount < 10000, fee = 0 regardless of feeRate!

uint256 share = deposit / totalAssets * totalSupply;
// Small deposits get 0 shares!
\`\`\`

**Search Queries**:
\`\`\`
Grep("/.*\\\\*", glob="**/*.sol")
Grep("\\\\*/", glob="**/*.sol")
\`\`\`

### Pattern 2: First Depositor / Vault Inflation Attack

\`\`\`solidity
// VULNERABLE: Standard ERC4626 share calculation
function deposit(uint256 assets) external returns (uint256 shares) {
    if (totalSupply == 0) {
        shares = assets;  // @audit First depositor sets the ratio!
    } else {
        shares = assets * totalSupply / totalAssets;
    }
}
\`\`\`

**Attack Flow** (Inflation Attack):
1. Deposit 1 wei → get 1 share
2. Donate 1,000,000 tokens directly to vault (not via deposit)
3. Now: totalAssets = 1,000,001, totalSupply = 1
4. Victim deposits 999,999 → shares = 999,999 * 1 / 1,000,001 = 0
5. Victim gets 0 shares, loses entire deposit
6. Attacker redeems 1 share → gets everything

### Pattern 3: Unchecked Return Values

\`\`\`solidity
// VULNERABLE: USDT returns false instead of reverting
IERC20(token).transfer(recipient, amount);  // @audit Return not checked!
// If transfer fails, execution continues with wrong state

// SECURE: Use SafeERC20
SafeERC20.safeTransfer(IERC20(token), recipient, amount);
\`\`\`

### Pattern 4: Integer Overflow in Unchecked Blocks

\`\`\`solidity
// VULNERABLE: Intentional unchecked can overflow
unchecked {
    balance += amount;  // @audit Can wrap to 0 if balance + amount > MAX
    counter--;          // @audit Can wrap to MAX if counter = 0
}
\`\`\`

### Pattern 5: Missing Slippage Protection

\`\`\`solidity
// VULNERABLE: User accepts any output
function swap(uint256 amountIn) external {
    uint256 amountOut = calculateOutput(amountIn);
    token.transfer(msg.sender, amountOut);  // @audit No minimum check!
}

// SECURE: Enforce minimum
function swap(uint256 amountIn, uint256 minAmountOut) external {
    uint256 amountOut = calculateOutput(amountIn);
    require(amountOut >= minAmountOut, "Slippage");
    token.transfer(msg.sender, amountOut);
}
\`\`\`

---

## Edge Case Testing Matrix

For EVERY value-handling function:

| Edge Case | Test Value | Common Bug | What to Check |
|-----------|------------|------------|---------------|
| **Zero** | \`0\` | Division by zero, empty transfer | Does it revert or return 0? |
| **One** | \`1\` | Rounds to zero, off-by-one | Minimum meaningful input? |
| **Max** | \`type(uint256).max\` | Overflow, gas exhaustion | Does unchecked wrap? |
| **First user** | Empty state | Ratio manipulation | Who sets initial ratio? |
| **Last user** | Only remaining | Stuck funds, dust | Can final user withdraw all? |
| **Boundary** | Just above/below limit | Off-by-one, \`<\` vs \`<=\` | Fencepost errors? |

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "It's just rounding" | Bunni lost $2.4M-$8.3M to rounding. Repeated calls accumulate. |
| "Users won't send dust" | Attackers absolutely will. Dust inputs are the exploit. |
| "Math is too complex" | MEV bots automate arbitrarily complex calculations. |
| "First depositor is trusted" | First depositor attack is #1 vault exploit in 2025. |
| "Frontend validates" | On-chain must be secure standalone. |
`,
}

export const economicAttackSkill: BuiltinSkill = {
  name: "economic-attack",
  description: `Auto-loaded by flashloan-auditor and defi-auditor agents during Phase 2.
Provides detection patterns for: spot price manipulation, oracle staleness,
short TWAP, donation attacks, slippage, flash loan governance.
Core artifact: Price Flow Map.`,
  template: `# Economic Attack Vulnerability Analysis

**2025 Statistics**: Flash loans = **83.3% of DeFi exploits**, Oracle manipulation = **+31% YoY**, Price manipulation = **34.3% of MUBs**.

---

## Attacker Mindset: Infinite Capital

**CRITICAL**: With flash loans, attackers have **INFINITE CAPITAL** for one transaction.

\`\`\`
+------------------------------------------------------------------+
|                  SINGLE ATOMIC TRANSACTION                        |
+------------------------------------------------------------------+
|  1. BORROW    | Flash loan $100M+ from Aave/dYdX (cost: 0.09%)   |
|  2. MANIPULATE| Change any on-chain value (price, balance, ratio) |
|  3. EXPLOIT   | Call target function with manipulated state       |
|  4. PROFIT    | Extract value (mint, borrow, swap at bad rate)   |
|  5. REPAY     | Return flash loan + fee                          |
|  6. KEEP      | Attacker keeps profit, victims lose funds        |
+------------------------------------------------------------------+
\`\`\`

**Key insight**: If ANY step fails, entire transaction reverts. Attacker loses only gas (~$50).

---

## Detection Patterns

### Pattern 1: Spot Price Dependency (Most Critical)

\`\`\`solidity
// VULNERABLE: Direct reserve ratio
function getTokenPrice() public view returns (uint256) {
    (uint112 r0, uint112 r1,) = pair.getReserves();
    return uint256(r1) * 1e18 / uint256(r0);  // @audit Instant manipulation
}
\`\`\`

**Attack Flow**:
1. Flash loan large amount of token0
2. Swap to drain token0 from pool → price spikes
3. Call victim function that reads this price
4. Profit at inflated price
5. Swap back, repay flash loan

### Pattern 2: Oracle Staleness

\`\`\`solidity
// VULNERABLE: No freshness validation
function getPrice() external view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price);  // @audit Could be stale!
}

// Attack opportunity:
// During high volatility, oracle updates lag
// Real ETH = $3000, Oracle still says $2500
// Attacker borrows at $2500 collateral value
// Immediately has undercollateralized position
\`\`\`

### Pattern 3: Short TWAP Window

\`\`\`solidity
// VULNERABLE: 1 minute TWAP
uint32[] memory secondsAgos = new uint32[](2);
secondsAgos[0] = 60;   // @audit Only 60 seconds!
secondsAgos[1] = 0;
(int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
\`\`\`

**Safe TWAP windows**:
- Minimum: 30 minutes (1800 seconds)
- Recommended: 1-4 hours for high-value decisions

### Pattern 4: Donation Attack / Share Inflation

\`\`\`solidity
// VULNERABLE: totalAssets includes donations
function totalAssets() public view returns (uint256) {
    return token.balanceOf(address(this));  // @audit Donatable!
}

function pricePerShare() public view returns (uint256) {
    return totalAssets() * 1e18 / totalSupply();  // @audit Inflatable!
}
\`\`\`

### Pattern 5: Missing Slippage Protection

\`\`\`solidity
// VULNERABLE: amountOutMin = 0
router.swapExactTokensForTokens(
    amountIn,
    0,  // @audit Sandwich target!
    path,
    msg.sender,
    block.timestamp
);
\`\`\`

### Pattern 6: Flash Loan Governance

\`\`\`solidity
// VULNERABLE: Current balance for voting power
function propose(bytes calldata action) external {
    uint256 votes = token.balanceOf(msg.sender);  // @audit Current!
    require(votes >= proposalThreshold);
    // Attacker: flash loan tokens → propose → return
}
\`\`\`

---

## Price Source Risk Matrix

| Source Type | Manipulation Risk | Attack Vector |
|-------------|-------------------|---------------|
| DEX Spot (getReserves) | **CRITICAL** | Flash loan swap |
| Uniswap V3 slot0 | **CRITICAL** | Flash loan swap |
| TWAP < 10 min | **HIGH** | Multi-block or validator |
| TWAP 10-30 min | **MEDIUM** | Validator collusion |
| TWAP > 30 min | **LOW** | Expensive sustained attack |
| Chainlink (no staleness) | **HIGH** | Wait for stale price |
| Chainlink (with staleness) | **LOW** | Limited window |
| balanceOf(this) | **HIGH** | Direct donation |

---

## Rationalization Table (Reject These Excuses)

| Excuse | Attacker's Reality |
|--------|-------------------|
| "Flash loans are expensive" | 0.09% fee on $100M = $90K. Profit can be millions. |
| "Pool has high liquidity" | Higher liquidity = need bigger flash loan. Still doable. |
| "TWAP protects us" | Short TWAP < 10min is still manipulable. Check the window. |
| "Chainlink is always accurate" | Chainlink can be stale. Always check \`updatedAt\`. |
| "Attack would cost too much" | Flash loan cost is near zero. Only gas at risk. |
`,
}

export const tokenSkill: BuiltinSkill = {
  name: "token",
  description: `Auto-loaded by token-auditor agent during Phase 2.
Provides detection patterns for: fee-on-transfer, rebasing tokens, ERC777 hooks,
ERC721/1155 callbacks, missing return values, blacklist/pausable, low decimals.
Core artifact: Token Compatibility Matrix.`,
  template: `# Token Vulnerability Patterns

This skill provides comprehensive knowledge for identifying token-related vulnerabilities in smart contracts.

## Overview

Not all tokens follow the "happy path" of standard implementations. Protocols must handle edge cases from fee tokens, rebasing tokens, callback tokens, and malicious tokens.

## Token Weirdness Categories

### 1. Fee-On-Transfer Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes transfer amount equals received amount
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    balances[msg.sender] += amount; // May be more than received!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function deposit(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - balanceBefore;
    balances[msg.sender] += received;
}
\`\`\`

**Common Fee Tokens:**
- PAXG (0.02% fee)
- STA (1% fee)
- USDT (potential fee, currently 0)

---

### 2. Rebasing Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Caches balance that will change
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakedAmount[msg.sender] = amount; // Becomes stale!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
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
\`\`\`

**Common Rebasing Tokens:**
- stETH (positive rebase daily)
- AMPL (elastic supply)
- OHM (rebasing)
- aTokens (AAVE interest)

---

### 3. ERC777 Callback Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: State updated after transfer
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    token.transfer(msg.sender, amount); // Triggers tokensReceived!
    balances[msg.sender] -= amount; // Too late!
}
\`\`\`

**ERC777 Hooks:**
- \`tokensToSend()\` - Called BEFORE transfer on sender
- \`tokensReceived()\` - Called AFTER transfer on recipient

---

### 4. ERC721/1155 Callback Reentrancy

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: safeTransfer triggers callback
function claimNFT(uint256 tokenId) external {
    nft.safeTransferFrom(address(this), msg.sender, tokenId);
    // onERC721Received callback runs HERE
    claimed[tokenId] = true; // State update after callback!
}
\`\`\`

**Callback Functions:**
- \`onERC721Received()\` - ERC721 safeTransfer
- \`onERC1155Received()\` - ERC1155 safeTransfer
- \`onERC1155BatchReceived()\` - ERC1155 safeBatchTransfer

---

### 5. Missing Return Value (USDT)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: USDT doesn't return bool
function deposit(uint256 amount) external {
    bool success = token.transfer(address(this), amount);
    require(success, "Transfer failed"); // USDT reverts here!
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

function deposit(uint256 amount) external {
    token.safeTransferFrom(msg.sender, address(this), amount);
}
\`\`\`

**Tokens Without Return:**
- USDT
- BNB
- Some older tokens

---

### 6. Blacklist/Pausable Tokens

**Risk:** Transfers can be blocked, causing DoS.

**Affected Tokens:**
- USDC (blacklist)
- USDT (blacklist + pausable)
- DAI (pausable)

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Can be blocked if recipient blacklisted
function withdraw() external {
    token.transfer(msg.sender, balances[msg.sender]); // May revert!
}
\`\`\`

**Mitigation:**
- Use pull-over-push pattern
- Allow alternate withdrawal addresses
- Handle transfer failures gracefully

---

### 7. Low Decimal Tokens

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Precision loss with low decimals
// WBTC has 8 decimals, not 18
uint256 priceInWei = wbtcAmount * ethPrice / 1e18; // Wrong scale!
\`\`\`

**Common Low Decimal Tokens:**
- WBTC (8 decimals)
- USDC (6 decimals)
- USDT (6 decimals)

---

### 8. Approval Race Condition

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Front-runnable approve
token.approve(spender, newAmount);
\`\`\`

**Attack:**
1. User has 100 approved
2. User calls approve(50) to reduce
3. Attacker front-runs: transferFrom(100)
4. Approve(50) executes
5. Attacker calls: transferFrom(50)
6. Total stolen: 150

**Secure Pattern:**
\`\`\`solidity
// Reset to 0 first, or use increaseAllowance
token.approve(spender, 0);
token.approve(spender, newAmount);

// Or use OZ increaseAllowance/decreaseAllowance
token.increaseAllowance(spender, amount);
\`\`\`

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
`,
}

export const crossChainSkill: BuiltinSkill = {
  name: "cross-chain",
  description: `Auto-loaded by cross-chain-auditor agent during Phase 2.
Provides detection patterns for: missing source chain/address validation,
replay attacks, message ordering, chain-specific code, finality assumptions.
Core artifact: Cross-Chain Message Flow diagram.`,
  template: `# Cross-Chain Vulnerability Patterns

This skill provides comprehensive knowledge for identifying cross-chain and bridge vulnerabilities in smart contracts.

## Overview

Cross-chain communication introduces trust assumptions at chain boundaries. Message verification is the entire security model - if messages can be forged or replayed, billions can be stolen.

## Historical Context

| Hack | Loss | Root Cause |
|------|------|------------|
| Ronin Bridge | $624M | Compromised validators |
| Wormhole | $326M | Signature verification bypass |
| Nomad | $190M | Initialization bug allowed fake proofs |
| Harmony Horizon | $100M | Compromised validators |

---

## Vulnerability Categories

### 1. Missing Source Chain Validation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Accepts from any chain
function receiveMessage(bytes calldata payload) external {
    // No srcChainId check!
    (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
    token.mint(recipient, amount);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function receiveMessage(uint16 srcChainId, bytes calldata payload) external {
    require(msg.sender == trustedEndpoint, "Invalid endpoint");
    require(srcChainId == ALLOWED_SOURCE_CHAIN, "Invalid source chain");
    // Process...
}
\`\`\`

---

### 2. Missing Source Address Validation

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Accepts from any address on source chain
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external {
    require(msg.sender == lzEndpoint);
    require(_srcChainId == trustedChain);
    // Missing: _srcAddress validation!
    _processPayload(_payload);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external {
    require(msg.sender == lzEndpoint, "Invalid endpoint");
    require(_srcChainId == trustedChain, "Invalid chain");
    require(
        keccak256(_srcAddress) == keccak256(abi.encodePacked(trustedRemote)),
        "Invalid source"
    );
    _processPayload(_payload);
}
\`\`\`

---

### 3. Replay Attacks

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: No nonce tracking
function processMessage(bytes32 messageId, bytes calldata data) external {
    // Can be replayed!
    _execute(data);
}
\`\`\`

**Secure Pattern:**
\`\`\`solidity
mapping(bytes32 => bool) public processedMessages;

function processMessage(bytes32 messageId, bytes calldata data) external {
    require(!processedMessages[messageId], "Already processed");
    processedMessages[messageId] = true;
    _execute(data);
}
\`\`\`

---

### 4. Message Ordering Issues

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes sequential processing
function receiveDeposit(uint256 depositId, uint256 amount) external {
    require(depositId == lastDepositId + 1, "Out of order"); // Can block!
    lastDepositId = depositId;
}
\`\`\`

**Risk:** One failed message blocks all subsequent messages.

**Secure Pattern:**
\`\`\`solidity
// Allow out-of-order processing with idempotency
function receiveDeposit(bytes32 depositHash, uint256 amount) external {
    require(!processed[depositHash], "Already processed");
    processed[depositHash] = true;
    _processDeposit(amount);
}
\`\`\`

---

### 5. Chain-Specific Code Assumptions

#### block.number Differences

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Different meaning on L2
uint256 blockAge = block.number - startBlock;
require(blockAge >= REQUIRED_BLOCKS, "Too early");
\`\`\`

**Chain Differences:**
| Chain | block.number Behavior |
|-------|----------------------|
| Ethereum | L1 block number |
| Arbitrum | L1 block number |
| Optimism | L2 block number |
| Polygon | L2 block number |

#### PUSH0 Opcode (Solidity 0.8.20+)

**Risk:** Contracts compiled with Solidity >=0.8.20 use PUSH0, not supported on:
- zkSync Era
- Arbitrum (until Dencun)
- Some other L2s

---

### 6. Finality Assumptions

**Vulnerable Pattern:**
\`\`\`solidity
// DANGEROUS: Assumes instant finality
function onMessageReceived(bytes calldata proof) external {
    // Process immediately after 1 confirmation
    _execute(proof);
}
\`\`\`

**Risk:** Chain reorganizations can invalidate processed messages.

**Chain Finality:**
| Chain | Finality Time | Confirmations |
|-------|---------------|---------------|
| Ethereum | ~15 min | 32 slots |
| Polygon | ~30 min | 256 blocks |
| BSC | ~3 min | 15 blocks |
| Arbitrum | 7 days (challenged) | Instant (sequencer) |

---

## LayerZero Specific Checks

\`\`\`solidity
// Required validations for LayerZero
function lzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
) external override {
    // 1. Endpoint check
    require(msg.sender == address(lzEndpoint), "Invalid endpoint");

    // 2. Chain check
    require(_srcChainId == trustedRemoteChain, "Invalid chain");

    // 3. Source address check
    bytes memory trustedRemote = trustedRemoteLookup[_srcChainId];
    require(
        _srcAddress.length == trustedRemote.length &&
        keccak256(_srcAddress) == keccak256(trustedRemote),
        "Invalid source"
    );

    // 4. Process payload
    _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
}
\`\`\`

---

## Cross-Chain Audit Checklist

- [ ] Source chain ID validated
- [ ] Source address validated
- [ ] Message nonce/ID tracked for replay protection
- [ ] Endpoint address verified (msg.sender check)
- [ ] Chain-specific code identified (block.number, PUSH0)
- [ ] Finality assumptions appropriate
- [ ] Out-of-order messages handled
- [ ] Failed message recovery possible

## Severity Classification

### Critical
- Missing source chain validation
- Missing source address validation
- No replay protection
- Signature verification bypass

### High
- Insufficient finality wait
- Message ordering DoS
- Cross-chain reentrancy

### Medium
- Chain-specific code assumptions
- Incomplete trusted remote setup
- Missing event emission
`,
}

/**
 * All builtin skills - domain knowledge for auditor agents.
 * Workflow skills (audit, poc, report) are defined as /commands, not skills.
 */
export const BUILTIN_SKILL_DEFINITIONS: BuiltinSkill[] = [
  codeAnalysisSkill,
  docsAnalysisSkill,
  lendingSkill,
  stakingSkill,
  vaultErc4626Skill,
  reentrancySkill,
  oracleSkill,
  accessControlSkill,
  flashloanSkill,
  logicErrorSkill,
  economicAttackSkill,
  tokenSkill,
  crossChainSkill,
]
