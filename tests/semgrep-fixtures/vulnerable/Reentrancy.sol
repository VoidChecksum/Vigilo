// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Triggers: reentrancy-external-call-before-state
contract Reentrancy {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        // External call BEFORE state update -> CEI violation
        (bool ok) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] = balances[msg.sender] - amount;
    }
}
