---
name: access-control
description: >
  Auto-loaded by access-control-auditor agent during Phase 2.
  Provides detection patterns for: missing modifiers, privilege escalation,
  tx.origin phishing, OR/AND logic errors, missing two-step transfer.
  Core artifact: Permission Matrix.
user-invocable: false
---

# Access Control Vulnerability Analysis

**OWASP SC01:2025** - Access Control is **#1 vulnerability class** in OWASP Smart Contract Top 10 (2025), with **$1.2B+ in cumulative losses** through 2025, including the Bybit hack ($1.4B) and multiple privilege escalation exploits.

---

## Why Access Control Bugs Happen (Root Causes)

Understanding root causes helps detect vulnerabilities more effectively.

### Root Cause 1: Intent-Implementation Gap

Developer thinks "only admin can call this" but forgets to add modifier.

```solidity
// Developer INTENDED: only admin
// ACTUAL: anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit No modifier!
}
```

**Detection**: Find external/public functions without modifiers, then verify intent.

### Root Cause 2: Visibility ≠ Permission

`external`/`public` means "anyone can call" - not a permission system.

```solidity
// Visibility is NOT access control
function withdraw() public {  // @audit public ≠ "user's own funds"
    // Without checks, ANYONE withdraws ANYONE's funds
}
```

**Detection**: Every state-changing external/public function needs explicit permission checks.

### Root Cause 3: Undefined Trust Boundary

Who is "admin"? What can they do? Often undocumented.

```solidity
// VULNERABLE: Admin powers undefined
function emergencyWithdraw() external onlyAdmin {
    // Can admin steal all user funds?
    // Is this documented? Intended?
}
```

**Detection**: Map all admin powers. Flag undocumented capabilities as centralization risks.

### Root Cause 4: Broken Permission Hierarchy

Admin can create admins → single key compromise = total system takeover.

```solidity
// VULNERABLE: Flat admin hierarchy
function addAdmin(address newAdmin) external onlyAdmin {
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}
```

**Detection**: Trace role grant paths. Flag self-granting or circular hierarchies.

---

## The Permission Matrix (Core Artifact)

Build this for every contract:

| Contract | Function | Sensitivity | Required Role | Actual Check | Gap? |
|----------|----------|-------------|---------------|--------------|------|
| Vault | withdraw | CRITICAL | User (own funds) | None | **YES** |
| Vault | setFee | HIGH | Admin | onlyOwner | No |
| Vault | pause | HIGH | Guardian | onlyAdmin | **WRONG ROLE** |
| Token | mint | CRITICAL | Minter | None | **YES** |

### Sensitivity Classification

| Level | Examples | Impact if Missing |
|-------|----------|-------------------|
| **CRITICAL** | withdraw, transfer, mint, upgrade | Direct fund loss |
| **HIGH** | pause, setFee, setOracle | Protocol malfunction |
| **MEDIUM** | setParameter, whitelist | Degraded operation |
| **LOW** | view, pure functions | Information leak |

---

## Detection Patterns

### Pattern 1: Missing Access Control

**Root Cause**: Intent-Implementation Gap

```solidity
// VULNERABLE: Anyone can call
function setPrice(uint256 newPrice) external {
    price = newPrice;  // @audit Anyone can manipulate price!
}

function withdrawAll() external {
    payable(msg.sender).transfer(address(this).balance);  // @audit No modifier!
}
```

**Search Queries**:
```
Grep("function.*external(?!.*view)(?!.*pure)", glob="**/*.sol")
Grep("function.*public(?!.*view)(?!.*pure)", glob="**/*.sol")
```

**Verification Questions**:
- Does this function modify state?
- Is there a modifier or require statement?
- What is the intended caller?

### Pattern 2: Privilege Escalation

**Root Cause**: Broken Permission Hierarchy

