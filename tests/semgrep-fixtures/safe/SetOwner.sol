// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// SAFE counterpart: zero-address guard before assignment.
contract SetOwnerSafe {
    address public owner;

    function setOwner(address newOwner) public {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }
}
