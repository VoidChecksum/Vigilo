---
name: upgradeability
description: >
  Auto-loaded by access-control-auditor agent during Phase 2.
  Provides detection patterns for: UUPS/Transparent/Beacon proxy vulnerabilities,
  storage collision, initialization issues, function selector clashing, upgrade authorization.
  Core artifact: Proxy Architecture Map.
user-invocable: false
---

# Upgradeability & Proxy Pattern Vulnerabilities

**2025-2026 Statistics**: Proxy-related vulnerabilities caused $340M+ in losses, with initialization bugs and storage collision being the leading causes.

---

## Why Upgradeability Fails (Root Causes)

### Root Cause 1: Initialization vs Constructor

Proxies can't use constructors; initializers can be called multiple times.

```solidity
// VULNERABLE: No initialization protection
contract ImplementationV1 {
    address public owner;
    
    function initialize(address _owner) external {
        owner = _owner;  // @audit Can be called by anyone, multiple times!
    }
}
```

**Attacker's view**: "They forgot the initializer guard. I'll take ownership."

### Root Cause 2: Storage Layout Mismatch

Upgrades must maintain exact storage slot ordering.

```solidity
// V1 Storage
contract V1 {
    address public owner;     // slot 0
    uint256 public balance;   // slot 1
}

// V2 Storage - WRONG!
contract V2 {
    uint256 public newVar;    // slot 0 - COLLISION with owner!
    address public owner;     // slot 1
    uint256 public balance;   // slot 2
}
```

### Root Cause 3: delegatecall Context

Implementation code runs with proxy's storage and context.

```solidity
// VULNERABLE: selfdestruct in implementation
contract Implementation {
    function destroy() external onlyOwner {
        selfdestruct(payable(owner));  // @audit Destroys PROXY, not implementation!
    }
}
```

### Root Cause 4: Unprotected Upgrade Function

Anyone can upgrade to malicious implementation.

```solidity
// VULNERABLE: Missing access control on upgrade
contract UUPSVulnerable is UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override {
        // @audit No onlyOwner check!
    }
}
```

---

## Proxy Patterns Overview

### Transparent Proxy Pattern

```
User → Proxy (storage + delegatecall) → Implementation (logic)
         ↓
      Admin → ProxyAdmin (upgrade logic)
```

**Key Features**:
- Admin calls go to ProxyAdmin, not implementation
- Users can't accidentally call admin functions
- Requires separate ProxyAdmin contract

### UUPS Pattern (EIP-1822)

```
User → Proxy (storage + delegatecall) → Implementation (logic + upgrade)
```

**Key Features**:
- Upgrade logic in implementation
- Smaller proxy bytecode
- Risk: forgetting upgrade function in new implementation

### Beacon Pattern

```
User → Proxy → Beacon → Implementation
                 ↑
            Multiple proxies share beacon
```

**Key Features**:
- Single upgrade updates all proxies
- Good for factory patterns
- More complex architecture

---

## The Proxy Architecture Map (Core Artifact)

For each proxy system, document:

| Component | Address | Type | Storage | Risk |
|-----------|---------|------|---------|------|
| Proxy | 0x1234... | TransparentProxy | User data | Storage collision |
| Implementation | 0x5678... | Logic V1 | None | selfdestruct |
| ProxyAdmin | 0x9abc... | Admin | None | Access control |
| Beacon | N/A | N/A | N/A | N/A |

---

## Detection Patterns

### Pattern 1: Unprotected Initializer

**Root Cause**: Initialization vs Constructor

```solidity
// VULNERABLE: Can be re-initialized
contract VaultV1 {
    address public owner;
    bool private _initialized;  // @audit Wrong pattern
    
    function initialize(address _owner) external {
        require(!_initialized);  // @audit Can be front-run!
        owner = _owner;
        _initialized = true;
    }
}
```

**Attack Flow**:
1. Protocol deploys implementation
2. Protocol deploys proxy
3. Attacker front-runs initialize() call
4. Attacker becomes owner
5. Attacker drains protocol

**Search Queries**:
```
Grep("function initialize|initializer", glob="**/*.sol")
Grep("Initializable|_initialized|initializing", glob="**/*.sol")
```

**Secure Pattern**:
```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VaultV1 is Initializable {
    address public owner;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();  // Prevent implementation initialization
    }
    
    function initialize(address _owner) external initializer {
        owner = _owner;
    }
}
```

### Pattern 2: Storage Collision

**Root Cause**: Storage Layout Mismatch

```solidity
// V1
contract VaultV1 {
    address public owner;     // slot 0
    uint256 public balance;   // slot 1
}

// V2 - VULNERABLE
contract VaultV2 {
    address public newAdmin;  // slot 0 - OVERWRITES owner!
    address public owner;     // slot 1 - READS balance as address!
    uint256 public balance;   // slot 2
}
```

