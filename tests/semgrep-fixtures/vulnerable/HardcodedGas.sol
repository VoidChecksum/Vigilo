// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

// Triggers: hardcoded-gas-amount
contract HardcodedGas {
    function pay(address to) public {
        // Hardcoded gas stipend forwarded with low-level call
        (bool ok, ) = to.call{value: 1 ether, gas: 2300}("");
        require(ok, "fail");
    }
}
