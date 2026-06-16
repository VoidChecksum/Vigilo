// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: block-timestamp-manipulation
contract BlockTimestamp {
    uint256 public deadline;

    function claim() external view returns (bool) {
        if (block.timestamp > deadline) {
            return true;
        }
        return false;
    }
}
