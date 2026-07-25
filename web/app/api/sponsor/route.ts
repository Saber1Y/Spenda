import {NextResponse, type NextRequest} from "next/server";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
  concat,
  slice,
  toHex,
  toBytes,
  keccak256,
  rpcSchema,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {sponsor, type SignerConfig} from "@/lib/sponsor/signer";
import {toPacked, type UserOpFields} from "@/lib/sponsor/userOp";
import {CONTRACTS, DEMO} from "@/lib/contracts";
import type {BundlerRpcSchema, UnpackedUserOp} from "@/lib/bundlerSchema";

export const runtime = "nodejs"; // never edge — needs process.env secrets + node crypto
export const dynamic = "force-dynamic";

const RPC = "https://rpc.bohr.life";
const BUNDLER = "https://bundler.bohr.life/rpc";
const EP = CONTRACTS.entryPoint as Address;
const CHAIN_ID = 968n;

// Frozen-gas floors (the C5 callGasLimit-bug lesson: Skandha's per-op breakdown is unreliable, so
// we floor every estimate at proven minimums). Account is already deployed → no initCode.
const FLOOR_CGL = 250_000n;
const FLOOR_VGL = 200_000n;
const FLOOR_PVG = 60_000n;
const PM_VGL = 300_000n;
const PM_PGL = 100_000n;
const MAX_AMOUNT = 100_000_000n; // 100 mUSD sane ceiling

const rpc = createPublicClient({transport: http(RPC)});
const bundler = createPublicClient({transport: http(BUNDLER), rpcSchema: rpcSchema<BundlerRpcSchema>()});

// ---- server-only keys (NEVER NEXT_PUBLIC_, never returned to the client) ----
function loadKeys(): {signerKey?: Hex; ownerKey?: Hex; configured: boolean} {
  const signerKey = process.env.VERIFYING_SIGNER_KEY as Hex | undefined;
  const ownerKey = process.env.AGENT_OWNER_KEY as Hex | undefined;
  return {signerKey, ownerKey, configured: !!signerKey && !!ownerKey};
}

// ---- in-memory rate limit: token bucket + min gap (spam can't drain the paymaster deposit) ----
const RL = {tokens: 8, max: 8, refillMs: 60_000, lastRefill: Date.now(), lastRunAt: 0, minGapMs: 4000};
function rateLimit(): {ok: boolean; retryAfter?: number} {
  const now = Date.now();
  RL.tokens = Math.min(RL.max, RL.tokens + ((now - RL.lastRefill) / RL.refillMs) * RL.max);
  RL.lastRefill = now;
  if (now - RL.lastRunAt < RL.minGapMs) return {ok: false, retryAfter: Math.ceil((RL.minGapMs - (now - RL.lastRunAt)) / 1000)};
  if (RL.tokens < 1) return {ok: false, retryAfter: Math.ceil(RL.refillMs / 1000)};
  RL.tokens -= 1;
  RL.lastRunAt = now;
  return {ok: true};
}

function parseAmount(v: unknown): bigint | null {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? BigInt(v) : null;
  if (typeof v === "string" && /^[0-9]+$/.test(v)) {
    const b = BigInt(v);
    return b > 0n ? b : null;
  }
  return null;
}

const executeAbi = parseAbi(["function execute(address,uint256,bytes)"]);
const executeSpendAbi = parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]);
const getNonceAbi = parseAbi(["function getNonce(address,uint192) view returns (uint256)"]);
const getUserOpHashAbi = parseAbi([
  "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
]);

const bigMax = (a: bigint, b: bigint) => (a > b ? a : b);

async function chainNow(): Promise<number> {
  const blk = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false]})) as {timestamp: Hex};
  return Number(BigInt(blk.timestamp));
}

async function gasPrice(): Promise<{maxFee: bigint; maxPrio: bigint}> {
  try {
    const gp = await bundler.request({method: "skandha_getGasPrice", params: []});
    return {maxFee: BigInt(gp.maxFeePerGas), maxPrio: BigInt(gp.maxPriorityFeePerGas)};
  } catch {
    return {maxFee: 0xb165100c4n, maxPrio: 0xb165100c4n};
  }
}

