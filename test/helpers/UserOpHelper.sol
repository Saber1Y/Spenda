// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SimpleAccount} from "@account-abstraction/contracts/samples/SimpleAccount.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {BOTSpendPaymaster} from "../../src/BOTSpendPaymaster.sol";
import {BOTSpendVault} from "../../src/BOTSpendVault.sol";

/// @notice Shared v0.7 UserOperation builder/signer used by both the hermetic paymaster tests
///         (fresh EntryPoint) and the fork tests (canonical EntryPoint on 968). Concrete tests set
///         `entryPoint` and `paymaster` in their setUp.
abstract contract UserOpHelper is Test {
    IEntryPoint internal entryPoint;
    BOTSpendPaymaster internal paymaster;

    uint128 internal constant VGL = 600_000;
    uint128 internal constant CGL = 600_000;
    uint256 internal constant PVG = 100_000;
    uint128 internal constant PM_VGL = 300_000;
    uint128 internal constant PM_PGL = 100_000;
    uint128 internal constant MAXFEE = 1 gwei;

    struct Op {
        address sender;
        bytes callData;
        uint48 validUntil;
        uint48 validAfter;
    }

    /// callData = SimpleAccount.execute(vault, 0, vault.executeSpend(token, target, amount, "", actionId))
    function _executeVaultCallData(address vault_, address token, address target, uint256 amount, bytes32 actionId)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory inner = abi.encodeCall(BOTSpendVault.executeSpend, (token, target, amount, "", actionId));
        return abi.encodeCall(SimpleAccount.execute, (vault_, 0, inner));
    }

    /// Build a UserOp and attach a paymaster sponsorship signature from `pmSignerPk`.
    function _buildWithPaymasterSig(Op memory o, uint256 pmSignerPk)
        internal
        view
        returns (PackedUserOperation memory op)
    {
        op.sender = o.sender;
        op.nonce = entryPoint.getNonce(o.sender, 0);
        op.initCode = "";
        op.callData = o.callData;
        op.accountGasLimits = bytes32((uint256(VGL) << 128) | uint256(CGL));
        op.preVerificationGas = PVG;
        op.gasFees = bytes32((uint256(MAXFEE) << 128) | uint256(MAXFEE));

        bytes memory pmdNoSig =
            abi.encodePacked(address(paymaster), PM_VGL, PM_PGL, abi.encode(o.validUntil, o.validAfter));
        op.paymasterAndData = pmdNoSig;

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(paymaster.getHash(op, o.validUntil, o.validAfter));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pmSignerPk, digest);
        op.paymasterAndData = abi.encodePacked(pmdNoSig, abi.encodePacked(r, s, v));
    }

    function _addOwnerSig(PackedUserOperation memory op, uint256 ownerPk) internal view {
        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, MessageHashUtils.toEthSignedMessageHash(userOpHash));
        op.signature = abi.encodePacked(r, s, v);
    }

    function _validate(PackedUserOperation memory op) internal returns (bytes memory context, uint256 validationData) {
        vm.prank(address(entryPoint));
        (context, validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    // validationData = aggregator[160] | validUntil[48] | validAfter[48]
    function _agg(uint256 vd) internal pure returns (uint256) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint160(vd);
    }

    function _validUntil(uint256 vd) internal pure returns (uint48) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint48(vd >> 160);
    }

    function _validAfter(uint256 vd) internal pure returns (uint48) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint48(vd >> 208);
    }

    function _sigFailed(uint256 vd) internal pure returns (bool) {
        return _agg(vd) == 1;
    }
}