```solidity
// VULNERABLE: Admin can add arbitrary admins
function addAdmin(address newAdmin) external {
    require(admins[msg.sender], "Not admin");
    admins[newAdmin] = true;  // @audit Compromised admin adds attacker
}

// VULNERABLE: Self-grant role
function grantRole(bytes32 role, address account) public {
    _grantRole(role, account);  // @audit No permission check!
}
```

**Search Queries**:
```
Grep("grantRole|addAdmin|setAdmin", glob="**/*.sol")
Grep("_setupRole|_grantRole", glob="**/*.sol")
```

**Verification Questions**:
- Can a role grant itself or other roles?
- Is there a role hierarchy (admin > moderator > user)?
- What happens if the top role is compromised?

### Pattern 3: tx.origin Phishing

**Root Cause**: Confusing transaction origin with message sender

```solidity
// VULNERABLE: Phishing via malicious contract
function withdraw() external {
    require(tx.origin == owner);  // @audit Phishing target!
    // Attacker tricks owner to call malicious contract
    // Malicious contract calls this function
    // tx.origin is still owner!
}
```

**Search Queries**:
```
Grep("tx\\.origin", glob="**/*.sol")
```

**Verification Questions**:
- Is tx.origin used for authorization?
- Can an attacker trick the owner into calling a malicious contract?

### Pattern 4: Incorrect Permission Logic (OR vs AND)

**Root Cause**: Logic error in permission checks

```solidity
// VULNERABLE: Should be AND, not OR
function sensitiveAction() external {
    require(hasRole(ADMIN) || hasRole(GUARDIAN));  // @audit OR allows either
    // Should require BOTH roles for high-sensitivity actions
}

// Also check for inverted logic
function withdraw() external {
    require(!blacklisted[msg.sender]);  // What if blacklist is empty?
}
```

**Search Queries**:
```
Grep("require.*\\|\\|", glob="**/*.sol")
Grep("require.*&&", glob="**/*.sol")
```

**Verification Questions**:
- Should this be AND or OR?
- What is the minimum permission needed?
- Can the condition be bypassed?

### Pattern 5: Missing Two-Step Transfer

**Root Cause**: No confirmation for critical ownership changes

```solidity
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
```

**Search Queries**:
```
Grep("transferOwnership|changeOwner|setOwner", glob="**/*.sol")
Grep("pendingOwner|acceptOwnership", glob="**/*.sol")
```

**Verification Questions**:
- Is ownership transfer single-step or two-step?
- What happens if wrong address is provided?
- Is there a timelock for ownership changes?

### Pattern 6: Role Hierarchy Exploitation (OpenZeppelin)

**Root Cause**: Misunderstanding of AccessControl patterns

```solidity
// VULNERABLE: DEFAULT_ADMIN_ROLE can grant any role
// If compromised, attacker controls everything
contract Vault is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        // @audit DEFAULT_ADMIN_ROLE can grant ADMIN_ROLE to anyone
    }
}
```

**Search Queries**:
```
Grep("DEFAULT_ADMIN_ROLE|AccessControl", glob="**/*.sol")
Grep("_setRoleAdmin|getRoleAdmin", glob="**/*.sol")
```

**Verification Questions**:
- Who holds DEFAULT_ADMIN_ROLE?
- Is there a two-step admin transfer?
- Can admin roles be renounced?
### Pattern 7: ERC-4337 Account Abstraction Vulnerabilities

**Root Cause**: Misunderstanding of EntryPoint trust model and Paymaster authorization

```solidity
// VULNERABLE: Paymaster doesn't validate caller
contract BadPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external view returns (bytes memory context, uint256 validationData) {
        // @audit No check that EntryPoint is canonical!
        // @audit No validation of userOp.sender (account contract)
        // Attacker can call this directly with arbitrary userOp
        return ("", 0);
    }
}

// VULNERABLE: EntryPoint not validated
contract BadAccount {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        // @audit No check that msg.sender is canonical EntryPoint
        // Attacker can call this with fake signature
        require(isValidSignature(userOp.signature, userOpHash), "Invalid sig");
        return 0;
    }
}

// VULNERABLE: Bundler can manipulate gas
function executeUserOp(UserOperation calldata userOp) external {
    // @audit No validation that bundler is trusted
    // Bundler can submit UserOp with inflated gas, drain paymaster
}
```

