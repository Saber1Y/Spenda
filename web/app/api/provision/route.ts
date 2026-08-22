import {NextResponse, type NextRequest} from "next/server";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {CONTRACTS} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC = "https://rpc.botchain.ai";
const CHAIN_ID = 677;

// Self-serve safety rails: bounded caps so one provisioned agent can never
// drain meaningful treasury value even if spam-provisioned.
const MAX_PER_TX_CEILING = 10n * 1_000_000n; // 10 USDT per transaction
const DAILY_CAP_CEILING = 25n * 1_000_000n; // 25 USDT per day
const MAX_EXPIRY_DAYS = 365;

const abi = parseAbi([
  "function getAddress(address owner,uint256 salt) view returns (address)",
  "function createAccount(address owner,uint256 salt) returns (address)",
  "function setAgentPolicy(address agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "function setAllowedToken(address agent,address token,bool allowed)",
  "function setAllowedTarget(address agent,address target,bool allowed)",
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function owner() view returns (address)",
]);

const rpc = createPublicClient({transport: http(RPC)});

// Naive in-memory rate limit: 5 provisions per IP per hour.
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (window.length >= 5) return true;
  window.push(now);
  hits.set(ip, window);
  return false;
}

function loadTreasuryKey(): Hex | null {
  const key = process.env.SPENDA_TREASURY_KEY as Hex | undefined;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return key;
}

function provisionMessage(owner: Address, salt: string, maxPerTx: string, dailyCap: string, expiryDays: string, vendor: Address): string {
  return [
    "Spenda agent provisioning",
    `chainId: ${CHAIN_ID}`,
    `owner: ${owner.toLowerCase()}`,
    `salt: ${salt}`,
    `maxPerTxUsdt: ${maxPerTx}`,
    `dailyCapUsdt: ${dailyCap}`,
    `expiryDays: ${expiryDays}`,
    `vendor: ${vendor.toLowerCase()}`,
  ].join("\n");
}

async function confirmReceipt(hash: Hex, label: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const receipt = (await rpc.request({method: "eth_getTransactionReceipt", params: [hash]})) as {status?: string} | null;
      if (receipt) {
        if (receipt.status !== "0x1") throw new Error(`${label} reverted on-chain`);
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("reverted")) throw e;
    }
  }
  throw new Error(`${label} timed out waiting for inclusion`);
}

