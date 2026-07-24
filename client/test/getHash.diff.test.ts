import {beforeAll, afterAll, describe, expect, test} from "vitest";
import {spawn, type ChildProcess} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
  toHex,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {paymasterGetHash} from "../src/getHash.js";
import {buildPaymasterAndData, toPacked, type UserOpFields} from "../src/userOp.js";

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
const FORK_URL = "https://rpc.bohr.life";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const CHAIN_ID = 968n;
// anvil default account #0 (well-known dev key, local fork only)
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
// throwaway verifyingSigner (TEST ONLY — prod key is a secret held by the signer service)
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const VAULT = "0x000000000000000000000000000000000000feed" as Address;

const artifactPath = fileURLToPath(
  new URL("../../out/BOTSpendPaymaster.sol/BOTSpendPaymaster.json", import.meta.url),
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const ABI = artifact.abi;
const BYTECODE: Hex = artifact.bytecode.object.startsWith("0x")
  ? artifact.bytecode.object
  : `0x${artifact.bytecode.object}`;

const deployer = privateKeyToAccount(DEPLOYER_KEY);
const signer = privateKeyToAccount(SIGNER_KEY);
const publicClient = createPublicClient({transport: http(RPC)});
const walletClient = createWalletClient({account: deployer, transport: http(RPC)});

let anvil: ChildProcess;
let paymaster: Address;

async function waitForRpc(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      await publicClient.getChainId();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error("anvil did not become ready");
}

beforeAll(async () => {
  const anvilBin = `${process.env.HOME}/.foundry/bin/anvil`;
  anvil = spawn(anvilBin, ["--fork-url", FORK_URL, "--port", String(PORT), "--silent"], {stdio: "ignore"});
  await waitForRpc();
  const hash = await walletClient.deployContract({
    abi: ABI,
    bytecode: BYTECODE,
    args: [ENTRYPOINT, signer.address, VAULT],
    chain: null,
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  paymaster = receipt.contractAddress!;
});

afterAll(() => {
  anvil?.kill("SIGKILL");
});

function randHex(bytes: number): Hex {
  let s = "0x";
  for (let i = 0; i < bytes * 2; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s as Hex;
}
const randAddr = (): Address => randHex(20);
const randU128 = (): bigint => BigInt(`0x${randHex(16).slice(2)}`);
const randU48 = (): number => Math.floor(Math.random() * 2 ** 47);

function mkOp(over: Partial<UserOpFields> = {}): UserOpFields {
  return {
    sender: "0x000000000000000000000000000000000000a011",
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

async function onchainGetHash(op: UserOpFields, vu: number, va: number): Promise<Hex> {
  const pmd = buildPaymasterAndData(paymaster, op.paymasterVerificationGasLimit, op.paymasterPostOpGasLimit, vu, va);
  const packed = toPacked(op, pmd);
  return (await publicClient.readContract({
    address: paymaster,
    abi: ABI,
    functionName: "getHash",
    args: [packed, vu, va],
  })) as Hex;
}

/// execute(VAULT, 0, executeSpend(...)) — the paymaster only checks dest==VAULT + outer selector.
function executeVaultCallData(): Hex {
  const inner = encodeFunctionData({
    abi: parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]),
    functionName: "executeSpend",
    args: [VAULT, randAddr(), 4_000_000n, "0x", zeroHash],
  });
  return encodeFunctionData({
    abi: parseAbi(["function execute(address,uint256,bytes)"]),
    functionName: "execute",
    args: [VAULT, 0n, inner],
  });
}

describe("B5a — off-chain getHash equivalence (fork of canonical EntryPoint on 968)", () => {
  test("tsGetHash === on-chain paymaster.getHash over sample + fuzzed UserOps", async () => {
    const samples: Array<{op: UserOpFields; vu: number; va: number}> = [
      {op: mkOp(), vu: 2_000_000, va: 0},
      {op: mkOp({initCode: "0xdeadbeef", callData: "0x1234", nonce: 42n}), vu: 999, va: 1},
      {op: mkOp({callData: executeVaultCallData(), nonce: 2n ** 200n}), vu: 4_000_000_000, va: 3},
      {op: mkOp({initCode: randHex(80), callData: randHex(300)}), vu: 123456, va: 0},
    ];
    for (let i = 0; i < 24; i++) {
      samples.push({
        op: mkOp({
          sender: randAddr(),
          nonce: BigInt(randHex(32)),
          initCode: randHex(Math.floor(Math.random() * 60)),
          callData: randHex(Math.floor(Math.random() * 260)),
          verificationGasLimit: randU128(),
          callGasLimit: randU128(),
          preVerificationGas: BigInt(randHex(32)),
          maxPriorityFeePerGas: randU128(),
          maxFeePerGas: randU128(),
          paymasterVerificationGasLimit: randU128(),
          paymasterPostOpGasLimit: randU128(),
        }),
        vu: randU48(),
        va: randU48(),
      });
    }

    for (const {op, vu, va} of samples) {
      const ts = paymasterGetHash(op, vu, va, paymaster, CHAIN_ID);
      const chain = await onchainGetHash(op, vu, va);
      expect(ts, `getHash mismatch for op ${op.sender}/${op.nonce}`).toBe(chain);
    }
  });

  test("sign(getHash) with throwaway key → validatePaymasterUserOp: sigFailed=false + empty context", async () => {
    const now = Math.floor(Date.now() / 1000);
    const vu = now + 300;
    const va = now - 60;
    const op = mkOp({callData: executeVaultCallData()});

    const digest = paymasterGetHash(op, vu, va, paymaster, CHAIN_ID);
    // paymaster does ECDSA.recover(toEthSignedMessageHash(getHash), sig) — sign the EIP-191 personal msg
    const signature = await signer.signMessage({message: {raw: digest}});

    const pmd = buildPaymasterAndData(
      paymaster,
      op.paymasterVerificationGasLimit,
      op.paymasterPostOpGasLimit,
      vu,
      va,
      signature,
    );
    const packed = toPacked(op, pmd);

    const {result} = await publicClient.simulateContract({
      address: paymaster,
      abi: ABI,
      functionName: "validatePaymasterUserOp",
      args: [packed, zeroHash, 0n],
      account: ENTRYPOINT, // eth_call from = EntryPoint satisfies _requireFromEntryPoint
    });
    const [context, validationData] = result as [Hex, bigint];

    const sigFailed = validationData & ((1n << 160n) - 1n);
    expect(sigFailed).toBe(0n); // 0 => sponsored
    expect(context).toBe("0x"); // empty context (EREP-050 sidestep)

    const packedValidUntil = (validationData >> 160n) & ((1n << 48n) - 1n);
    const packedValidAfter = (validationData >> 208n) & ((1n << 48n) - 1n);
    expect(packedValidUntil).toBe(BigInt(vu));
    expect(packedValidAfter).toBe(BigInt(va));
  });

  test("negative: same op signed by a WRONG key → SIG_VALIDATION_FAILED", async () => {
    const now = Math.floor(Date.now() / 1000);
    const vu = now + 300;
    const va = 0;
    const op = mkOp({callData: executeVaultCallData()});
    const digest = paymasterGetHash(op, vu, va, paymaster, CHAIN_ID);
    const wrong = privateKeyToAccount(`0x${"11".repeat(32)}` as Hex);
    const signature = await wrong.signMessage({message: {raw: digest}});
    const pmd = buildPaymasterAndData(paymaster, op.paymasterVerificationGasLimit, op.paymasterPostOpGasLimit, vu, va, signature);
    const {result} = await publicClient.simulateContract({
      address: paymaster,
      abi: ABI,
      functionName: "validatePaymasterUserOp",
      args: [toPacked(op, pmd), zeroHash, 0n],
      account: ENTRYPOINT,
    });
    const [, validationData] = result as [Hex, bigint];
    expect(validationData & ((1n << 160n) - 1n)).toBe(1n); // SIG_VALIDATION_FAILED
  });
});
