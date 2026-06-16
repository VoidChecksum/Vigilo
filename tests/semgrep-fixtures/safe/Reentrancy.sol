// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// SAFE counterpart: checks-effects-interactions ordering.
contract ReentrancySafe {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        // State update BEFORE the external call
        balances[msg.sender] = balances[msg.sender] - amount;
        (bool ok) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