**Attack Flow**:
1. V1 deployed with owner = 0x1234...
2. Upgrade to V2
3. newAdmin (slot 0) now contains old owner value
4. owner (slot 1) now reads balance (corrupted)
5. Access control broken

**Search Queries**:
```
Grep("pragma solidity|contract.*is.*Upgradeable", glob="**/*.sol")
```

**Detection**:
- Use `forge inspect Contract storage-layout`
- Compare layouts between versions
- Check inheritance order

**Secure Pattern**:
```solidity
// V2 - CORRECT: Append only
contract VaultV2 {
    address public owner;     // slot 0 - SAME
    uint256 public balance;   // slot 1 - SAME
    address public newAdmin;  // slot 2 - NEW at end
}
```

### Pattern 3: UUPS Missing Upgrade Authorization

**Root Cause**: Unprotected Upgrade Function

```solidity
// VULNERABLE: No access control
contract MyUUPS is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {
        // @audit Empty = anyone can upgrade!
    }
}

// VULNERABLE: Wrong check
contract MyUUPS is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == owner);  // @audit What if owner is uninitialized?
    }
}
```

**Attack Flow**:
1. Attacker deploys malicious implementation
2. Calls upgradeTo(maliciousImpl)
3. No authorization check passes
4. Proxy now points to malicious code
5. Attacker drains all funds

**Search Queries**:
```
Grep("_authorizeUpgrade|UUPSUpgradeable", glob="**/*.sol")
Grep("upgradeTo|upgradeToAndCall", glob="**/*.sol")
```

**Secure Pattern**:
```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
    // Additional checks possible
    require(newImplementation != address(0), "Zero address");
}
```

### Pattern 4: UUPS Implementation Without Upgrade Function

**Root Cause**: Upgrade Logic Removed

```solidity
// V1 - Has upgrade
contract VaultV1 is UUPSUpgradeable {
    function _authorizeUpgrade(address) internal override onlyOwner {}
}

// V2 - VULNERABLE: No longer upgradeable!
contract VaultV2 {
    // Forgot to inherit UUPSUpgradeable!
    // Contract is now BRICKED - can never upgrade again
}
```

**Search Queries**:
```
Grep("is UUPSUpgradeable|is.*Upgradeable", glob="**/*.sol")
```

### Pattern 5: selfdestruct in Implementation

**Root Cause**: delegatecall Context

```solidity
// VULNERABLE: selfdestruct destroys proxy's storage
contract Implementation {
    function emergencyDestroy() external onlyOwner {
        selfdestruct(payable(msg.sender));
        // @audit This destroys the PROXY, not the implementation!
    }
}
```

**Attack Flow**:
1. Attacker gains owner access (via other vuln)
2. Calls emergencyDestroy()
3. Proxy contract is destroyed
4. All funds in proxy lost forever

**Note**: `selfdestruct` is deprecated in Solidity 0.8.20+ but may still exist in older code.

**Search Queries**:
```
Grep("selfdestruct|SELFDESTRUCT", glob="**/*.sol")
Grep("delegatecall.*selfdestruct", glob="**/*.sol")
```

### Pattern 6: Function Selector Clashing

**Root Cause**: Proxy and Implementation Share Function Namespace

```solidity
// Proxy has admin() at selector 0xf851a440
// If implementation has function with same selector, collision occurs

// DANGEROUS: Implementation function clashes with proxy admin function
contract Implementation {
    // This selector might clash with proxy's admin()
    function admin_() external returns (address) {  // @audit Check selector!
        return address(this);
    }
}
```

**Detection**:
```bash
# Check function selectors
cast sig "admin()"
cast sig "functionName()"
```

**Search Queries**:
```
Grep("function admin|function upgrade|function implementation", glob="**/*.sol")
```

### Pattern 7: Transparent Proxy Admin Exposure

**Root Cause**: ProxyAdmin Access Control

```solidity
// VULNERABLE: ProxyAdmin owner can be changed
contract MyProxyAdmin is ProxyAdmin {
    // If ownership transferred to attacker...
    // Attacker can upgrade to malicious implementation
}
```

**Search Queries**:
```
Grep("ProxyAdmin|TransparentUpgradeableProxy", glob="**/*.sol")
Grep("changeProxyAdmin|transferOwnership", glob="**/*.sol")
```

### Pattern 8: Storage Collision Prevention (ERC-7201)

**Root Cause**: Unnamespaced Storage in Upgradeable Contracts

ERC-7201 introduces namespaced storage to prevent collisions when inheriting from multiple upgradeable contracts. Without it, storage slots can collide across inheritance chains.

```solidity
// VULNERABLE: Sequential storage without namespacing
contract VaultV1 {
    address public owner;     // slot 0
    uint256 public balance;   // slot 1
}

// When inherited by child contract, slots collide
contract ChildVault is VaultV1 {
    address public admin;     // slot 0 - COLLISION with owner!
    uint256 public fee;       // slot 1 - COLLISION with balance!
}
```

