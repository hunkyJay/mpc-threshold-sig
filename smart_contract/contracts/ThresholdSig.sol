// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract ThresholdSig {
    address public signer;

    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event Transfer(address indexed to, uint256 amount, bytes32 messageHash);

    constructor(address _signer) {
        signer = _signer;
    }

    function verifySignature(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public view returns (bool) {
        return ecrecover(hash, v, r, s) == signer;
    }

    function transfer(
        address payable to,
        uint256 amount,
        bytes32 messageHash,
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) public {
        require(verifySignature(messageHash, v, r, s), "Invalid signature");

        to.transfer(amount);

        emit Transfer(to, amount, messageHash);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Function to receive Ether
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
}
