// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Vulnerable: the external call happens BEFORE the compound (`-=`) balance
// update. This is the canonical withdraw-reentrancy shape — most real-world
// reentrancy decrements a balance with `-=`, not a plain `=`.
contract ReentrancyCompound {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] -= amount; // state update AFTER the external call
    }
}