function dummyPaymasterData(sig: Hex): Hex {
  const now = Math.floor(Date.now() / 1000);
  const ts = encodeAbiParameters(parseAbiParameters("uint48, uint48"), [now + 300, now - 60]);
  return concat([ts, sig]);
}

function unpackedForEstimate(o: {
  sender: Address;
  nonce: bigint;
  callData: Hex;
  maxFee: bigint;
  maxPrio: bigint;
  sig: Hex;
  paymaster: Address;
}): UnpackedUserOp {
  return {
    sender: o.sender,
    nonce: toHex(o.nonce),
    callData: o.callData,
    callGasLimit: toHex(FLOOR_CGL),
    verificationGasLimit: toHex(FLOOR_VGL),
    preVerificationGas: toHex(FLOOR_PVG),
    maxFeePerGas: toHex(o.maxFee),
    maxPriorityFeePerGas: toHex(o.maxPrio),
    paymaster: o.paymaster,
    paymasterVerificationGasLimit: toHex(PM_VGL),
    paymasterPostOpGasLimit: toHex(PM_PGL),
    paymasterData: dummyPaymasterData(o.sig),
    signature: o.sig,
  };
}

async function estimateFloored(estOp: UnpackedUserOp): Promise<{cgl: bigint; vgl: bigint; pvg: bigint}> {
  try {
    const est = await bundler.request({method: "eth_estimateUserOperationGas", params: [estOp, EP]});
    return {
      cgl: bigMax(BigInt(est.callGasLimit), FLOOR_CGL),
      vgl: bigMax(BigInt(est.verificationGasLimit), FLOOR_VGL),
      pvg: bigMax(BigInt(est.preVerificationGas), FLOOR_PVG),
    };
  } catch {
    return {cgl: FLOOR_CGL, vgl: FLOOR_VGL, pvg: FLOOR_PVG};
  }
}

function classify(detail: string): {code: string; status: number} {
  const d = detail.toLowerCase();
  if (d.includes("aa31") || d.includes("deposit too low")) return {code: "sponsor_deposit_empty", status: 503};
  if (/aa2[0-9]|aa3[0-9]|aa9[0-9]/.test(d)) return {code: "bundler_rejected", status: 502};
  if (d.includes("rate")) return {code: "rate_limited", status: 429};
  return {code: "submission_failed", status: 502};
}

// GET → config probe (no secrets leaked, just whether the run is available)
export async function GET() {
  return NextResponse.json({configured: loadKeys().configured});
}

