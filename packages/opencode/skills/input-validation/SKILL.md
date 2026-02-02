---
name: input-validation
description: >
  Auto-loaded by logic-auditor agent during Phase 2.
  Provides detection patterns for: missing zero checks, address validation,
  array bounds, parameter constraints, calldata validation, encoding issues.
  Core artifact: Input Validation Matrix.
user-invocable: false
---

# Input Validation Vulnerability Analysis

**OWASP SC04:2025** - Lack of Input Validation allows attackers to pass unexpected values that break contract invariants or enable exploits.

**2025-2026 Statistics**: Input validation failures account for **34.6% of all smart contract vulnerabilities**, contributing to $420M+ in losses.

---

## Why Input Validation Fails (Root Causes)

### Root Cause 1: Assumption of Good Faith

Developers assume callers will provide sensible inputs.

```solidity
// VULNERABLE: Assumes recipient is valid
function transfer(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;  // @audit to = address(0) burns tokens
}
```

**Attacker's view**: "They didn't check my input. Let me see what happens with edge cases."

### Root Cause 2: Missing Bounds Checking

Parameters have implicit bounds that aren't enforced.

```solidity
// VULNERABLE: No bounds on fee
function setFee(uint256 newFee) external onlyOwner {
    fee = newFee;  // @audit newFee = 100% drains users
}
```

### Root Cause 3: Type Confusion

Solidity's loose typing allows unexpected conversions.

```solidity
// VULNERABLE: Assumes bytes4 is valid selector
function executeCall(address target, bytes4 selector, bytes calldata data) external {
    (bool success,) = target.call(abi.encodePacked(selector, data));
    // @audit selector could be anything, including dangerous functions
}
```

### Root Cause 4: Array/Calldata Trust

Trusting array lengths and calldata structure from external sources.

```solidity
// VULNERABLE: Trusts array lengths match
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
    for (uint256 i = 0; i < recipients.length; i++) {
        _transfer(recipients[i], amounts[i]);  // @audit Arrays may have different lengths
    }
}
```

---

## The Input Validation Matrix (Core Artifact)

For each external function, document:

| Function | Parameter | Expected Range | Actual Check | Gap |
|----------|-----------|----------------|--------------|-----|
| transfer | to | != address(0) | None | **YES** |
| transfer | amount | <= balance | require(balance >= amount) | No |
| setFee | newFee | 0-1000 (0-10%) | None | **YES** |
| batchTransfer | recipients | len > 0 | None | **YES** |
| batchTransfer | amounts | len == recipients.len | None | **YES** |

---

## Detection Patterns

### Pattern 1: Missing Zero Address Check

**Root Cause**: Assumption of Good Faith

```solidity
// VULNERABLE: Zero address burns tokens/ETH
function withdraw(address recipient) external {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;
    payable(recipient).transfer(amount);  // @audit recipient = 0x0 burns ETH
}

// VULNERABLE: Zero address as critical role
function setAdmin(address newAdmin) external onlyOwner {
    admin = newAdmin;  // @audit newAdmin = 0x0 bricks admin functions
}
```

**Attack Flow**:
1. Attacker (or accident) calls with address(0)
2. Tokens/ETH sent to zero address are burned
3. Or critical role set to zero, bricking functionality
4. Irreversible loss

**Search Queries**:
```
Grep("address.*=|= address", glob="**/*.sol")
Grep("require.*!= address\\(0\\)", glob="**/*.sol")
Grep("setAdmin|setOwner|set.*Address", glob="**/*.sol")
```

**Mitigation**:
```solidity
function setAdmin(address newAdmin) external onlyOwner {
    require(newAdmin != address(0), "Zero address");
    admin = newAdmin;
}
```

### Pattern 2: Missing Amount/Value Bounds

**Root Cause**: Missing Bounds Checking

