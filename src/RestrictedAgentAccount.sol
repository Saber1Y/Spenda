// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "@account-abstraction/contracts/core/Helpers.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IRestrictedVault {
    function executeSpend(address token, address target, uint256 amount, bytes calldata data, bytes32 actionId)
        external
        returns (bool approved);
}

/// @notice ERC-4337 account whose only executable action is a sponsored call to one Spenda vault.
contract RestrictedAgentAccount is BaseAccount {
    address public immutable owner;
    address public immutable vault;
    address public immutable paymaster;
    IEntryPoint private immutable _entryPoint;

    error NotEntryPoint();
    error InvalidDestination();
    error NativeValueForbidden();
    error InvalidCallData();

    constructor(IEntryPoint entryPoint_, address owner_, address vault_, address paymaster_) {
        require(owner_ != address(0) && vault_ != address(0) && paymaster_ != address(0), "zero address");
        _entryPoint = entryPoint_;
        owner = owner_;
        vault = vault_;
        paymaster = paymaster_;
    }

    receive() external payable {}

    function entryPoint() public view override returns (IEntryPoint) {
        return _entryPoint;
    }

    function execute(address dest, uint256 value, bytes calldata func) external {
        if (msg.sender != address(_entryPoint)) revert NotEntryPoint();
        if (dest != vault) revert InvalidDestination();
        if (value != 0) revert NativeValueForbidden();
        if (func.length < 4 || bytes4(func[:4]) != IRestrictedVault.executeSpend.selector) revert InvalidCallData();

        (bool success, bytes memory result) = dest.call(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        override
        returns (uint256)
    {
        if (userOp.paymasterAndData.length < 20 || address(bytes20(userOp.paymasterAndData[:20])) != paymaster) {
            return SIG_VALIDATION_FAILED;
        }
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, userOp.signature);
        return error == ECDSA.RecoverError.NoError && recovered == owner
            ? SIG_VALIDATION_SUCCESS
            : SIG_VALIDATION_FAILED;
    }

    /// @dev Never use account funds to prefund EntryPoint. Every operation must use the bound paymaster.
    function _payPrefund(uint256) internal pure override {}
}
