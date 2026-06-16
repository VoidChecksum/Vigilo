// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: tx-origin-authentication
contract TxOriginAuth {
    address public owner;

    function privileged() external view {
        // Authentication via tx.origin is phishable
        require(tx.origin == owner, "not owner");
    }
}
