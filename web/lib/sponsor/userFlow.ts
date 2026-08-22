import {createPublicClient, http, encodeAbiParameters, parseAbiParameters, concat, slice, toHex, rpcSchema, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {toPacked, type UserOpFields} from "@/lib/sponsor/userOp";
import type {BundlerRpcSchema, UnpackedUserOp} from "@/lib/bundlerSchema";

export const RPC_URL = "https://rpc.botchain.ai";
export const BUNDLER_URL = "https://bundler.botchain.ai/rpc";
export const EP = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
export const CHAIN_ID = 677n;

// Frozen-gas floors (the C5 callGasLimit-bug lesson: Skandha's per-op breakdown is unreliable,
// so we floor every estimate at proven minimums). Accounts are deployed at provisioning time
// so no initCode is ever needed here.
export const FLOOR_CGL = 250_000n;
export const FLOOR_VGL = 200_000n;
export const FLOOR_PVG = 60_000n;
export const PM_VGL = 300_000n;
export const PM_PGL = 100_000n;
export const MAX_AMOUNT = 100_000_000n; // 100 mUSD sane ceiling

export const rpc = createPublicClient({transport: http(RPC_URL)});
export const bundler = createPublicClient({transport: http(BUNDLER_URL), rpcSchema: rpcSchema<BundlerRpcSchema>()});

const bigMax = (a: bigint, b: bigint) => (a > b ? a : b);

export async function chainNow(): Promise<number> {
  const blk = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false]})) as {timestamp: Hex};
  return Number(BigInt(blk.timestamp));
}

export async function gasPrice(): Promise<{maxFee: bigint; maxPrio: bigint}> {
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

export function unpackedForEstimate(o: {
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

export async function estimateFloored(estOp: UnpackedUserOp): Promise<{cgl: bigint; vgl: bigint; pvg: bigint}> {
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

export function classify(detail: string): {code: string; status: number} {
  const d = detail.toLowerCase();
  if (d.includes("aa31") || d.includes("deposit too low")) return {code: "sponsor_deposit_empty", status: 503};
  if (/aa2[0-9]|aa3[0-9]|aa9[0-9]/.test(d)) return {code: "bundler_rejected", status: 502};
  if (d.includes("rate")) return {code: "rate_limited", status: 429};
  if (d.includes("expired") || d.includes("aa22")) return {code: "signature_or_window_rejected", status: 400};
  return {code: "submission_failed", status: 502};
}

export interface PendingSpend {
  unpacked: UnpackedUserOp;
  packedForHash: ReturnType<typeof toPacked>;
  amount: bigint;
  vendor: Address;
  actionId: Hex;
  createdAt: number;
}

// In-memory registry of ops this server prepared. send only accepts hashes it
// prepared itself within the TTL window, so clients cannot smuggle arbitrary ops.
const pending = new Map<string, PendingSpend>();
const PENDING_TTL_MS = 15 * 60_000;

export function rememberPending(userOpHash: string, entry: PendingSpend): void {
  for (const [key, value] of pending) {
    if (Date.now() - value.createdAt > PENDING_TTL_MS) pending.delete(key);
  }
  pending.set(userOpHash, entry);
}

export function takePending(userOpHash: string): PendingSpend | null {
  const entry = pending.get(userOpHash);
  if (!entry) return null;
  pending.delete(userOpHash);
  if (Date.now() - entry.createdAt > PENDING_TTL_MS) return null;
  return entry;
}

export function parseAmount(v: unknown): bigint | null {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? BigInt(v) : null;
  if (typeof v === "string" && /^[0-9]+$/.test(v)) {
    const b = BigInt(v);
    return b > 0n ? b : null;
  }
  return null;
}

export function paymasterDataSlice(paymasterAndData: Hex): Hex {
  return slice(paymasterAndData, 52);
}
