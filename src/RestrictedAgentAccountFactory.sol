// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {RestrictedAgentAccount} from "./RestrictedAgentAccount.sol";

contract RestrictedAgentAccountFactory {
    IEntryPoint public immutable entryPoint;
    address public immutable vault;
    address public immutable paymaster;

    constructor(IEntryPoint entryPoint_, address vault_, address paymaster_) {
        entryPoint = entryPoint_;
        vault = vault_;
        paymaster = paymaster_;
    }

    function createAccount(address owner, uint256 salt) external returns (RestrictedAgentAccount account) {
        address predicted = getAddress(owner, salt);
        if (predicted.code.length > 0) return RestrictedAgentAccount(payable(predicted));
        account = new RestrictedAgentAccount{salt: bytes32(salt)}(entryPoint, owner, vault, paymaster);
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory creation = abi.encodePacked(
            type(RestrictedAgentAccount).creationCode,
            abi.encode(entryPoint, owner, vault, paymaster)
        );
        return Create2.computeAddress(bytes32(salt), keccak256(creation));
    }
}
