// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BasePaymaster} from "@account-abstraction/contracts/core/BasePaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {UserOperationLib} from "@account-abstraction/contracts/core/UserOperationLib.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ISimpleAccountExecute {
    function execute(address dest, uint256 value, bytes calldata func) external;
}

/// @title BOTSpendPaymaster
/// @notice Fence 1 (gas layer). A verifying paymaster that sponsors a UserOp only if BOTH:
///         (1) an off-chain `verifyingSigner` authorized it (ECDSA over the UserOp, bound to
///             callData), and (2) the UserOp's callData is `SimpleAccount.execute(dest = vault, …)`.
///         An off-policy UserOp gets no sponsorship → a zero-gas agent account can't broadcast it.
/// @dev The on-chain validation path reads ONLY immutables (`verifyingSigner`, `vault`) and
///      calldata, does an ECDSA recover (ecrecover precompile), and returns an EMPTY context. It
///      performs NO SLOAD/SSTORE, no external calls, no BALANCE/blockish opcodes — so it stays
///      ERC-7562 stake-exempt (see internal threat model, invariant on the storage-free paymaster)
///      and needs only a funded EntryPoint deposit, not stake.
///
///      Division of labor (the seam): this contract gates the DESTINATION (dest == vault) on-chain
///      as defense-in-depth; the off-chain signer additionally enforces the registered-sender set
///      and (optionally) the inner `executeSpend` selector. Spend policy (caps/allowlists/dedup) is
///      Fence 2, enforced by the vault. Sponsorship signatures use a short validity window
///      (validUntil/validAfter) — the sponsorship-replay layer, distinct from EntryPoint nonce and
///      vault actionId. Because the signer is immutable, rotating it means deploying a new paymaster.
///
///      Provenance: the eth-infinitism VerifyingPaymaster @ v0.7.0 is a sealed leaf — its
///      `_validatePaymasterUserOp` and BasePaymaster's external `validatePaymasterUserOp` are both
///      non-virtual, and its VALID_TIMESTAMP_OFFSET/SIGNATURE_OFFSET constants are private, so it
///      cannot be inherited-and-extended. We therefore extend BasePaymaster (whose
///      `_validatePaymasterUserOp` IS virtual) and reproduce the reference's `getHash`,
///      `parsePaymasterAndData`, and offset formula VERBATIM (byte-identical), adding only the
///      immutable-vault destination gate. Result is behaviorally "reference + gate".
contract BOTSpendPaymaster is BasePaymaster {
    using UserOperationLib for PackedUserOperation;

    /// @notice Off-chain sponsorship signer (the policy authority). Immutable → no storage read.
    address public immutable verifyingSigner;
    /// @notice The only destination this paymaster will ever sponsor calls into. Immutable.
    address public immutable VAULT;

    bytes4 private constant EXECUTE_SELECTOR = ISimpleAccountExecute.execute.selector; // 0xb61d27f6

    // paymasterAndData layout (v0.7): [0:20] paymaster · [20:36] verificationGasLimit ·
    //   [36:52] postOpGasLimit · [52:116] abi.encode(validUntil, validAfter) · [116:] signature.
    // PAYMASTER_VALIDATION_GAS_OFFSET (20) and PAYMASTER_DATA_OFFSET (52) are inherited from
    // BasePaymaster; SIGNATURE_OFFSET mirrors the reference's `VALID_TIMESTAMP_OFFSET + 64`.
    uint256 private constant SIGNATURE_OFFSET = PAYMASTER_DATA_OFFSET + 64;

    constructor(IEntryPoint _entryPoint, address _verifyingSigner, address _vault) BasePaymaster(_entryPoint) {
        verifyingSigner = _verifyingSigner;
        VAULT = _vault;
    }

    /// @notice The digest the off-chain signer signs and the contract re-derives on-chain.
    ///         Commits to `keccak256(userOp.callData)`, so the sponsorship is bound to the exact
    ///         call (a signature cannot be replayed against a UserOp with different calldata).
    /// @dev Reproduced VERBATIM (field set + order) from account-abstraction
    ///      `contracts/samples/VerifyingPaymaster.sol` @ tag v0.7.0 (commit 7af70c8), L42-66.
    ///      Differential-fuzzed against the reference in test/GetHashDifferential.t.sol.
    function getHash(PackedUserOperation calldata userOp, uint48 validUntil, uint48 validAfter)
        public
        view
        returns (bytes32)
    {
        address sender = userOp.getSender();
        return keccak256(
            abi.encode(
                sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                uint256(bytes32(userOp.paymasterAndData[PAYMASTER_VALIDATION_GAS_OFFSET:PAYMASTER_DATA_OFFSET])),
                userOp.preVerificationGas,
                userOp.gasFees,
                block.chainid,
                address(this),
                validUntil,
                validAfter
            )
        );
    }

    function _validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32, uint256)
        internal
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        (uint48 validUntil, uint48 validAfter, bytes calldata signature) =
            parsePaymasterAndData(userOp.paymasterAndData);
        require(signature.length == 64 || signature.length == 65, "BOTSpendPaymaster: invalid signature length");

        // Fence 1 destination gate (immutable + calldata only; no storage read).
        if (!_targetsVault(userOp.callData)) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter));
        if (verifyingSigner != ECDSA.recover(hash, signature)) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }
        return ("", _packValidationData(false, validUntil, validAfter));
    }

    /// @dev True iff callData is `execute(dest, …)` with dest == VAULT. The `dest` head word is at
    ///      calldata[4:36] regardless of the trailing `bytes func` offset, so this is robust.
    function _targetsVault(bytes calldata callData) internal view returns (bool) {
        if (callData.length < 36) return false;
        if (bytes4(callData[0:4]) != EXECUTE_SELECTOR) return false;
        address dest = address(uint160(uint256(bytes32(callData[4:36]))));
        return dest == VAULT;
    }

    /// @dev Reproduced VERBATIM from account-abstraction `VerifyingPaymaster.sol` @ v0.7.0
    ///      (commit 7af70c8), L92-95; offset formula from L27-29 (SIGNATURE_OFFSET = 52 + 64).
    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        (validUntil, validAfter) = abi.decode(paymasterAndData[PAYMASTER_DATA_OFFSET:], (uint48, uint48));
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }
}
