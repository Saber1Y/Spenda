import {afterAll, beforeAll, describe, expect, test} from "vitest";
import {spawn, type ChildProcess} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  pad,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {sponsor, type SignerConfig} from "../src/signer.js";
import {toPacked} from "../src/userOp.js";
import {mkOp, executeSpendCallData} from "./opFixtures.js";

const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
const FORK_URL = "https://rpc.bohr.life";
const ENTRYPOINT = getAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
const CHAIN_ID = 968n;
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex; // anvil #0
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex; // throwaway
const AGENT_OWNER_KEY = `0x${"a11ce".padStart(64, "0")}` as Hex; // throwaway account owner
const VENDOR = getAddress(pad("0x0b0b", {size: 20}));
const BENEFICIARY = getAddress(pad("0xbeef", {size: 20}));
const SPEND = 4_000_000n;

function loadArtifact(name: string): {abi: Abi; bytecode: Hex} {
  const p = fileURLToPath(new URL(`../../out/${name}.sol/${name}.json`, import.meta.url));
  const a = JSON.parse(readFileSync(p, "utf8"));
  const bc = a.bytecode.object as string;
  return {abi: a.abi as Abi, bytecode: (bc.startsWith("0x") ? bc : `0x${bc}`) as Hex};
}

const deployer = privateKeyToAccount(DEPLOYER_KEY);
const signer = privateKeyToAccount(SIGNER_KEY);
const agentOwner = privateKeyToAccount(AGENT_OWNER_KEY);
const publicClient = createPublicClient({transport: http(RPC)});
const walletClient = createWalletClient({account: deployer, transport: http(RPC)});

const PUO =
  "(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)";
const entryPointAbi = parseAbi([
  "function getNonce(address,uint192) view returns (uint256)",
  `function getUserOpHash(${PUO} userOp) view returns (bytes32)`,
  "function balanceOf(address) view returns (uint256)",
  `function handleOps(${PUO}[] ops, address beneficiary)`,
]);

let anvil: ChildProcess;
let vault: Address;
let usd: Address;
let factory: Address;
let paymaster: Address;
let account: Address;

async function waitForRpc(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      await publicClient.getChainId();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error("anvil not ready");
}

async function deploy(name: string, args: unknown[]): Promise<Address> {
  const {abi, bytecode} = loadArtifact(name);
  const hash = await walletClient.deployContract({abi, bytecode, args, chain: null});
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  return receipt.contractAddress!;
}

async function write(address: Address, abi: Abi, functionName: string, args: unknown[], value?: bigint): Promise<void> {
  const hash = await walletClient.writeContract({address, abi, functionName, args, chain: null, value});
  await publicClient.waitForTransactionReceipt({hash});
}

beforeAll(async () => {
  anvil = spawn(`${process.env.HOME}/.foundry/bin/anvil`, ["--fork-url", FORK_URL, "--port", String(PORT), "--silent"], {
    stdio: "ignore",
  });
  await waitForRpc();

  const vaultArt = loadArtifact("BOTSpendVault");
  const usdArt = loadArtifact("MockUSD");
  const factoryArt = loadArtifact("SimpleAccountFactory");

  usd = await deploy("MockUSD", []);
  vault = await deploy("BOTSpendVault", [deployer.address]);
  factory = await deploy("SimpleAccountFactory", [ENTRYPOINT]);
  paymaster = await deploy("BOTSpendPaymaster", [ENTRYPOINT, signer.address, vault]);

  // counterfactual account address, then deploy it
  account = (await publicClient.readContract({
    address: factory,
    abi: factoryArt.abi,
    functionName: "getAddress",
    args: [agentOwner.address, 0n],
  })) as Address;
  await write(factory, factoryArt.abi, "createAccount", [agentOwner.address, 0n]);

  // wire vault for the SimpleAccount ADDRESS
  const now = Number((await publicClient.getBlock()).timestamp);
  await write(vault, vaultArt.abi, "setAgentPolicy", [account, 5_000_000n, 20_000_000n, BigInt(now + 30 * 86400), true]);
  await write(vault, vaultArt.abi, "setAllowedTarget", [account, VENDOR, true]);
  await write(vault, vaultArt.abi, "setAllowedToken", [account, usd, true]);
  await write(usd, usdArt.abi, "mint", [vault, 1_000_000_000n]);

  // fund paymaster deposit (deposit-only, no stake)
  const pmArt = loadArtifact("BOTSpendPaymaster");
  await write(paymaster, pmArt.abi, "deposit", [], 1_000_000_000_000_000_000n);
});

afterAll(() => {
  anvil?.kill("SIGKILL");
});

describe("B5b — ALLOWED end-to-end (signer sig -> real EntryPoint.handleOps on 968 fork)", () => {
  test("sponsored UserOp: agent at 0 balance completes approved executeSpend, paymaster deposit pays", async () => {
    const usdArt = loadArtifact("MockUSD");
    const pmArt = loadArtifact("BOTSpendPaymaster");

    const now = Number((await publicClient.getBlock()).timestamp);
    const nonce = (await publicClient.readContract({
      address: ENTRYPOINT,
      abi: entryPointAbi,
      functionName: "getNonce",
      args: [account, 0n],
    })) as bigint;

    const op = mkOp({
      sender: account,
      nonce,
      callData: executeSpendCallData(vault, usd, VENDOR, SPEND, pad("0x01", {size: 32})),
    });

    const cfg: SignerConfig = {chainId: CHAIN_ID, paymaster, vault, registeredSenders: [account]};
    const res = await sponsor(op, cfg, signer, now);
    expect(res.sponsored).toBe(true);
    if (!res.sponsored) return;

    // account-owner signs the EntryPoint userOpHash (the OTHER, distinct digest)
    let packed = toPacked(op, res.paymasterAndData, "0x");
    const userOpHash = (await publicClient.readContract({
      address: ENTRYPOINT,
      abi: entryPointAbi,
      functionName: "getUserOpHash",
      args: [packed],
    })) as Hex;
    const ownerSig = await agentOwner.signMessage({message: {raw: userOpHash}});
    packed = {...packed, signature: ownerSig};

    const balBefore = 0n;
    const depositBefore = (await publicClient.readContract({
      address: paymaster,
      abi: pmArt.abi,
      functionName: "getDeposit",
    })) as bigint;

    const hash = await walletClient.writeContract({
      address: ENTRYPOINT,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[packed], BENEFICIARY],
      chain: null,
    });
    const receipt = await publicClient.waitForTransactionReceipt({hash});
    expect(receipt.status).toBe("success");

    const vendorBal = (await publicClient.readContract({
      address: usd,
      abi: usdArt.abi,
      functionName: "balanceOf",
      args: [VENDOR],
    })) as bigint;
    const depositAfter = (await publicClient.readContract({
      address: paymaster,
      abi: pmArt.abi,
      functionName: "getDeposit",
    })) as bigint;
    const accountNative = await publicClient.getBalance({address: account});
    const accountDeposit = (await publicClient.readContract({
      address: ENTRYPOINT,
      abi: entryPointAbi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
    const beneficiaryBal = await publicClient.getBalance({address: BENEFICIARY});

    expect(vendorBal).toBe(SPEND); // vault executed the approved spend
    expect(depositAfter).toBeLessThan(depositBefore); // paymaster deposit paid the gas
    expect(accountNative).toBe(balBefore); // agent account still holds 0 native
    expect(accountDeposit).toBe(0n); // and 0 EntryPoint deposit (invariant 2)
    expect(beneficiaryBal).toBeGreaterThan(0n); // bundler beneficiary was paid
  });
});