```solidity
// VULNERABLE: Fee can be set to 100%
function setFee(uint256 newFee) external onlyOwner {
    fee = newFee;  // @audit No maximum check
}

function withdraw(uint256 amount) external {
    uint256 feeAmount = amount * fee / 10000;
    uint256 netAmount = amount - feeAmount;  // @audit Can underflow if fee > 10000
    token.transfer(msg.sender, netAmount);
}
```

**Attack Flow**:
1. Malicious/compromised admin sets fee = 10000 (100%)
2. All user withdrawals get 0 tokens
3. Or fee = 20000 causes underflow (reverts all withdrawals)

**Search Queries**:
```
Grep("setFee|setRate|setMultiplier|setPercent", glob="**/*.sol")
Grep("external.*uint.*\\{[^}]*=[^}]*\\}", glob="**/*.sol")
```

**Mitigation**:
```solidity
uint256 public constant MAX_FEE = 1000; // 10%

function setFee(uint256 newFee) external onlyOwner {
    require(newFee <= MAX_FEE, "Fee too high");
    fee = newFee;
}
```

### Pattern 3: Array Length Mismatch

**Root Cause**: Array/Calldata Trust

```solidity
// VULNERABLE: No length check
function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts
) external {
    for (uint256 i = 0; i < recipients.length; i++) {
        _transfer(recipients[i], amounts[i]);  // @audit Out of bounds if amounts shorter
    }
}
```

**Attack Flow**:
1. Attacker calls with recipients.length = 10, amounts.length = 5
2. Loop accesses amounts[5], amounts[6], etc.
3. Reverts or reads garbage data
4. Unexpected behavior

**Search Queries**:
```
Grep("\\[\\].*calldata.*,.*\\[\\].*calldata", glob="**/*.sol")
Grep("for.*recipients\\.length|for.*addresses\\.length", glob="**/*.sol")
```

**Mitigation**:
```solidity
function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts
) external {
    require(recipients.length == amounts.length, "Length mismatch");
    require(recipients.length > 0, "Empty array");
    require(recipients.length <= MAX_BATCH_SIZE, "Batch too large");
    // ...
}
```

### Pattern 4: Missing Zero Amount Check

**Root Cause**: Assumption of Good Faith

```solidity
// VULNERABLE: Zero amount wastes gas and may break logic
function stake(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    stakes[msg.sender] += amount;
    emit Staked(msg.sender, amount);
    // @audit amount = 0 creates empty stake event, may break off-chain tracking
}

// VULNERABLE: Zero amount mints shares
function deposit(uint256 assets) external returns (uint256 shares) {
    shares = convertToShares(assets);
    // @audit If totalAssets = 0, assets = 0 gives shares = 0, wasting gas
    _mint(msg.sender, shares);
}
```

**Search Queries**:
```
Grep("function.*deposit.*uint|function.*stake.*uint", glob="**/*.sol")
Grep("require.*> 0|require.*!= 0", glob="**/*.sol")
```

### Pattern 5: Dangerous Selector/Calldata

**Root Cause**: Type Confusion

```solidity
// VULNERABLE: Arbitrary function call
function execute(address target, bytes calldata data) external onlyOwner {
    (bool success,) = target.call(data);  // @audit Can call ANY function
    require(success);
}

// VULNERABLE: Callback with untrusted selector
function processCallback(bytes4 selector, bytes calldata params) external {
    (bool success,) = msg.sender.call(abi.encodePacked(selector, params));
    // @audit Attacker controls selector
}
```

**Search Queries**:
```
Grep("\\.call\\(data\\)|\\.call\\(.*calldata", glob="**/*.sol")
Grep("bytes4.*selector|abi\\.encodePacked\\(.*selector", glob="**/*.sol")
```

**Mitigation**:
```solidity
// Whitelist allowed selectors
mapping(bytes4 => bool) public allowedSelectors;

function execute(address target, bytes calldata data) external onlyOwner {
    bytes4 selector = bytes4(data[:4]);
    require(allowedSelectors[selector], "Selector not allowed");
    (bool success,) = target.call(data);
    require(success);
}
```

### Pattern 6: Contract Address vs EOA

**Root Cause**: Missing Address Type Check

