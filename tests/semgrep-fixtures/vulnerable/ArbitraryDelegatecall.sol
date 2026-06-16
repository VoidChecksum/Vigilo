// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: arbitrary-delegatecall
contract ArbitraryDelegatecall {
    function forward(address target, bytes memory data) public {
        // delegatecall target derived from a function parameter
        target.delegatecall(data);
    }
}
