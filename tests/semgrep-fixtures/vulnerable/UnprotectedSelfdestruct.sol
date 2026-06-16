// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: unprotected-selfdestruct
contract UnprotectedSelfdestruct {
    function kill(address payable to) public {
        selfdestruct(to);
    }
}
