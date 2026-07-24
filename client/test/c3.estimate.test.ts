import {describe, expect, test} from "vitest";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbi,
  parseAbiParameters,
  concat,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const RPC = "https://rpc.bohr.life";
const BUNDLER = "https://bundler.bohr.life/rpc";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

const keys = JSON.parse(readFileSync(fileURLToPath(new URL("../../internal/keys.json", import.meta.url)), "utf8"));
const FACTORY = keys.addresses.factory as Address;
const VAULT = keys.addresses.vault as Address;
const PAYMASTER = keys.addresses.paymaster as Address;
const USD = keys.addresses.mockUSD as Address;
const AGENT = keys.agentAccount.address as Address;
const OWNER = keys.agentOwner.address as Address;
const VENDOR = keys.vendor.address as Address;

const ACTION_APPROVED = "0x0000000000000000000000000000000000000000626f7473702d617070726f76" as Hex; // "botsp-approv"

const rpc = createPublicClient({transport: http(RPC)});
const bundler = createPublicClient({transport: http(BUNDLER)});

function executeSpendCall(): Hex {
  const inner = encodeFunctionData({
    abi: parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]),
    functionName: "executeSpend",
    args: [USD, VENDOR, 4_000_000n, "0x", ACTION_APPROVED],
  });
  return encodeFunctionData({
    abi: parseAbi(["function execute(address,uint256,bytes)"]),
    functionName: "execute",
    args: [VAULT, 0n, inner],
  });
}

describe("C3 — live simulation gate (eth_estimateUserOperationGas on Skandha)", () => {
  test("estimate first UserOp (initCode present, dummy sigs)", async () => {
    // structurally-valid dummy sig: a real ECDSA sig from a throwaway key over a fixed hash.
    // Recovers to a valid-but-WRONG address -> SIG_VALIDATION_FAILED (not an ECDSA revert).
    const DUMMY_SIG = await privateKeyToAccount(`0x${"01".repeat(32)}`).sign({
      hash: `0x${"00".repeat(32)}` as Hex,
    });

    // nonce for the (undeployed) account
    const nonce = (await rpc.readContract({
      address: ENTRYPOINT,
      abi: parseAbi(["function getNonce(address,uint192) view returns (uint256)"]),
      functionName: "getNonce",
      args: [AGENT, 0n],
    })) as bigint;

    const factoryData = encodeFunctionData({
      abi: parseAbi(["function createAccount(address,uint256) returns (address)"]),
      functionName: "createAccount",
      args: [OWNER, 0n],
    });

    const now = Math.floor(Date.now() / 1000);
    const paymasterData = concat([
      encodeAbiParameters(parseAbiParameters("uint48, uint48"), [now + 300, now - 60]),
      DUMMY_SIG,
    ]);

    // live gas price
    const gp = (await bundler.request({method: "skandha_getGasPrice" as any, params: [] as any})) as any;
    const maxFee = gp.maxFeePerGas as Hex;
    const maxPrio = gp.maxPriorityFeePerGas as Hex;

    const userOp = {
      sender: AGENT,
      nonce: toHex(nonce),
      factory: FACTORY,
      factoryData,
      callData: executeSpendCall(),
      callGasLimit: toHex(500_000),
      verificationGasLimit: toHex(1_500_000),
      preVerificationGas: toHex(100_000),
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio,
      paymaster: PAYMASTER,
      paymasterVerificationGasLimit: toHex(300_000),
      paymasterPostOpGasLimit: toHex(100_000),
      paymasterData,
      signature: DUMMY_SIG,
    };

    console.log("=== UserOp (unpacked) ===");
    console.log(JSON.stringify(userOp, null, 2));

    let outcome: string;
    let raw: unknown;
    try {
      raw = await bundler.request({
        method: "eth_estimateUserOperationGas" as any,
        params: [userOp, ENTRYPOINT] as any,
      });
      outcome = "C_SUCCESS";
      console.log("=== OUTCOME C — estimate SUCCEEDED ===");
      console.log(JSON.stringify(raw, null, 2));
    } catch (e: any) {
      raw = {message: e?.message ?? String(e), details: e?.details, cause: e?.cause?.message};
      const msg = (e?.message ?? String(e)).toLowerCase();
      if (msg.includes("feepayer") || msg.includes("millitimestamp") || msg.includes("timestampmillis") || msg.includes("deserial")) {
        outcome = "A_VIEM_PARSE";
      } else if (/aa2[0-9]|aa3[0-9]|signature/.test(msg) && !/opcode|storage|stake|staked|op-\d|sto-\d|erep/.test(msg)) {
        outcome = "SIG_TOLERATED_TRACER_PASSED";
      } else if (/opcode|storage|stake|staked|op-\d|sto-\d|erep|banned|throttl/.test(msg)) {
        outcome = "B_TRACER_REJECTION";
      } else {
        outcome = "OTHER";
      }
      console.log(`=== OUTCOME ${outcome} — estimate errored ===`);
      console.log(JSON.stringify(raw, null, 2));
    }

    console.log("### CLASSIFIED OUTCOME:", outcome);
    // don't fail the test — this is a probe; the classification is the deliverable
    expect(outcome).toBeDefined();
  });
});
