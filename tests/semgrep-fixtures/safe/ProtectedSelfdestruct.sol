// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// SAFE counterpart: selfdestruct guarded by an access-control modifier.
contract ProtectedSelfdestruct {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function kill(address payable to) public onlyOwner {
        selfdestruct(to);
    }
}