**Search Queries**:
```
Grep("validatePaymasterUserOp|validateUserOp", glob="**/*.sol")
Grep("EntryPoint|IEntryPoint", glob="**/*.sol")
Grep("UserOperation|userOp", glob="**/*.sol")
Grep("Paymaster|paymaster", glob="**/*.sol")
```

**Verification Questions**:
- Is the EntryPoint address hardcoded and canonical?
- Does Paymaster validate that msg.sender is EntryPoint?
- Does Account validate that msg.sender is EntryPoint?
- Can Paymaster be called directly by attackers?
- Does Paymaster check userOp.sender (account contract)?
- Is there a whitelist of trusted Paymasters?
- Can bundlers manipulate gas prices or limits?
- Is signature validation done correctly (UserOp hash vs transaction hash)?

---

## Line-by-Line Verification Checklist

For each external/public function:

- [ ] Does this function modify state?
- [ ] Is there a modifier applied?
- [ ] Does the modifier check the correct role?
- [ ] Can the require/revert condition be bypassed?
- [ ] Who is the intended caller? Is this documented?
- [ ] What is the worst case if anyone can call this?

### ERC-4337 Specific Checks (if applicable)

- [ ] Is EntryPoint address hardcoded and canonical?
- [ ] Does Paymaster validate msg.sender == EntryPoint?
- [ ] Does Account validate msg.sender == EntryPoint?
- [ ] Can Paymaster be called directly by non-EntryPoint callers?
- [ ] Does Paymaster validate userOp.sender (account contract)?
- [ ] Is there a whitelist of trusted Paymasters?
- [ ] Can bundlers manipulate gas prices or operation limits?
- [ ] Is signature validation using correct hash (UserOp vs transaction)?

---

## Centralization Risk Assessment

Document admin powers that can harm users:

| Admin Power | Risk Level | Impact |
|-------------|------------|--------|
| Pause withdrawals | High | Users locked out |
| Change fee to 100% | Critical | Rug pull |
| Upgrade implementation | Critical | Arbitrary code execution |
| Mint unlimited tokens | Critical | Inflation attack |
| Whitelist addresses | Medium | Censorship |
| Change oracle | Critical | Price manipulation |

**Flag as finding if**:
- Power is undocumented
- No timelock protection
- Single key (not multisig)

---

## Search Query Reference

```
# Find all entry points
Grep("function.*external|function.*public", glob="**/*.sol")

# Find modifiers
Grep("modifier\\s+\\w+", glob="**/*.sol")
Grep("onlyOwner|onlyAdmin|only\\w+", glob="**/*.sol")

# Find role management
Grep("grantRole|revokeRole|renounceRole", glob="**/*.sol")
Grep("transferOwnership|acceptOwnership", glob="**/*.sol")

# Find dangerous patterns
Grep("tx\\.origin", glob="**/*.sol")
Grep("selfdestruct|delegatecall", glob="**/*.sol")
```

---

## Rationalization Table (Reject These Excuses)

| Excuse | Reality |
|--------|---------|
| "It's an internal function" | Internal functions can be called via public entry points |
| "Only admin can call this" | Admin keys get compromised; document the risk |
| "This is by design" | Document it as centralization risk if undocumented |
| "Low likelihood" | Access control bugs caused $953M in losses |
| "I'll check later" | Check NOW or miss critical vulnerabilities |
| "The modifier exists somewhere" | Verify it's actually applied to THIS function |
| "Frontend prevents this" | On-chain must be secure standalone |
