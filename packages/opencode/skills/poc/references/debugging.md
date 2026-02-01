# PoC Debugging Guide

## Quick Reference

### Run Commands

```bash
# Run specific test
forge test --match-test "test_Exploit_H01" -vvv

# Run all PoC tests
forge test --match-path "test/poc/*.t.sol" -vvv

# Maximum trace detail
forge test --match-test "test_Exploit" -vvvvv
```

### Verbosity Levels

| Flag | Output |
|------|--------|
| `-v` | Results only |
| `-vv` | + Logs and events |
| `-vvv` | + Stack traces for failures |
| `-vvvv` | + Setup traces |
| `-vvvvv` | All traces |

---

## Error Types and Fixes

### Compile Error

**Symptoms**: `error[E0432]`, `error: cannot find`

**Fixes**:
```solidity
// Standard imports
import "forge-std/Test.sol";
import "forge-std/console2.sol";

// Project imports - check paths
import "../src/VulnerableContract.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
```

### Setup Reverted

**Symptoms**: `setUp() reverted`

**Fixes**:
- Check constructor arguments
- Verify sufficient funding
- Check deployment order

```solidity
function setUp() public {
    // Create actors first
    attacker = makeAddr("attacker");

    // Fund before deployment if needed
    vm.deal(attacker, 10 ether);

    // Deploy and label
    target = new VulnerableContract();
    vm.label(address(target), "Target");
}
```

### Assertion Failed

**Symptoms**: `assertion failed: Attacker must profit`

**Fixes**:
- Verify attack logic
- Adjust parameters
- Add debug logging

```solidity
// Add debug logging before assertion
console2.log("attackerBefore:", attackerBefore);
console2.log("attackerAfter:", attackerAfter);
console2.log("difference:", int256(attackerAfter) - int256(attackerBefore));
```

### Call Reverted

**Symptoms**: `call reverted`, `revert: ...`

**Fixes**:
- Check permissions (`vm.prank`)
- Verify state preconditions
- Check balance/allowance

```solidity
// Permission
vm.prank(attacker);
target.vulnerableFunction();

// Multiple calls
vm.startPrank(attacker);
target.deposit{value: 1 ether}();
target.withdraw(1 ether);
vm.stopPrank();
```

### Out of Gas

**Symptoms**: `OutOfGas`, very slow execution

**Fixes**:
- Limit loop iterations
- Add explicit gas limit

```solidity
// Limit reentrancy depth
if (attackCount < 5 && address(target).balance >= 1 ether) {
    attackCount++;
    target.withdraw(1 ether);
}
```

---

## Common Fixes

### Insufficient Funds

```solidity
// ETH
vm.deal(attacker, 100 ether);

// ERC20 (forge-std)
deal(address(usdc), attacker, 1_000_000e6);

// ERC20 (mint)
vm.prank(tokenOwner);
token.mint(attacker, 1000 ether);
```

### Time Manipulation

```solidity
// Advance timestamp
vm.warp(block.timestamp + 1 days);

// Advance block
vm.roll(block.number + 100);

// Skip duration
skip(7 days);
```

### Fork Testing

```bash
export ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
forge test --fork-url $ETH_RPC_URL --fork-block-number 18000000 -vvv
```

```solidity
function setUp() public {
    vm.createSelectFork("mainnet", 18000000);
    target = ITarget(0x1234...);
}
```

### State Snapshots

```solidity
uint256 snapshotId = vm.snapshot();

// Try something
target.exploit(1000);

// Restore and try different params
vm.revertTo(snapshotId);
target.exploit(500);
```

---

## Debug Logging Pattern

```solidity
function test_Exploit() public {
    console2.log("=== Step 1: Initial State ===");
    console2.log("Attacker balance:", attacker.balance / 1e18);
    console2.log("Target balance:", address(target).balance / 1e18);

    console2.log("=== Step 2: Execute Attack ===");
    vm.startPrank(attacker);
    // attack code...
    vm.stopPrank();

    console2.log("=== Step 3: Final State ===");
    console2.log("Attacker balance:", attacker.balance / 1e18);
    console2.log("Profit:", (attacker.balance - initialBalance) / 1e18);
}
```
