import type {Address, Hex} from "viem";

/** Unpacked v0.7 UserOperation as the bundler JSON-RPC expects (hex string fields). */
export type UnpackedUserOp = {
  sender: Address;
  nonce: Hex;
  factory?: Address;
  factoryData?: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymaster: Address;
  paymasterVerificationGasLimit: Hex;
  paymasterPostOpGasLimit: Hex;
  paymasterData: Hex;
  signature: Hex;
};

export type GasEstimate = {
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
};

export type UserOpReceiptRaw = {
  success?: boolean;
  logs?: {address: string; data: Hex; topics: [Hex, ...Hex[]]}[];
  receipt?: {transactionHash?: Hex; logs?: {address: string; data: Hex; topics: [Hex, ...Hex[]]}[]};
} | null;

/** Typed schema for the ERC-4337 bundler methods (avoids untyped request casts). */
export type BundlerRpcSchema = [
  {Method: "eth_sendUserOperation"; Parameters: [UnpackedUserOp, Address]; ReturnType: Hex},
  {Method: "eth_estimateUserOperationGas"; Parameters: [UnpackedUserOp, Address]; ReturnType: GasEstimate},
  {Method: "eth_getUserOperationReceipt"; Parameters: [Hex]; ReturnType: UserOpReceiptRaw},
  {Method: "skandha_getGasPrice"; Parameters: []; ReturnType: {maxFeePerGas: Hex; maxPriorityFeePerGas: Hex}},
];
