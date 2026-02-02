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

---

## Modern Bridge Protocols (2025-2026)

### Chainlink CCIP

**Key Security Checks:**
```solidity
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

contract MyCCIPReceiver is CCIPReceiver {
    mapping(uint64 => bool) public allowedSourceChains;
    mapping(address => bool) public allowedSenders;
    
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        // 1. Chain validation
        require(allowedSourceChains[message.sourceChainSelector], "Invalid chain");
        
        // 2. Sender validation
        address sender = abi.decode(message.sender, (address));
        require(allowedSenders[sender], "Invalid sender");
        
        // 3. Process message
        _processMessage(message.data);
    }
}
```

**CCIP-Specific Risks:**
- `sourceChainSelector` not validated
- `message.sender` not decoded/validated
- Rate limits not enforced
- Token transfer vs message confusion

**Search Queries:**
```
Grep("CCIP|ccip|CCIPReceiver|sourceChainSelector", glob="**/*.sol")
```

---

### Hyperlane

**Key Security Checks:**
```solidity
import {IMessageRecipient} from "@hyperlane-xyz/core/contracts/interfaces/IMessageRecipient.sol";

contract MyHyperlaneReceiver is IMessageRecipient {
    address public mailbox;
    mapping(uint32 => bytes32) public trustedSenders;
    
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _message
    ) external payable override {
        // 1. Mailbox validation
        require(msg.sender == mailbox, "Invalid mailbox");
        
        // 2. Origin chain validation
        require(trustedSenders[_origin] != bytes32(0), "Unknown origin");
        
        // 3. Sender validation
        require(_sender == trustedSenders[_origin], "Invalid sender");
        
        // 4. Process
        _processMessage(_message);
    }
}
```

**Hyperlane-Specific Risks:**
- Mailbox address not validated
- `_sender` is bytes32 (address left-padded)
- Interchain Security Module (ISM) misconfiguration
- Missing origin validation

**Search Queries:**
```
Grep("Hyperlane|hyperlane|IMessageRecipient|mailbox", glob="**/*.sol")
```

---

### Wormhole

**Key Security Checks:**
```solidity
import {IWormhole} from "./interfaces/IWormhole.sol";

contract MyWormholeReceiver {
    IWormhole public wormhole;
    mapping(uint16 => bytes32) public registeredEmitters;
    mapping(bytes32 => bool) public processedMessages;
    
    function receiveMessage(bytes memory encodedVM) external {
        // 1. Parse and verify VAA
        (IWormhole.VM memory vm, bool valid, string memory reason) = 
            wormhole.parseAndVerifyVM(encodedVM);
        require(valid, reason);
        
        // 2. Replay protection
        require(!processedMessages[vm.hash], "Already processed");
        processedMessages[vm.hash] = true;
        
        // 3. Emitter validation
        require(
            registeredEmitters[vm.emitterChainId] == vm.emitterAddress,
            "Invalid emitter"
        );
        
        // 4. Process payload
        _processPayload(vm.payload);
    }
}
```

**Wormhole-Specific Risks:**
- VAA not verified via `parseAndVerifyVM`
- Emitter chain/address not validated (Wormhole hack root cause)
- VAA hash not tracked for replay
- Guardian set changes

**Search Queries:**
```
Grep("Wormhole|wormhole|parseAndVerifyVM|emitterChainId", glob="**/*.sol")
```

---

### LayerZero v2

**Key Changes from v1:**
```solidity
// v2 uses OApp pattern
import { OApp } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";

contract MyOApp is OApp {
    constructor(address _endpoint, address _owner) OApp(_endpoint, _owner) {}
    
    function _lzReceive(
        Origin calldata _origin,  // New struct format
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        // Origin contains srcEid (endpoint ID), sender, nonce
        require(_origin.srcEid == trustedEndpointId, "Invalid source");
        require(_origin.sender == trustedSender, "Invalid sender");
        
        _processMessage(_message);
    }
}
```

**v2-Specific Considerations:**
- New `Origin` struct format
- `_guid` for message tracking
- Executor and extraData parameters
- DVN (Decentralized Verifier Network) configuration

**Search Queries:**
```
Grep("OApp|lz-evm-oapp|srcEid|_lzReceive", glob="**/*.sol")
```

---

### Axelar General Message Passing (GMP)

**Key Security Checks:**
```solidity
contract MyAxelarReceiver is AxelarExecutable {
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        // 1. Gateway validation (canonical gateway only)
        require(msg.sender == address(gateway), "Invalid gateway");
        // 2. Source chain validation
        require(keccak256(bytes(sourceChain)) == keccak256(bytes("ethereum")), "Invalid chain");
        // 3. Source address validation
        require(trustedSenders[sourceChain] == stringToAddress(sourceAddress), "Invalid sender");
        _processMessage(payload);
    }
}
```

**Axelar-Specific Risks:**
- Gateway address not validated (must be canonical gateway)
- Gas service payment not verified (underfunded messages fail silently)
- Command execution replay via missing CommandID tracking
- Source chain/address validation missing

**Search Queries:**
```
Grep("AxelarExecutable|_execute|IAxelarGateway", glob="**/*.sol")
```

---

### L2-to-L2 Messaging (2025-2026 Trend)

With L2 proliferation, direct L2-to-L2 messaging is emerging:

**Patterns:**
- Arbitrum Orbit ↔ Arbitrum Orbit
- OP Stack ↔ OP Stack (Superchain)
- zkSync Hyperchains

**Risks:**
- Sequencer trust assumptions differ per L2
- Finality varies significantly
- Shared security models may have gaps

**Search Queries:**
```
Grep("L2ToL2|superchain|hyperchain|orbit", glob="**/*.sol")
```

---

## Updated Cross-Chain Audit Checklist

### Protocol-Specific
- [ ] **LayerZero**: Trusted remote properly configured
- [ ] **CCIP**: sourceChainSelector validated
- [ ] **Hyperlane**: Mailbox and ISM configured
- [ ] **Wormhole**: parseAndVerifyVM used, emitter validated

### Universal
- [ ] Source chain validated
- [ ] Source address validated
- [ ] Message ID/hash tracked (replay protection)
- [ ] Finality assumptions match chain
- [ ] Failed message recovery exists
- [ ] Rate limiting implemented

---

## Search Query Reference

```
# Find bridge integrations
Grep("LayerZero|lzReceive|lzEndpoint|OApp", glob="**/*.sol")
Grep("CCIP|ccipReceive|CCIPReceiver", glob="**/*.sol")
Grep("Hyperlane|IMessageRecipient|mailbox", glob="**/*.sol")
Grep("Wormhole|parseAndVerifyVM|emitterChainId", glob="**/*.sol")

# Find cross-chain patterns
Grep("srcChainId|sourceChain|originChain|_origin", glob="**/*.sol")
Grep("trustedRemote|registeredEmitter|allowedSender", glob="**/*.sol")
```
