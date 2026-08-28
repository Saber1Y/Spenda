import {NextResponse, type NextRequest} from "next/server";
import {isAddress, parseAbi, type Address, type Hex} from "viem";
import {randomBytes} from "node:crypto";
import {rpc} from "@/lib/sponsor/userFlow";
import {CONTRACTS, DEMO} from "@/lib/contracts";
import {scoreIntent, RISK_POLICY, riskLevel} from "@/lib/riskPolicy";
import {savePendingApproval} from "@/lib/intentStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent Discovered Intent webhook.
 *
 * Real AI agents (or their tool integrations) POST here when they discover
 * a spending need: subscription renewal detected in email, calendar event
 * approaching, API credit low, etc.
 *
 * This endpoint does NOT spend money. It validates, scores risk, and either:
 *  - auto-approves (low risk → ready for immediate execution)
 *  - queues for human approval (medium/high risk)
 *  - blocks (policy violation)
 *
 * The separation is intentional: the agent figures out WHAT needs paying.
 * Spenda decides WHETHER it's allowed to pay.
 */

const vaultViewAbi = parseAbi([
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
]);

// In-memory store of discovered intents (per-instance; production would use Redis/DB)
const discovered = new Map<string, DiscoveredIntent>();
const DISCOVERED_TTL_MS = 24 * 60 * 60 * 1000;

export interface DiscoveredIntent {
  intentId: string;
  actionId: string;
  agent: Address;
  token: Address;
  amount: string;
  recipient: Address;
  category: string;
  label: string;
  source: string; // "email", "calendar", "api", "manual"
  reason: string;
  expiresAt: number;
  decision: "approved" | "human_approval" | "blocked";
  decisionReason: string;
  riskScore: number;
  riskLevel: string;
  discoveredAt: number;
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, val] of discovered) {
    if (now - val.discoveredAt > DISCOVERED_TTL_MS) discovered.delete(key);
  }
}

export async function GET() {
  cleanExpired();
  const items = Array.from(discovered.values())
    .filter((d) => d.decision !== "blocked")
    .sort((a, b) => b.discoveredAt - a.discoveredAt);
  return NextResponse.json({items});
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid_json"}, {status: 400});
  }

  const agent = typeof body.agent === "string" && isAddress(body.agent) ? (body.agent as Address) : undefined;
  const vendor = typeof body.vendor === "string" && isAddress(body.vendor) ? (body.vendor as Address) : undefined;
  const amountRaw = typeof body.amount === "string" && /^[0-9]+$/.test(body.amount) ? body.amount : undefined;
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Agent request";
  const category = typeof body.category === "string" ? body.category : "marketplace";
  const source = typeof body.source === "string" ? body.source : "api";
  const reason = typeof body.reason === "string" ? body.reason : "Agent discovered spending need";

  if (!agent || !vendor || !amountRaw) {
    return NextResponse.json(
      {error: "agent, vendor, and amount are required"},
      {status: 400},
    );
  }

  const amount = BigInt(amountRaw);
  if (amount <= 0n || amount > 100_000_000n) {
    return NextResponse.json({error: "amount must be 0.01-100 USDT"}, {status: 400});
  }

  const vault = CONTRACTS.vault as Address;
  const token = CONTRACTS.mockUSD as Address;

  try {
    const code = await rpc.getCode({address: agent});
    if (!code || code === "0x") {
      return NextResponse.json({error: "account_not_deployed"}, {status: 400});
    }

    const policy = await rpc.readContract({address: vault, abi: vaultViewAbi, functionName: "getPolicy", args: [agent]});
    const latest = (await rpc.request({method: "eth_getBlockByNumber", params: ["latest", false]})) as {timestamp: Hex};
    const nowSec = Number(BigInt(latest.timestamp));

    const fail = (decisionReason: string) => {
      const item: DiscoveredIntent = {
        intentId: `0x${randomBytes(16).toString("hex")}`,
        actionId: `0x${randomBytes(32).toString("hex")}`,
        agent,
        token,
        amount: amountRaw,
        recipient: vendor,
        category,
        label,
        source,
        reason,
        expiresAt: nowSec + 2 * 3600,
        decision: "blocked",
        decisionReason,
        riskScore: 100,
        riskLevel: "HIGH",
        discoveredAt: Date.now(),
      };
      discovered.set(item.intentId, item);
      return NextResponse.json({intent: item, blocked: true});
    };

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

    const vendorLower = vendor.toLowerCase();
    const knownVendor =
      Object.values(CONTRACTS).some((v) => typeof v === "string" && v.toLowerCase() === vendorLower) ||
      Object.values(DEMO).some((v) => typeof v === "string" && v.toLowerCase() === vendorLower);

    const riskScore = scoreIntent({amountBaseUnits: amount, spentTodayBaseUnits: policy.spentToday, category, knownVendor});
    const needsHuman = riskScore >= RISK_POLICY.humanApprovalScoreMin;

    const item: DiscoveredIntent = {
      intentId: `0x${randomBytes(16).toString("hex")}`,
      actionId: `0x${randomBytes(32).toString("hex")}`,
      agent,
      token,
      amount: amountRaw,
      recipient: vendor,
      category,
      label,
      source,
      reason,
      expiresAt: nowSec + 2 * 3600,
      decision: needsHuman ? "human_approval" : "approved",
      decisionReason: needsHuman
        ? `Risk ${riskScore}/100 - human approval required`
        : `Risk ${riskScore}/${100} (${riskLevel(riskScore)}) - within autonomous limits`,
      riskScore,
      riskLevel: riskLevel(riskScore),
      discoveredAt: Date.now(),
    };

    discovered.set(item.intentId, item);
    if (item.decision === "human_approval") {
      // Also save to pending approvals so it shows on the Approvals page
      savePendingApproval({
        intentId: item.intentId,
        actionId: item.actionId,
        agent: item.agent,
        token: item.token,
        amount: item.amount,
        recipient: item.recipient,
        category: item.category,
        label: item.label,
        expiresAt: item.expiresAt,
        decision: item.decision,
        decisionReason: item.decisionReason,
        riskScore: item.riskScore,
        riskLevel: item.riskLevel,
      });
    }

    return NextResponse.json({intent: item});
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : String(e)}, {status: 500});
  }
}
