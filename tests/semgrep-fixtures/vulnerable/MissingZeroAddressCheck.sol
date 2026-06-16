// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: missing-zero-address-check
contract MissingZeroAddressCheck {
    address public owner;

    function setOwner(address newOwner) public {
        // No zero-address guard before assigning to state
        owner = newOwner;
    }
}
