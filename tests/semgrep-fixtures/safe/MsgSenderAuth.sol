// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// SAFE counterpart: access control via msg.sender (not tx.origin).
contract MsgSenderAuth {
    address public owner;

    function privileged() external view {
        require(msg.sender == owner, "not owner");
    }
}