```solidity
// VULNERABLE: Assumes EOA, but could be contract
function sendReward(address winner) external {
    payable(winner).transfer(reward);  // @audit Contract might reject ETH
}

// VULNERABLE: Assumes contract, but could be EOA
function callHook(address hook) external {
    IHook(hook).onAction();  // @audit EOA call succeeds silently (no code)
}
```

**Search Queries**:
```
Grep("\\.transfer\\(|\\.send\\(", glob="**/*.sol")
Grep("address\\.code\\.length|isContract", glob="**/*.sol")
```

**Mitigation**:
```solidity
function sendReward(address winner) external {
    // Use call instead of transfer
    (bool success,) = winner.call{value: reward}("");
    require(success, "Transfer failed");
}

function callHook(address hook) external {
    require(hook.code.length > 0, "Not a contract");
    IHook(hook).onAction();
}
```

### Pattern 7: Deadline/Timestamp Validation

**Root Cause**: Missing Temporal Bounds

```solidity
// VULNERABLE: No deadline check
function swap(uint256 amountIn, uint256 minAmountOut) external {
    // Swap can execute at any time, even if price changed
    uint256 amountOut = _calculateSwap(amountIn);
    require(amountOut >= minAmountOut);
    // @audit Transaction pending for hours still executes
}
```

**Mitigation**:
```solidity
function swap(
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external {
    require(block.timestamp <= deadline, "Expired");
    // ...
}
```

---

## Input Validation Checklist

### Address Validation
- [ ] Zero address rejected where appropriate
- [ ] Self-address rejected if dangerous
- [ ] Contract vs EOA distinguished when needed
- [ ] Address format validated (if applicable)

### Amount Validation
- [ ] Zero amounts handled appropriately
- [ ] Maximum bounds enforced
- [ ] Minimum bounds enforced
- [ ] Overflow impossible (Solidity 0.8+)

### Array Validation
- [ ] Empty arrays rejected or handled
- [ ] Maximum length enforced
- [ ] Multiple array lengths match
- [ ] No out-of-bounds access

### Temporal Validation
- [ ] Deadlines enforced for time-sensitive ops
- [ ] Future timestamps validated
- [ ] Past timestamps handled

### Calldata Validation
- [ ] Selectors whitelisted if arbitrary calls
- [ ] Encoding validated
- [ ] Return data validated

---

## Search Query Reference

```
# Find missing zero checks
Grep("address.*=|setAdmin|setOwner|set.*Address", glob="**/*.sol")
Grep("payable\\(.*\\)\\.transfer", glob="**/*.sol")

# Find parameter setters
Grep("function set.*external|function update.*external", glob="**/*.sol")
Grep("onlyOwner|onlyAdmin", glob="**/*.sol")

# Find array operations
Grep("\\[\\].*calldata|\\[\\].*memory", glob="**/*.sol")
Grep("\\.length", glob="**/*.sol")

# Find arbitrary calls
Grep("\\.call\\(|delegatecall\\(|staticcall\\(", glob="**/*.sol")
```

---

## Severity Classification

### Critical
- Zero address burns funds permanently
- Missing bounds allow fund drain
- Array mismatch causes fund loss

### High
- Admin can set dangerous parameters
- Arbitrary call allows privilege escalation
- Missing deadline enables MEV extraction

### Medium
- Zero amount wastes gas
- Missing contract check causes silent failure
- Timestamp edge cases

---

## Rationalization Table (Reject These Excuses)

| Excuse | Reality |
|--------|---------|
| "Users won't send zero" | Attackers and mistakes WILL. Validate everything. |
| "Frontend validates" | On-chain must be secure standalone. Anyone can call directly. |
| "Admin is trusted" | Admin keys get compromised. Bound their powers. |
| "Arrays will always match" | Never trust external input structure. Validate lengths. |
| "It's just a view function" | Views affect external protocols. Garbage in = garbage out. |
| "Gas savings" | Validation costs <1000 gas. Exploits cost millions. |
