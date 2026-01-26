---
name: cross-chain
description: >
  Auto-loaded by cross-chain-auditor agent during Phase 2.
  Provides detection patterns for: missing source chain/address validation,
  replay attacks, message ordering, chain-specific code, finality assumptions.
  Core artifact: Cross-Chain Message Flow diagram.
user-invocable: false
---

# Cross-Chain Vulnerability Patterns

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
```solidity
// DANGEROUS: Accepts from any chain
function receiveMessage(bytes calldata payload) external {
    // No srcChainId check!
    (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
    token.mint(recipient, amount);
}
```

**Secure Pattern:**
```solidity
function receiveMessage(uint16 srcChainId, bytes calldata payload) external {
    require(msg.sender == trustedEndpoint, "Invalid endpoint");
    require(srcChainId == ALLOWED_SOURCE_CHAIN, "Invalid source chain");
    // Process...
}
```

**Detection:**
```
Grep("receiveMessage|onMessage|handleMessage", glob="**/*.sol")
```
Check if srcChainId is validated.

---

### 2. Missing Source Address Validation

**Vulnerable Pattern:**
```solidity
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
```

**Secure Pattern:**
```solidity
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
```

---

### 3. Replay Attacks

**Vulnerable Pattern:**
```solidity
// DANGEROUS: No nonce tracking
function processMessage(bytes32 messageId, bytes calldata data) external {
    // Can be replayed!
    _execute(data);
}
```

**Secure Pattern:**
```solidity
mapping(bytes32 => bool) public processedMessages;

function processMessage(bytes32 messageId, bytes calldata data) external {
    require(!processedMessages[messageId], "Already processed");
    processedMessages[messageId] = true;
    _execute(data);
}
```

**Detection:**
```
Grep("messageId|nonce|processed", glob="**/*.sol")
```
Check if there's uniqueness tracking.

---

### 4. Message Ordering Issues

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Assumes sequential processing
function receiveDeposit(uint256 depositId, uint256 amount) external {
    require(depositId == lastDepositId + 1, "Out of order"); // Can block!
    lastDepositId = depositId;
}
```

**Risk:** One failed message blocks all subsequent messages.

**Secure Pattern:**
```solidity
// Allow out-of-order processing with idempotency
function receiveDeposit(bytes32 depositHash, uint256 amount) external {
    require(!processed[depositHash], "Already processed");
    processed[depositHash] = true;
    _processDeposit(amount);
}
```

---

### 5. Chain-Specific Code Assumptions

#### block.number Differences

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Different meaning on L2
uint256 blockAge = block.number - startBlock;
require(blockAge >= REQUIRED_BLOCKS, "Too early");
```

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

**Detection:**
```
Grep("pragma solidity", glob="**/*.sol")
```
Check if version >= 0.8.20 and deploying to chains without PUSH0.

---

### 6. Bridge Lock/Mint Attacks

**Vulnerable Pattern:**
```solidity
// Source chain: Lock
function bridgeOut(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    emit BridgeOut(msg.sender, amount);
}

// Destination chain: Mint
function bridgeIn(address user, uint256 amount) external onlyRelayer {
    // If relayer is compromised or message forged...
    wrappedToken.mint(user, amount);
}
```

**Attack Vectors:**
1. Forge message without locking
2. Replay lock message
3. Lock on chain A, mint on chains B and C

**Mitigations:**
- Multi-sig relayers
- Optimistic verification with fraud proofs
- Zero-knowledge proofs
- Message hash verification

---

### 7. Finality Assumptions

**Vulnerable Pattern:**
```solidity
// DANGEROUS: Assumes instant finality
function onMessageReceived(bytes calldata proof) external {
    // Process immediately after 1 confirmation
    _execute(proof);
}
```

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

```solidity
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
```

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
