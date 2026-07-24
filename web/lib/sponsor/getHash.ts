import {type Address, type Hex, keccak256, encodeAbiParameters, parseAbiParameters} from "viem";
import {packAccountGasLimits, packGasFees, type UserOpFields} from "./userOp.js";

/**
 * TypeScript reimplementation of `SpendaPaymaster.getHash`, which is itself reproduced VERBATIM
 * from eth-infinitism `VerifyingPaymaster.sol` @ v0.7.0 (commit 7af70c8), L42-66.
 *
 * MUST be byte-identical to the on-chain getHash — any divergence means the recovered signer never
 * equals `verifyingSigner`, so every op is refused (zero sponsorships). Proven by the differential
 * test against the deployed contract.
 *
 * Field set + order (abi.encode):
 *   sender(address), nonce(uint256), keccak256(initCode)(bytes32), keccak256(callData)(bytes32),
 *   accountGasLimits(bytes32), paymasterGasLimits(uint256 = paymasterAndData[20:52]),
 *   preVerificationGas(uint256), gasFees(bytes32), chainId(uint256), paymaster(address),
 *   validUntil(uint48), validAfter(uint48).
 *
 * Excluded from the hash (by design): the paymaster-address bytes [0:20] and the signature bytes
 * [116:] of paymasterAndData — only the gas-limit slice [20:52] is included.
 */
export function paymasterGetHash(
  op: UserOpFields,
  validUntil: number,
  validAfter: number,
  paymaster: Address,
  chainId: bigint,
): Hex {
  // uint256(bytes32(paymasterAndData[20:52])) == pmVerificationGasLimit<<128 | pmPostOpGasLimit
  const paymasterGasLimits = (op.paymasterVerificationGasLimit << 128n) | op.paymasterPostOpGasLimit;

  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "address, uint256, bytes32, bytes32, bytes32, uint256, uint256, bytes32, uint256, address, uint48, uint48",
    ),
    [
      op.sender,
      op.nonce,
      keccak256(op.initCode),
      keccak256(op.callData),
      packAccountGasLimits(op.verificationGasLimit, op.callGasLimit),
      paymasterGasLimits,
      op.preVerificationGas,
      packGasFees(op.maxPriorityFeePerGas, op.maxFeePerGas),
      chainId,
      paymaster,
      validUntil,
      validAfter,
    ],
  );
  return keccak256(encoded);
}
