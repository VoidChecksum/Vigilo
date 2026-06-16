// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Safe: the zero-address check is enforced by a modifier applied to the
// parameter, a common correct pattern the inline-guard checks would miss.
contract SetOwnerModifierSafe {
    address public owner;

    modifier nonZero(address a) {
        require(a != address(0), "zero address");
        _;
    }

    function setOwner(address newOwner) public nonZero(newOwner) {
        owner = newOwner;
    }
}
