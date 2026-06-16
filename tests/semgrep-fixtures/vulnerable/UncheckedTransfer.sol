// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// Triggers: unchecked-transfer-return
contract UncheckedTransfer {
    IERC20 public token;

    function payout(address to, uint256 amount) external {
        // Return value ignored
        token.transfer(to, amount);
    }

    function pull(address from, uint256 amount) external {
        // Return value ignored
        token.transferFrom(from, address(this), amount);
    }
}
