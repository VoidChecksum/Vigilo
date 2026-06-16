// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: unprotected-low-level-call-value
contract UnprotectedLowLevelCallValue {
    function execute(address target, bytes data) public {
        // ETH-forwarding low-level call with user-controlled calldata, no access control
        target.call{value: 1 ether}(data);
    }
}
