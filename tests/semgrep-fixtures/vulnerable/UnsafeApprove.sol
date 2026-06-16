// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

// Triggers: unsafe-erc20-approve
contract UnsafeApprove {
    IERC20 public token;

    function grant(address spender, uint256 amount) external {
        // Non-zero approve without resetting allowance to zero first
        token.approve(spender, amount);
    }
}
