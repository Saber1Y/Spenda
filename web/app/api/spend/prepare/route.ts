import {NextResponse, type NextRequest} from "next/server";
import {encodeFunctionData, isAddress, parseAbi, slice, toHex, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {randomBytes} from "node:crypto";
import {sponsor, type SignerConfig} from "@/lib/sponsor/signer";
import {toPacked, type UserOpFields} from "@/lib/sponsor/userOp";
import {
  CHAIN_ID,
  EP,
  MAX_AMOUNT,
  PM_PGL,
  PM_VGL,
  bundler,
  chainNow,
  classify,
  estimateFloored,
  gasPrice,
  parseAmount,
  rememberPending,
  rpc,
  unpackedForEstimate,
} from "@/lib/sponsor/userFlow";
import {CONTRACTS, DEMO} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prepares a USER-SIGNED sponsored spend for any agent with an active policy.
// The server does everything except the owner signature: nonce, calldata, gas
// estimation, paymaster signature, userOpHash. The browser then signs the hash
// with the connected wallet (the agent's owner) and /api/spend/send submits it.

const executeSpendAbi = parseAbi(["function executeSpend(address,address,uint256,bytes,bytes32)"]);
const executeAbi = parseAbi(["function execute(address,uint256,bytes)"]);
const getNonceAbi = parseAbi(["function getNonce(address,uint192) view returns (uint256)"]);
const getUserOpHashAbi = parseAbi([
  "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
]);
const vaultViewAbi = parseAbi([
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
]);

// Token bucket + min gap so spam can't drain the paymaster deposit.
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

function loadSignerKey(): Hex | null {
  const key = process.env.VERIFYING_SIGNER_KEY as Hex | undefined;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key;
}

export async function GET() {
  return NextResponse.json({configured: loadSignerKey() !== null});
}

export async function POST(req: NextRequest) {
  const signerKey = loadSignerKey();
  if (!signerKey) {
    return NextResponse.json({error: "not_configured", message: "Live run is not configured on this server."}, {status: 503});
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json", message: "Body must be JSON."}, {status: 400});
  }

  const amount = parseAmount(body.amountBaseUnits);
  if (amount === null) {
    return NextResponse.json({error: "invalid_amount", message: "amountBaseUnits must be a positive integer."}, {status: 400});
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json({error: "amount_too_large", message: `amountBaseUnits must be <= ${MAX_AMOUNT}.`}, {status: 400});
  }

  const senderRaw = typeof body.sender === "string" ? body.sender : undefined;
  const vendorRaw = typeof body.vendor === "string" && body.vendor ? body.vendor : DEMO.vendor;
  if (!senderRaw || !isAddress(senderRaw) || !isAddress(vendorRaw)) {
    return NextResponse.json({error: "invalid_addresses"}, {status: 400});
  }
  const sender = senderRaw as Address;
  const vendor = vendorRaw as Address;

  const rl = rateLimit();
  if (!rl.ok) {
    return NextResponse.json({error: "rate_limited", message: "Too many runs — slow down.", retryAfter: rl.retryAfter}, {status: 429});
  }

  const vaultAddr = CONTRACTS.vault as Address;
  const paymasterAddr = CONTRACTS.paymaster as Address;
  const token = CONTRACTS.mockUSD as Address;

  try {
    // The account must exist (provisioning deploys it) and have a live policy
    // that can cover this spend — fail early with readable reasons.
    const code = await rpc.getCode({address: sender});
    if (!code || code === "0x") {
      return NextResponse.json({error: "account_not_deployed"}, {status: 400});
    }
    const policy = await rpc.readContract({address: vaultAddr, abi: vaultViewAbi, functionName: "getPolicy", args: [sender]});
    const nowSec = BigInt(await chainNow());
    if (!policy.active || policy.expiry <= nowSec) {
      return NextResponse.json({error: "agent_not_active"}, {status: 400});
    }
    if (amount > policy.maxPerTx) {
      return NextResponse.json(
        {error: "exceeds_max_per_tx", maxPerTx: policy.maxPerTx.toString()},
        {status: 400},
      );
    }
    if (policy.spentToday + amount > policy.dailyCap) {
      return NextResponse.json(
        {error: "exceeds_daily_cap", dailyCap: policy.dailyCap.toString(), spentToday: policy.spentToday.toString()},
        {status: 400},
      );
    }
    const [targetOk, tokenOk] = await Promise.all([
      rpc.readContract({address: vaultAddr, abi: vaultViewAbi, functionName: "allowedTarget", args: [sender, vendor]}),
      rpc.readContract({address: vaultAddr, abi: vaultViewAbi, functionName: "allowedToken", args: [sender, token]}),
    ]);
    if (!targetOk || !tokenOk) {
      return NextResponse.json({error: "not_allowed", targetAllowed: targetOk, tokenAllowed: tokenOk}, {status: 400});
    }

    const nonce = (await rpc.readContract({address: EP, abi: getNonceAbi, functionName: "getNonce", args: [sender, 0n]})) as bigint;

    // Fresh actionId so a CAP rejection is never masked by dedup replay.
    const actionId = `0x${randomBytes(32).toString("hex")}` as Hex;
    const inner = encodeFunctionData({abi: executeSpendAbi, functionName: "executeSpend", args: [token, vendor, amount, "0x", actionId]});
    const callData = encodeFunctionData({abi: executeAbi, functionName: "execute", args: [vaultAddr, 0n, inner]});

    const {maxFee, maxPrio} = await gasPrice();
    const dummySig = await privateKeyToAccount(`0x${"01".repeat(32)}` as Hex).sign({hash: `0x${"00".repeat(32)}` as Hex});
    const gas = await estimateFloored(unpackedForEstimate({sender, nonce, callData, maxFee, maxPrio, sig: dummySig, paymaster: paymasterAddr}));

    // ---- FROZEN op — no field touched after this ----
    const op: UserOpFields = {
      sender,
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

    const cfg: SignerConfig = {
      chainId: CHAIN_ID,
      paymaster: paymasterAddr,
      vault: vaultAddr,
      registeredSenders: [sender],
      checkInnerSelector: true,
    };
    const res = await sponsor(op, cfg, privateKeyToAccount(signerKey), await chainNow());
    if (!res.sponsored) {
      return NextResponse.json({error: "not_sponsorable", message: res.reason}, {status: 400});
    }

    const packed = toPacked(op, res.paymasterAndData, "0x");
    const userOpHash = (await rpc.readContract({address: EP, abi: getUserOpHashAbi, functionName: "getUserOpHash", args: [packed]})) as Hex;

    rememberPending(userOpHash.toLowerCase(), {
      unpacked: {
        sender,
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
        signature: "0x",
      },
      packedForHash: packed,
      amount,
      vendor,
      actionId,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      userOpHash,
      expiresInSeconds: 15 * 60,
    });
  } catch (e) {
    const err = e as {details?: string; shortMessage?: string; message?: string};
    const detail = err.details ?? err.shortMessage ?? err.message ?? "unknown error";
    const {code, status} = classify(detail);
    return NextResponse.json({error: code, message: detail.slice(0, 280)}, {status});
  }
}
