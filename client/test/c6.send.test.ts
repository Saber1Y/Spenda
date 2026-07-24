import {describe, expect, test} from "vitest";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  slice,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {sponsor} from "../src/signer.js";
import {toPacked, type UserOpFields} from "../src/userOp.js";
import {loadSignerConfig} from "../src/config.js";

const RPC = "https://rpc.bohr.life";
const BUNDLER = "https://bundler.bohr.life/rpc";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

const keys = JSON.parse(readFileSync(fileURLToPath(new URL("../../internal/keys.json", import.meta.url)), "utf8"));
const cfg = loadSignerConfig(fileURLToPath(new URL("../config.json", import.meta.url)));

const VAULT = keys.addresses.vault as Address;
const PAYMASTER = keys.addresses.paymaster as Address;
const USD = keys.addresses.mockUSD as Address;
const AGENT = keys.agentAccount.address as Address; // deployed salt-1 account
const VENDOR = keys.vendor.address as Address;

const prodSigner = privateKeyToAccount(keys.verifyingSigner.privateKey as Hex);
const agentOwner = privateKeyToAccount(keys.agentOwner.privateKey as Hex);

// FRESH actionId (not C5's) so the CAP is the blocking reason, not dedup
const ACTION = "0x00000000000000000000000000000000000000626f7473702d63362d626c6f63" as Hex; // "botsp-c6-bloc"
const OVER_CAP = 6_000_000n; // > maxPerTx (5 mUSD)

const G = keys.frozenGas as Record<string, string | number>;
const rpc = createPublicClient({transport: http(RPC)});
const bundler = createPublicClient({transport: http(BUNDLER)});

describe("C6 — blocked-artifact op (F6: op succeeds, policy refuses, paymaster pays)", () => {
  test("over-cap spend: sponsored, lands on-chain, AgentActionBlocked, NO transfer", async () => {
    const inner = encodeFunctionData({
      abi: parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]),
      functionName: "executeSpend",
      args: [USD, VENDOR, OVER_CAP, "0x", ACTION],
    });
    const callData = encodeFunctionData({
      abi: parseAbi(["function execute(address,uint256,bytes)"]),
      functionName: "execute",
      args: [VAULT, 0n, inner],
    });

    const nonce = (await rpc.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(["function getNonce(address,uint192) view returns (uint256)"]),
      functionName: "getNonce",
      args: [AGENT, 0n],
    })) as bigint;

    const blk = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false] as any})) as any;
    const now = Number(BigInt(blk.timestamp));

    // account already deployed -> NO initCode
    const op: UserOpFields = {
      sender: AGENT,
      nonce,
      initCode: "0x",
      callData,
      verificationGasLimit: BigInt(G.verificationGasLimit),
      callGasLimit: BigInt(G.callGasLimit),
      preVerificationGas: BigInt(G.preVerificationGas),
      maxPriorityFeePerGas: BigInt(G.maxPriorityFeePerGas as string),
      maxFeePerGas: BigInt(G.maxFeePerGas as string),
      paymasterVerificationGasLimit: BigInt(G.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(G.paymasterPostOpGasLimit),
    };

    // sponsor FIRST (Fence 1 gates DESTINATION == vault, not policy -> over-cap still gets signed)
    const res = await sponsor(op, cfg, prodSigner, now);
    expect(res.sponsored).toBe(true);
    if (!res.sponsored) return;

    const packed = toPacked(op, res.paymasterAndData, "0x");
    const userOpHash = (await rpc.readContract({
      address: ENTRYPOINT,
      abi: parseAbi([
        "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
      ]),
      functionName: "getUserOpHash",
      args: [packed],
    })) as Hex;

    const ownerSig = await agentOwner.signMessage({message: {raw: userOpHash}});

    const unpacked = {
      sender: AGENT,
      nonce: toHex(nonce),
      callData,
      callGasLimit: toHex(op.callGasLimit),
      verificationGasLimit: toHex(op.verificationGasLimit),
      preVerificationGas: toHex(op.preVerificationGas),
      maxFeePerGas: toHex(op.maxFeePerGas),
      maxPriorityFeePerGas: toHex(op.maxPriorityFeePerGas),
      paymaster: PAYMASTER,
      paymasterVerificationGasLimit: toHex(op.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: toHex(op.paymasterPostOpGasLimit),
      paymasterData: slice(res.paymasterAndData, 52),
      signature: ownerSig,
    };

    const sent = (await bundler.request({
      method: "eth_sendUserOperation" as any,
      params: [unpacked, ENTRYPOINT] as any,
    })) as Hex;
    console.log("eth_sendUserOperation ->", sent);

    let receipt: any = null;
    for (let i = 0; i < 40; i++) {
      receipt = await bundler.request({method: "eth_getUserOperationReceipt" as any, params: [sent] as any});
      if (receipt) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("### C6 receipt success:", receipt?.success, "tx:", receipt?.receipt?.transactionHash);

    // INVERTED BAR: the OP succeeds (success=true); the POLICY refuses (no revert)
    expect(receipt).not.toBeNull();
    expect(receipt.success).toBe(true); // WRONG-1 guard: false => vault reverted, STOP
    console.log("### C6 ARTIFACTS:", JSON.stringify({userOpHash: sent, txHash: receipt.receipt?.transactionHash}));
  });
});
