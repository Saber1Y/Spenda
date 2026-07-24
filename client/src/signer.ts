import {
  type Address,
  type Hex,
  decodeFunctionData,
  getAddress,
  isAddress,
  isHex,
  parseAbi,
  size,
  slice,
  toFunctionSelector,
} from "viem";
import {paymasterGetHash} from "./getHash.js";
import {buildPaymasterAndData, type UserOpFields} from "./userOp.js";

/**
 * Stateless off-chain sponsorship signer (Fence 1, policy authority). Adds ONLY the gate
 * (steps 0-2) + validity window on top of B5a's PROVEN primitives — it imports paymasterGetHash,
 * the v0.7 packing, and uses the exact `signMessage({message:{raw}})` call B5a matched against the
 * on-chain path. It reads no storage and no vault state (mirrors the storage-free paymaster
 * invariant), and produces ONLY the paymaster sponsorship signature — never the EntryPoint
 * userOpHash (that is the agent client's account-owner signature).
 */

/// Validity-window bounds = the contract with chain 968's block.timestamp. The signer stamps these
/// off its own wall clock; the EntryPoint enforces them against block time. Host clock drift beyond
/// SKEW makes ops fail AA32 (looks like a bug, is actually skew) — the return payload surfaces the
/// window so a Phase C failure is diagnosable. Run the signer host on NTP.
export const SKEW_SECONDS = 60;
export const TTL_SECONDS = 300;

/// SimpleAccount.execute(address,uint256,bytes) — the only outer call this signer sponsors.
export const EXECUTE_SELECTOR: Hex = "0xb61d27f6";
/// SpendaVault.executeSpend(address,address,uint256,bytes,bytes32) — optional inner-selector pin.
export const EXECUTE_SPEND_SELECTOR: Hex = toFunctionSelector(
  "executeSpend(address,address,uint256,bytes,bytes32)",
);

export interface SignerConfig {
  chainId: bigint;
  paymaster: Address;
  vault: Address;
  /// Registered agent identities = SimpleAccount ADDRESSES (never the owner EOAs).
  registeredSenders: Address[];
  /// Optional defense-in-depth: also require the inner call to be executeSpend.
  checkInnerSelector?: boolean;
}

export type SponsorResult =
  | {
      sponsored: true;
      paymasterAndData: Hex;
      validUntil: number;
      validAfter: number;
      now: number;
      skewSeconds: number;
      ttlSeconds: number;
    }
  | {sponsored: false; reason: string};

/// Minimal signer capability — satisfied by a viem LocalAccount (privateKeyToAccount).
export interface SponsorshipSigner {
  signMessage(args: {message: {raw: Hex}}): Promise<Hex>;
}

const U128_MAX = (1n << 128n) - 1n;
const U256_MAX = (1n << 256n) - 1n;

/// Step 0 — refuse cleanly on hostile/malformed input (never throw, never partial).
function validateInput(op: UserOpFields): string | null {
  if (!isAddress(op.sender)) return "malformed input: sender not an address";
  if (!isHex(op.initCode)) return "malformed input: initCode not hex";
  if (!isHex(op.callData) || op.callData.length % 2 !== 0) return "malformed input: callData not hex";
  if (size(op.callData) < 36) return "callData too short"; // need selector(4) + dest word(32)
  const u128 = [
    op.verificationGasLimit,
    op.callGasLimit,
    op.maxPriorityFeePerGas,
    op.maxFeePerGas,
    op.paymasterVerificationGasLimit,
    op.paymasterPostOpGasLimit,
  ];
  for (const x of u128) if (x < 0n || x > U128_MAX) return "malformed input: gas field out of uint128 range";
  for (const x of [op.nonce, op.preVerificationGas]) if (x < 0n || x > U256_MAX) return "malformed input: field out of uint256 range";
  return null;
}

/// Mirrors the on-chain gate: `address(uint160(uint256(bytes32(callData[4:36]))))` — take the
/// 32-byte dest word and mask to the low 20 bytes, so off-chain/on-chain agree on dirty-upper-byte
/// encodings.
function extractDest(callData: Hex): Address {
  const word = slice(callData, 4, 36); // 32-byte head word for `dest`
  return getAddress(slice(word, 12, 32)); // low 20 bytes
}

function innerSelector(callData: Hex): Hex | null {
  try {
    const {args} = decodeFunctionData({
      abi: parseAbi(["function execute(address,uint256,bytes)"]),
      data: callData,
    });
    const func = args[2] as Hex;
    if (size(func) < 4) return null;
    return slice(func, 0, 4);
  } catch {
    return null;
  }
}

export async function sponsor(
  op: UserOpFields,
  cfg: SignerConfig,
  signer: SponsorshipSigner,
  now: number,
): Promise<SponsorResult> {
  // Step 0 — input validation (trust boundary)
  const bad = validateInput(op);
  if (bad) return {sponsored: false, reason: bad};

  // Step 1 — sender registration (SimpleAccount addresses)
  const sender = getAddress(op.sender);
  const registered = cfg.registeredSenders.some((a) => getAddress(a) === sender);
  if (!registered) return {sponsored: false, reason: "sender not registered"};

  // Step 2 — destination gate (mirror on-chain; defense in depth)
  if (slice(op.callData, 0, 4).toLowerCase() !== EXECUTE_SELECTOR) {
    return {sponsored: false, reason: "selector not execute"};
  }
  if (extractDest(op.callData) !== getAddress(cfg.vault)) {
    return {sponsored: false, reason: "dest not vault"};
  }
  if (cfg.checkInnerSelector) {
    const inner = innerSelector(op.callData);
    if (inner === null) return {sponsored: false, reason: "malformed input: inner callData"};
    if (inner.toLowerCase() !== EXECUTE_SPEND_SELECTOR.toLowerCase()) {
      return {sponsored: false, reason: "inner not executeSpend"};
    }
  }

  // Step 3 — window + sign (reuse B5a's proven getHash + sign call)
  const validAfter = now - SKEW_SECONDS;
  const validUntil = now + TTL_SECONDS;
  const digest = paymasterGetHash(op, validUntil, validAfter, cfg.paymaster, cfg.chainId);
  const signature = await signer.signMessage({message: {raw: digest}});
  const paymasterAndData = buildPaymasterAndData(
    cfg.paymaster,
    op.paymasterVerificationGasLimit,
    op.paymasterPostOpGasLimit,
    validUntil,
    validAfter,
    signature,
  );

  return {
    sponsored: true,
    paymasterAndData,
    validUntil,
    validAfter,
    now,
    skewSeconds: SKEW_SECONDS,
    ttlSeconds: TTL_SECONDS,
  };
}
