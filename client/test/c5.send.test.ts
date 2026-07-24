import {describe, expect, test} from "vitest";
import {
  createPublicClient,
  http,
  concat,
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

const keysPath = fileURLToPath(new URL("../../internal/keys.json", import.meta.url));
const keys = JSON.parse(readFileSync(keysPath, "utf8"));
const cfg = loadSignerConfig(fileURLToPath(new URL("../config.json", import.meta.url)));

const FACTORY = keys.addresses.factory as Address;
const VAULT = keys.addresses.vault as Address;
const PAYMASTER = keys.addresses.paymaster as Address;
const USD = keys.addresses.mockUSD as Address;
const AGENT = keys.agentAccount.address as Address;
const OWNER_EOA = keys.agentOwner.address as Address;
const SALT = BigInt(keys.agentAccount.salt);
const VENDOR = keys.vendor.address as Address;

const prodSigner = privateKeyToAccount(keys.verifyingSigner.privateKey as Hex);
const agentOwner = privateKeyToAccount(keys.agentOwner.privateKey as Hex);

// same actionId used in the C3 estimate (estimation didn't execute -> still unused/fresh)
const ACTION = "0x0000000000000000000000000000000000000000626f7473702d617070726f76" as Hex;
const SPEND = 4_000_000n; // 4 mUSD (<= maxPerTx 5 mUSD)

// FROZEN gas from C3
const G = keys.frozenGas as Record<string, string | number>;

const rpc = createPublicClient({transport: http(RPC)});
const bundler = createPublicClient({transport: http(BUNDLER)});

describe("C5 — headline sponsored UserOp on live 968", () => {
  test("gasless approved spend: account deploys+executes, paymaster pays, invariants hold", async () => {
    const factoryData = encodeFunctionData({
      abi: parseAbi(["function createAccount(address,uint256) returns (address)"]),
      functionName: "createAccount",
      args: [OWNER_EOA, SALT],
    });
    const initCode = concat([FACTORY, factoryData]);
    const inner = encodeFunctionData({
      abi: parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]),
      functionName: "executeSpend",
      args: [USD, VENDOR, SPEND, "0x", ACTION],
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

    // chain block.timestamp (raw request -> no viem block formatter, avoids feePayer/milliTimestamp)
    const blk = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false] as any})) as any;
    const now = Number(BigInt(blk.timestamp));

    // ---- 1. assemble op with FROZEN gas (no field changes after this) ----
    const op: UserOpFields = {
      sender: AGENT,
      nonce,
      initCode,
      callData,
      verificationGasLimit: BigInt(G.verificationGasLimit),
      callGasLimit: BigInt(G.callGasLimit),
      preVerificationGas: BigInt(G.preVerificationGas),
      maxPriorityFeePerGas: BigInt(G.maxPriorityFeePerGas as string),
      maxFeePerGas: BigInt(G.maxFeePerGas as string),
      paymasterVerificationGasLimit: BigInt(G.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(G.paymasterPostOpGasLimit),
    };

    // ---- 2. SPONSOR FIRST: prod signer signs the PAYMASTER getHash ----
    const res = await sponsor(op, cfg, prodSigner, now);
    expect(res.sponsored).toBe(true);
    if (!res.sponsored) return;
    console.log("sponsored:", {validAfter: res.validAfter, validUntil: res.validUntil, now});

    // ---- 3. userOpHash over the now-complete op (incl paymasterAndData) ----
    const packed = toPacked(op, res.paymasterAndData, "0x");
    const userOpHash = (await rpc.readContract({
      address: ENTRYPOINT,
      abi: parseAbi([
        "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
      ]),
      functionName: "getUserOpHash",
      args: [packed],
    })) as Hex;

    // ---- 4. owner-sign the userOpHash (distinct digest/key from the sponsor sig) ----
    const ownerSig = await agentOwner.signMessage({message: {raw: userOpHash}});

    // ---- 5. eth_sendUserOperation (unpacked v0.7 format) ----
    const unpacked = {
      sender: AGENT,
      nonce: toHex(nonce),
      factory: FACTORY,
      factoryData,
      callData,
      callGasLimit: toHex(op.callGasLimit),
      verificationGasLimit: toHex(op.verificationGasLimit),
      preVerificationGas: toHex(op.preVerificationGas),
      maxFeePerGas: toHex(op.maxFeePerGas),
      maxPriorityFeePerGas: toHex(op.maxPriorityFeePerGas),
      paymaster: PAYMASTER,
      paymasterVerificationGasLimit: toHex(op.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: toHex(op.paymasterPostOpGasLimit),
      paymasterData: slice(res.paymasterAndData, 52), // encode(validUntil,validAfter) ++ signerSig
      signature: ownerSig,
    };

    const sent = (await bundler.request({
      method: "eth_sendUserOperation" as any,
      params: [unpacked, ENTRYPOINT] as any,
    })) as Hex;
    console.log("eth_sendUserOperation ->", sent);
    console.log("computed userOpHash   ->", userOpHash);

    // ---- 6. poll eth_getUserOperationReceipt (raw request -> no receipt formatter) ----
    let receipt: any = null;
    for (let i = 0; i < 40; i++) {
      receipt = await bundler.request({method: "eth_getUserOperationReceipt" as any, params: [sent] as any});
      if (receipt) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("=== eth_getUserOperationReceipt ===");
    console.log(JSON.stringify(receipt, null, 2));

    expect(receipt).not.toBeNull();
    expect(receipt.success).toBe(true);

    // persist artifacts for the report
    const out = {
      userOpHash: sent,
      txHash: receipt.receipt?.transactionHash,
      success: receipt.success,
      actualGasCost: receipt.actualGasCost,
    };
    console.log("### C5 ARTIFACTS:", JSON.stringify(out));
  });
});