**Attack Flow**:
1. Parent contract uses slots 0-1
2. Child contract adds variables
3. Child's variables overwrite parent's storage
4. State corruption and access control bypass

**Secure Pattern (ERC-7201)**:
```solidity
// @custom:storage-location erc7201:myprotocol.vault
contract VaultV1 is Initializable {
    struct VaultStorage {
        address owner;
        uint256 balance;
    }
    
    bytes32 private constant VAULT_STORAGE_LOCATION = 
        keccak256(abi.encode(uint256(keccak256("myprotocol.vault")) - 1)) & ~bytes32(uint256(0xff));
    
    function _getVaultStorage() private pure returns (VaultStorage storage $) {
        assembly {
            $.slot := VAULT_STORAGE_LOCATION
        }
    }
    
    function initialize(address _owner) external initializer {
        VaultStorage storage $ = _getVaultStorage();
        $.owner = _owner;
    }
}
```

**Search Queries**:
```
Grep("@custom:storage-location|erc7201|erc-7201", glob="**/*.sol")
Grep("keccak256.*abi.encode.*keccak256", glob="**/*.sol")
Grep("bytes32.*STORAGE_LOCATION", glob="**/*.sol")
```

**Detection**:
- Check for `@custom:storage-location` NatSpec annotations
- Verify storage location calculation uses ERC-7201 formula
- Confirm assembly block uses correct slot offset
- Validate namespace ID is unique per contract

---

## Upgradeability Audit Checklist

### Initialization
- [ ] Uses OpenZeppelin Initializable pattern
- [ ] Constructor calls `_disableInitializers()`
- [ ] `initialize()` has `initializer` modifier
- [ ] Cannot be re-initialized

### Storage
- [ ] Storage layout documented
- [ ] No variables reordered in upgrades
- [ ] New variables only appended
- [ ] Inheritance order preserved
- [ ] Storage gaps for future inheritance
- [ ] ERC-7201 namespaced storage used (if multiple inheritance)
- [ ] `@custom:storage-location` annotations present
- [ ] Storage location calculation correct (keccak256 formula)

### UUPS Specific
- [ ] `_authorizeUpgrade` has proper access control
- [ ] All upgrade versions maintain UUPSUpgradeable
- [ ] `upgradeTo` is properly protected

### Transparent Proxy Specific
- [ ] ProxyAdmin properly secured
- [ ] No selector clashing
- [ ] Admin functions not callable by users

### General
- [ ] No `selfdestruct` in implementation
- [ ] No `delegatecall` to untrusted contracts
- [ ] Upgrade timelock exists
- [ ] Emergency pause available

---

## Storage Gap Pattern

```solidity
// Reserve storage slots for future variables in base contracts
abstract contract BaseContractV1 is Initializable {
    address public owner;
    uint256[49] private __gap;  // Reserve 49 slots
}

// When adding new variables, reduce gap
abstract contract BaseContractV2 is Initializable {
    address public owner;
    address public newAdmin;   // Uses one gap slot
    uint256[48] private __gap; // Now 48 slots
}
```

---

## Search Query Reference

```
# Find proxy patterns
Grep("delegatecall|Proxy|proxy", glob="**/*.sol")
Grep("ERC1967|TransparentUpgradeable|UUPSUpgradeable", glob="**/*.sol")

# Find initialization
Grep("initialize|initializer|Initializable", glob="**/*.sol")
Grep("_disableInitializers|reinitializer", glob="**/*.sol")

# Find dangerous operations
Grep("selfdestruct|SELFDESTRUCT", glob="**/*.sol")
Grep("delegatecall\\(|staticcall\\(", glob="**/*.sol")

# Find upgrade functions
Grep("upgradeTo|upgradeToAndCall|_authorizeUpgrade", glob="**/*.sol")
Grep("changeProxyAdmin|setImplementation", glob="**/*.sol")

# Find storage patterns
Grep("__gap|storage.*gap", glob="**/*.sol")
```

---

## Severity Classification

### Critical
- Unprotected initializer (ownership takeover)
- UUPS without authorization (upgrade takeover)
- selfdestruct in implementation (permanent fund loss)

### High
- Storage collision in upgrade (data corruption)
- Missing upgrade function in new version (brick)
- ProxyAdmin ownership vulnerability

### Medium
- Function selector clashing
- Missing storage gaps
- Incomplete initialization

---

## Rationalization Table (Reject These Excuses)

| Excuse | Reality |
|--------|---------|
| "We'll initialize right away" | Attackers monitor mempool. They WILL front-run. |
| "Storage order is obvious" | Inheritance chains make it complex. Verify with tools. |
| "Nobody uses selfdestruct" | Legacy code exists. Check every implementation. |
| "Upgrades are rare" | One bad upgrade = total loss. Every upgrade matters. |
| "ProxyAdmin is secure" | ProxyAdmin controls millions. It's THE target. |
| "UUPS is simpler" | UUPS has unique risks. Don't assume safety. |
