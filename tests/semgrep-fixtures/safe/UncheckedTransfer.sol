// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function safeTransfer(address to, uint256 amount) external;
    function safeTransferFrom(address from, address to, uint256 amount) external;
}

// SAFE counterpart: return values checked / SafeERC20 used.
contract UncheckedTransferSafe {
    IERC20 public token;

    function payout(address to, uint256 amount) external {
        require(token.transfer(to, amount), "transfer failed");
    }

    function pull(address from, uint256 amount) external {
        token.safeTransferFrom(from, address(this), amount);
    }
}
