// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function forceApprove(address spender, uint256 amount) external;
}

// SAFE counterpart: forceApprove (SafeERC20) instead of raw non-zero approve.
contract ApproveSafe {
    IERC20 public token;

    function grant(address spender, uint256 amount) external {
        token.forceApprove(spender, amount);
    }
}
