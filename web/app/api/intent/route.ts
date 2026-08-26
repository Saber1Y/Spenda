import {NextResponse, type NextRequest} from "next/server";
import {isAddress, parseAbi, type Address, type Hex} from "viem";
import {randomBytes} from "node:crypto";
import {rpc} from "@/lib/sponsor/userFlow";
import {CONTRACTS, DEMO} from "@/lib/contracts";
import {findMerchant} from "@/lib/merchants";
import {scoreIntent, RISK_POLICY, riskLevel} from "@/lib/riskPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stateless intent engine. Reads the agent's live policy from the vault,
 * scores the spend deterministically (see lib/riskPolicy.ts), and returns a
 * decision. Nothing is stored server-side: the caller keeps the intent and
 * either executes it immediately (auto-approved) or queues it for a human
 * signature on the Approvals page.
 */

const vaultViewAbi = parseAbi([
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json"}, {status: 400});
  }

  const agent = typeof body.agent === "string" && isAddress(body.agent) ? (body.agent as Address) : undefined;
  if (!agent) return NextResponse.json({error: "invalid_agent"}, {status: 400});

  const merchant = typeof body.merchantId === "string" ? findMerchant(body.merchantId) : undefined;
  let amountHex = typeof body.amountBaseUnits === "string" && /^[0-9]+$/.test(body.amountBaseUnits) ? body.amountBaseUnits : undefined;
  let vendor = typeof body.vendor === "string" && isAddress(body.vendor) ? body.vendor : undefined;
  let category = typeof body.category === "string" ? body.category : "marketplace";
  let label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Custom purchase";

  if (merchant) {
    amountHex = merchant.priceBaseUnits;
    vendor = merchant.paymentAddress as Address;
    category = merchant.category;
    label = merchant.name;
  }
  if (!amountHex || !vendor) return NextResponse.json({error: "amount_and_vendor_required"}, {status: 400});
  const amount = BigInt(amountHex);
  if (amount <= 0n || amount > 100_000_000n) return NextResponse.json({error: "invalid_amount"}, {status: 400});

  const vault = CONTRACTS.vault as Address;
  const token = CONTRACTS.mockUSD as Address;

  try {
    const code = await rpc.getCode({address: agent});
    if (!code || code === "0x") return NextResponse.json({error: "account_not_deployed"}, {status: 400});

    const policy = await rpc.readContract({address: vault, abi: vaultViewAbi, functionName: "getPolicy", args: [agent]});
    const latest = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false]})) as {timestamp: Hex};
    const nowSec = Number(BigInt(latest.timestamp));

    const policySnapshot = {
      maxPerTxUsdt: Number(policy.maxPerTx) / 1e6,
      dailyCapUsdt: Number(policy.dailyCap) / 1e6,
      spentTodayUsdt: Number(policy.spentToday) / 1e6,
      remainingTodayUsdt: Math.max(0, Number(policy.dailyCap - policy.spentToday) / 1e6),
      expirySeconds: Number(policy.expiry),
      active: policy.active === true,
    };

    const fail = (decisionReason: string) =>
      NextResponse.json({
        intent: {
          intentId: `0x${randomBytes(16).toString("hex")}`,
          actionId: `0x${randomBytes(32).toString("hex")}`,
          agent,
          token,
          amount: amountHex,
          recipient: vendor,
          category,
          label,
          expiresAt: nowSec + 2 * 3600,
          decision: "blocked",
          decisionReason,
          riskScore: null,
          riskLevel: null,
        },
        policySnapshot,
      });

    if (!policy.active) return fail("Agent policy is inactive");
    if (BigInt(policy.expiry) <= BigInt(nowSec)) return fail("Agent policy has expired");
    if (amount > policy.maxPerTx) return fail(`Exceeds maxPerTx (${Number(policy.maxPerTx) / 1e6} USDT)`);
    if (policy.spentToday + amount > policy.dailyCap) return fail("Exceeds daily cap");

    const [targetOk, tokenOk] = await Promise.all([
      rpc.readContract({address: vault, abi: vaultViewAbi, functionName: "allowedTarget", args: [agent, vendor]}),
      rpc.readContract({address: vault, abi: vaultViewAbi, functionName: "allowedToken", args: [agent, token]}),
    ]);
    if (!targetOk) return fail("Vendor is not allowlisted for this agent");
    if (!tokenOk) return fail("Token is not allowlisted for this agent");

    const vendorLower = (vendor as string).toLowerCase();
    const knownVendor =
      Object.values(CONTRACTS).some((v) => typeof v === "string" && v.toLowerCase() === vendorLower) ||
      Object.values(DEMO).some((v) => typeof v === "string" && v.toLowerCase() === vendorLower);
    const riskScore = scoreIntent({amountBaseUnits: amount, spentTodayBaseUnits: policy.spentToday, category, knownVendor});
    const needsHuman = riskScore >= RISK_POLICY.humanApprovalScoreMin;

    return NextResponse.json({
      intent: {
        intentId: `0x${randomBytes(16).toString("hex")}`,
        actionId: `0x${randomBytes(32).toString("hex")}`,
        agent,
        token,
        amount: amountHex,
        recipient: vendor,
        category,
        label,
        expiresAt: nowSec + 2 * 3600,
        decision: needsHuman ? "human_approval" : "approved",
        decisionReason: needsHuman
          ? `Risk ${riskScore}/100 - human approval required`
          : `Risk ${riskScore}/${100} (${riskLevel(riskScore)}) - within autonomous limits`,
        riskScore,
        riskLevel: riskLevel(riskScore),
      },
      policySnapshot,
    });
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : String(e)}, {status: 500});
  }
}
