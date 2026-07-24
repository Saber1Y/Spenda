import {type Address, type Hex, concat, toHex, encodeAbiParameters, parseAbiParameters} from "viem";

/// Unpacked v0.7 UserOperation fields the client works with.
export interface UserOpFields {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  preVerificationGas: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
}

/// PackedUserOperation as the EntryPoint/paymaster ABI expects it.
export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

/// accountGasLimits = verificationGasLimit (high 128) || callGasLimit (low 128).
export const packAccountGasLimits = (verificationGasLimit: bigint, callGasLimit: bigint): Hex =>
  concat([toHex(verificationGasLimit, {size: 16}), toHex(callGasLimit, {size: 16})]);

/// gasFees = maxPriorityFeePerGas (high 128) || maxFeePerGas (low 128).
export const packGasFees = (maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex =>
  concat([toHex(maxPriorityFeePerGas, {size: 16}), toHex(maxFeePerGas, {size: 16})]);

/// paymasterAndData (v0.7): paymaster[20] || pmVerificationGasLimit[16] || pmPostOpGasLimit[16]
///   || abi.encode(validUntil, validAfter)[64] || signature.
export function buildPaymasterAndData(
  paymaster: Address,
  paymasterVerificationGasLimit: bigint,
  paymasterPostOpGasLimit: bigint,
  validUntil: number,
  validAfter: number,
  signature: Hex = "0x",
): Hex {
  const timestamps = encodeAbiParameters(parseAbiParameters("uint48, uint48"), [validUntil, validAfter]);
  return concat([
    paymaster,
    toHex(paymasterVerificationGasLimit, {size: 16}),
    toHex(paymasterPostOpGasLimit, {size: 16}),
    timestamps,
    signature,
  ]);
}

export function toPacked(op: UserOpFields, paymasterAndData: Hex, signature: Hex = "0x"): PackedUserOperation {
  return {
    sender: op.sender,
    nonce: op.nonce,
    initCode: op.initCode,
    callData: op.callData,
    accountGasLimits: packAccountGasLimits(op.verificationGasLimit, op.callGasLimit),
    preVerificationGas: op.preVerificationGas,
    gasFees: packGasFees(op.maxPriorityFeePerGas, op.maxFeePerGas),
    paymasterAndData,
    signature,
  };
}