export async function POST(req: NextRequest) {
  const {signerKey, ownerKey, configured} = loadKeys();
  if (!configured) {
    return NextResponse.json({error: "not_configured", message: "Live run is not configured on this server."}, {status: 503});
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json", message: "Body must be JSON."}, {status: 400});
  }
  const b = body as Record<string, unknown>;
  const amount = parseAmount(b.amountBaseUnits);
  if (amount === null) {
    return NextResponse.json({error: "invalid_amount", message: "amountBaseUnits must be a positive integer."}, {status: 400});
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json({error: "amount_too_large", message: `amountBaseUnits must be ≤ ${MAX_AMOUNT}.`}, {status: 400});
  }

  const rl = rateLimit();
  if (!rl.ok) {
    return NextResponse.json({error: "rate_limited", message: "Too many runs — slow down.", retryAfter: rl.retryAfter}, {status: 429});
  }

  // Support dynamic vault/paymaster/agent from request body (deployed vault flow)
  const agentAddr = (typeof b.agent === "string" && b.agent.startsWith("0x") ? b.agent : DEMO.agent) as Address;
  const vaultAddr = (typeof b.vault === "string" && b.vault.startsWith("0x") ? b.vault : CONTRACTS.vault) as Address;
  const paymasterAddr = (typeof b.paymaster === "string" && b.paymaster.startsWith("0x") ? b.paymaster : CONTRACTS.paymaster) as Address;
  const mockUSDAddr = (typeof b.mockUSD === "string" && b.mockUSD.startsWith("0x") ? b.mockUSD : CONTRACTS.mockUSD) as Address;
  const vendorAddr = (typeof b.vendor === "string" && b.vendor.startsWith("0x") ? b.vendor : DEMO.vendor) as Address;

  try {
    const verifyingSigner = privateKeyToAccount(signerKey!);
    const agentOwner = privateKeyToAccount(ownerKey!);
    const agent = agentAddr;

    const nonce = (await rpc.readContract({address: EP, abi: getNonceAbi, functionName: "getNonce", args: [agent, 0n]})) as bigint;

    // fresh actionId so the CAP/DAILY-CAP is the reason, never dedup
    const actionId = keccak256(toBytes(`${agent}:${nonce}:${Date.now()}:${Math.random()}`));
    const inner = encodeFunctionData({abi: executeSpendAbi, functionName: "executeSpend", args: [mockUSDAddr, vendorAddr, amount, "0x", actionId]});
    const callData = encodeFunctionData({abi: executeAbi, functionName: "execute", args: [vaultAddr, 0n, inner]});

    const {maxFee, maxPrio} = await gasPrice();
    const dummySig = await privateKeyToAccount(`0x${"01".repeat(32)}` as Hex).sign({hash: `0x${"00".repeat(32)}` as Hex});
    const gas = await estimateFloored(unpackedForEstimate({sender: agent, nonce, callData, maxFee, maxPrio, sig: dummySig, paymaster: paymasterAddr}));

    // ---- FROZEN op — no field touched after this ----
    const op: UserOpFields = {
      sender: agent,
      nonce,
      initCode: "0x" as Hex,
      callData,
      verificationGasLimit: gas.vgl,
      callGasLimit: gas.cgl,
      preVerificationGas: gas.pvg,
      maxPriorityFeePerGas: maxPrio,
      maxFeePerGas: maxFee,
      paymasterVerificationGasLimit: PM_VGL,
      paymasterPostOpGasLimit: PM_PGL,
    };

    const cfg: SignerConfig = {chainId: CHAIN_ID, paymaster: paymasterAddr, vault: vaultAddr, registeredSenders: [agent]};
    const res = await sponsor(op, cfg, verifyingSigner, await chainNow());
    if (!res.sponsored) {
      return NextResponse.json({error: "not_sponsorable", message: res.reason}, {status: 400});
    }

    const packed = toPacked(op, res.paymasterAndData, "0x");
    const userOpHash = (await rpc.readContract({address: EP, abi: getUserOpHashAbi, functionName: "getUserOpHash", args: [packed]})) as Hex;
    const ownerSig = await agentOwner.signMessage({message: {raw: userOpHash}});

    const unpacked: UnpackedUserOp = {
      sender: agent,
      nonce: toHex(nonce),
      callData,
      callGasLimit: toHex(op.callGasLimit),
      verificationGasLimit: toHex(op.verificationGasLimit),
      preVerificationGas: toHex(op.preVerificationGas),
      maxFeePerGas: toHex(op.maxFeePerGas),
      maxPriorityFeePerGas: toHex(op.maxPriorityFeePerGas),
      paymaster: paymasterAddr,
      paymasterVerificationGasLimit: toHex(PM_VGL),
      paymasterPostOpGasLimit: toHex(PM_PGL),
      paymasterData: slice(res.paymasterAndData, 52),
      signature: ownerSig,
    };

    const sent = await bundler.request({method: "eth_sendUserOperation", params: [unpacked, EP]});
    return NextResponse.json({userOpHash: sent, amountBaseUnits: amount.toString()});
  } catch (e) {
    const err = e as {details?: string; shortMessage?: string; message?: string};
    const detail = err.details ?? err.shortMessage ?? err.message ?? "unknown error";
    const {code, status} = classify(detail);
    return NextResponse.json({error: code, message: detail.slice(0, 280)}, {status});
  }
}