export async function GET() {
  const key = loadTreasuryKey();
  let configured = false;
  if (key) {
    try {
      const expected = await rpc.readContract({address: CONTRACTS.vault as Address, abi, functionName: "owner"});
      configured = privateKeyToAccount(key).address.toLowerCase() === expected.toLowerCase();
    } catch {
      configured = false;
    }
  }
  return NextResponse.json({configured});
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({error: "rate_limited", retryAfter: 3600}, {status: 429});
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json"}, {status: 400});
  }

  const owner = typeof body.owner === "string" ? body.owner : undefined;
  const vendor = typeof body.vendor === "string" ? body.vendor : undefined;
  const saltRaw = typeof body.salt === "string" ? body.salt : "0";
  const maxRaw = typeof body.maxPerTx === "string" || typeof body.maxPerTx === "number" ? String(body.maxPerTx) : undefined;
  const dailyRaw = typeof body.dailyCap === "string" || typeof body.dailyCap === "number" ? String(body.dailyCap) : undefined;
  const daysRaw = body.expiryDays;

  if (!owner || !vendor || !isAddress(owner) || !isAddress(vendor)) {
    return NextResponse.json({error: "owner and vendor must be valid addresses"}, {status: 400});
  }
  const forbidden = [CONTRACTS.vault, CONTRACTS.paymaster, CONTRACTS.factory, CONTRACTS.mockUSD].map((a) => a.toLowerCase());
  if (forbidden.includes((vendor as string).toLowerCase())) {
    return NextResponse.json({error: "vendor cannot be a Spenda system contract"}, {status: 400});
  }

  let salt: bigint;
  try {
    salt = BigInt(saltRaw);
    if (salt < 0n) throw new Error("negative");
  } catch {
    return NextResponse.json({error: "salt must be a non-negative integer"}, {status: 400});
  }

  let maxPerTx: bigint;
  let dailyCap: bigint;
  try {
    maxPerTx = parseUnits(maxRaw ?? "0", 6);
    dailyCap = parseUnits(dailyRaw ?? "0", 6);
  } catch {
    return NextResponse.json({error: "caps must be decimal USDT amounts"}, {status: 400});
  }
  if (maxPerTx <= 0n || maxPerTx > MAX_PER_TX_CEILING) {
    return NextResponse.json({error: "maxPerTx must be between 0 and 10 USDT"}, {status: 400});
  }
  if (dailyCap < maxPerTx || dailyCap > DAILY_CAP_CEILING) {
    return NextResponse.json({error: "dailyCap must be >= maxPerTx and <= 25 USDT"}, {status: 400});
  }

  const daysNum = Math.floor(Number(daysRaw ?? 30));
  if (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > MAX_EXPIRY_DAYS) {
    return NextResponse.json({error: `expiryDays must be 1-${MAX_EXPIRY_DAYS}`}, {status: 400});
  }
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + daysNum * 86_400);

  // Signature proves the requester controls the claimed owner EOA.
  const signature = typeof body.signature === "string" ? body.signature : undefined;
  if (!signature) {
    return NextResponse.json({error: "missing signature"}, {status: 400});
  }
  const message = provisionMessage(owner as Address, salt.toString(), String(maxRaw), String(dailyRaw), String(daysNum), vendor as Address);
  try {
    const ok = await verifyMessage({address: owner as Address, message, signature: signature as Hex});
    if (!ok) return NextResponse.json({error: "signature does not match owner"}, {status: 401});
  } catch {
    return NextResponse.json({error: "signature verification failed"}, {status: 401});
  }

  const treasuryKey = loadTreasuryKey();
  if (!treasuryKey) {
    return NextResponse.json({error: "not_configured", message: "Provisioning is not configured on this server."}, {status: 503});
  }
  const treasury = privateKeyToAccount(treasuryKey);
  try {
    const vaultOwner = await rpc.readContract({address: CONTRACTS.vault as Address, abi, functionName: "owner"});
    if (treasury.address.toLowerCase() !== vaultOwner.toLowerCase()) {
      return NextResponse.json({error: "not_configured", message: "Treasury key does not own the vault."}, {status: 503});
    }
  } catch {
    return NextResponse.json({error: "rpc_unreachable"}, {status: 502});
  }

  const wallet = createWalletClient({account: treasury, transport: http(RPC)});
  const factory = CONTRACTS.factory as Address;
  const vault = CONTRACTS.vault as Address;
  const usdt = CONTRACTS.mockUSD as Address;

  try {
    const agent = await rpc.readContract({address: factory, abi, functionName: "getAddress", args: [owner as Address, salt]});
    const hashes: Hex[] = [];

    const code = await rpc.getCode({address: agent});
    if (!code || code === "0x") {
      const data = encodeFunctionData({abi, functionName: "createAccount", args: [owner as Address, salt]});
      const h = await wallet.sendTransaction({account: treasury, chain: null, to: factory, data});
      hashes.push(h);
      await confirmReceipt(h, "createAccount");
    }

    const sendVault = async (
      functionName: "setAgentPolicy" | "setAllowedToken" | "setAllowedTarget",
      args: readonly unknown[],
      label: string,
    ) => {
      const h = await wallet.sendTransaction({
        account: treasury,
        chain: null,
        to: vault,
        data: encodeFunctionData({abi, functionName, args: args as never}),
      });
      hashes.push(h);
      await confirmReceipt(h, label);
    };

    await sendVault("setAgentPolicy", [agent, maxPerTx, dailyCap, expiresAt, true], "setAgentPolicy");
    await sendVault("setAllowedToken", [agent, usdt, true], "setAllowedToken");
    await sendVault("setAllowedTarget", [agent, vendor, true], "setAllowedTarget");

    // Read-back proof before reporting success.
    const policy = await rpc.readContract({address: vault, abi, functionName: "getPolicy", args: [agent]});
    if (!policy.active) throw new Error("Policy did not activate on-chain.");

    return NextResponse.json({
      ok: true,
      agent,
      owner,
      vendor,
      maxPerTxUsdt: Number(maxPerTx) / 1e6,
      dailyCapUsdt: Number(dailyCap) / 1e6,
      expiryDays: daysNum,
      txHashes: hashes,
    });
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : String(e)}, {status: 500});
  }
}
