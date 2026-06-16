// SPDX-License-Identifier: MIT
pragma solidity ^0.4.24;

// Triggers: uninitialized-storage-pointer
contract UninitializedStoragePointer {
    struct Data {
        uint256 a;
        uint256 b;
    }

    Data public stored;

    function corrupt() public {
        // Uninitialized local storage pointer (legacy footgun)
        Data storage ptr;
        ptr.a = 1;
    }
}
