import {type Address, type Hex, concat, encodeFunctionData, getAddress, parseAbi} from "viem";
import type {UserOpFields} from "../src/userOp.js";

export const REGISTERED_SENDER: Address = getAddress("0x000000000000000000000000000000000000a011");

export function mkOp(over: Partial<UserOpFields> = {}): UserOpFields {
  return {
    sender: REGISTERED_SENDER,
    nonce: 0n,
    initCode: "0x",
    callData: "0x",
    verificationGasLimit: 600_000n,
    callGasLimit: 600_000n,
    preVerificationGas: 100_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    maxFeePerGas: 1_000_000_000n,
    paymasterVerificationGasLimit: 300_000n,
    paymasterPostOpGasLimit: 100_000n,
    ...over,
  };
}

/// SimpleAccount.execute(vault, 0, vault.executeSpend(token, target, amount, "", actionId))
export function executeSpendCallData(
  vault: Address,
  token: Address,
  target: Address,
  amount: bigint,
  actionId: Hex,
): Hex {
  const inner = encodeFunctionData({
    abi: parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]),
    functionName: "executeSpend",
    args: [token, target, amount, "0x", actionId],
  });
  return encodeFunctionData({
    abi: parseAbi(["function execute(address,uint256,bytes)"]),
    functionName: "execute",
    args: [vault, 0n, inner],
  });
}

/// Minimal execute(dest, 0, "") — used to exercise the destination gate.
export function executeToDest(dest: Address): Hex {
  return encodeFunctionData({
    abi: parseAbi(["function execute(address,uint256,bytes)"]),
    functionName: "execute",
    args: [dest, 0n, "0x"],
  });
}

/// execute-selector + a 32-byte dest word whose UPPER 12 bytes are dirty but low 20 == vault.
/// The on-chain gate masks to low 20 bytes (uint160), so this must be accepted — tests the mirror.
export function dirtyUpperDestCallData(vault: Address): Hex {
  const word = `0x${"de".repeat(12)}${vault.toLowerCase().slice(2)}` as Hex; // 12 dirty + 20 addr = 32 bytes
  return concat(["0xb61d27f6", word]);
}
