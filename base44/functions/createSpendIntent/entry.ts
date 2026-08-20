import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS, MUSD_DECIMALS} from "../../shared/constants.ts";

const RPC_URL = "https://rpc.bohr.life";
const GET_POLICY_SEL = "0x3791dc6a";
const REMAINING_DAILY_SEL = "0x29d99a45";
const ALLOWED_TARGET_SEL = "0xed8f4e2d";
const ALLOWED_TOKEN_SEL = "0xe02f7f62";
const BALANCE_OF_SEL = "0x70a08231";
const MAX_INTENT_SECONDS = 24 * 60 * 60;
const INTENT_TYPES = ["purchase", "transfer", "service", "agent_payment", "rwa_purchase"];

let rpcId = 0;

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isPositiveInteger(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function padWord(value: string): string {
  return value.slice(2).padStart(64, "0");
}

function encodeCall(selector: string, ...args: string[]): string {
  return selector + args.map(padWord).join("");
}

function word(result: string, index: number): bigint {
  return BigInt(`0x${result.slice(2 + index * 64, 2 + (index + 1) * 64)}`);
}

function randomBytes32(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function ethCall(to: string, data: string): Promise<string> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{to, data}, "latest"]}),
  });
  const json = await response.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

function calculateRisk(input: {
  amount: bigint;
  maxPerTransaction: bigint;
  remainingDailyBudget: bigint;
  recipientAllowlisted: boolean;
  tokenAllowlisted: boolean;
  knownContract: boolean;
  unusualVelocity: boolean;
  category?: string;
}) {
  const factors: Array<{code: string; label: string; points: number; evidence: string}> = [];
  const add = (code: string, label: string, points: number, evidence: string) => {
    if (points > 0) factors.push({code, label, points, evidence});
  };
  const amountUtilization = input.maxPerTransaction > 0n
    ? (input.amount * 100n) / input.maxPerTransaction
    : 100n;
  const budgetUtilization = input.remainingDailyBudget > 0n
    ? (input.amount * 100n) / input.remainingDailyBudget
    : 100n;
  add("amount", "Amount utilization", amountUtilization >= 90n ? 25 : amountUtilization >= 50n ? 15 : amountUtilization >= 10n ? 5 : 0, "Amount relative to max transaction limit");
  add("new_recipient", "New recipient", input.recipientAllowlisted ? 0 : 25, "Recipient allowlist status");
  add("unknown_token", "Unknown token", input.tokenAllowlisted ? 0 : 25, "Token allowlist status");
  add("unknown_contract", "Unknown contract", input.knownContract ? 0 : 30, "Target contract recognition");
  add("velocity", "Unusual spending velocity", input.unusualVelocity ? 15 : 0, "Recent agent spending velocity");
  add("budget_utilization", "Budget utilization", input.remainingDailyBudget <= 0n || input.amount >= input.remainingDailyBudget ? 20 : budgetUtilization >= 90n ? 15 : budgetUtilization >= 50n ? 8 : budgetUtilization >= 10n ? 3 : 0, "Amount relative to remaining daily budget");
  add("rwa_category", "RWA category", input.category === "rwa" || input.category === "real_world_asset" ? 10 : 0, "RWA category review weight");
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  const level = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const recommendation = level === "critical" ? "block" : level === "high" ? "human_approval" : level === "medium" ? "policy_dependent" : "automatic";
  return {algorithm_version: "v1", score, level, factors, recommendation};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const now = Math.floor(Date.now() / 1000);
    const {vault_id, agent_id, intent_type, description, token, amount, recipient, category, merchant_id, metadata, expires_at} = body;

    const errors: string[] = [];
    if (typeof vault_id !== "string" || !vault_id) errors.push("vault_id is required");
    if (typeof agent_id !== "string" || !agent_id) errors.push("agent_id is required");
    if (!INTENT_TYPES.includes(intent_type)) errors.push("intent_type is invalid");
    if (typeof description !== "string" || !description.trim()) errors.push("description is required");
    if (!isAddress(token)) errors.push("token must be a valid address");
    if (!isPositiveInteger(amount)) errors.push("amount must be a positive integer string");
    if (!isAddress(recipient)) errors.push("recipient must be a valid address");
    if (!Number.isSafeInteger(expires_at) || expires_at <= now || expires_at > now + MAX_INTENT_SECONDS) errors.push("expires_at must be within the next 24 hours");
    if (errors.length > 0) return Response.json({ok: false, error: "invalid_intent", details: errors}, {status: 400});

    const vaults = await base44.asServiceRole.entities.Vault.filter({id: vault_id});
    if (vaults.length === 0 || !isAddress(vaults[0].contract_address)) {
      return Response.json({ok: false, error: "vault_not_authorized"}, {status: 403});
    }
    const vaultAddress = vaults[0].contract_address;
    const agents = await base44.asServiceRole.entities.Agent.filter({id: agent_id, vault_id});
    if (agents.length === 0 || agents[0].status !== "active") return Response.json({ok: false, error: "agent_not_authorized"}, {status: 403});
    const agentAddress = agents[0].address;
    if (merchant_id) {
      const merchants = await base44.asServiceRole.entities.Merchant.filter({vault_id, merchant_id, status: "active"});
      if (merchants.length === 0 || merchants[0].payment_address.toLowerCase() !== recipient.toLowerCase()) return Response.json({ok: false, error: "merchant_not_authorized"}, {status: 403});
    }
    const [policyResult, remainingResult, targetResult, tokenResult, balanceResult] = await Promise.all([
      ethCall(vaultAddress, encodeCall(GET_POLICY_SEL, agentAddress)),
      ethCall(vaultAddress, encodeCall(REMAINING_DAILY_SEL, agentAddress)),
      ethCall(vaultAddress, encodeCall(ALLOWED_TARGET_SEL, agentAddress, recipient)),
      ethCall(vaultAddress, encodeCall(ALLOWED_TOKEN_SEL, agentAddress, token)),
      ethCall(token, encodeCall(BALANCE_OF_SEL, vaultAddress)),
    ]);
    const amountBigInt = BigInt(amount);
    const maxPerTransaction = word(policyResult, 0);
    const dailyCap = word(policyResult, 1);
    const active = word(policyResult, 5) !== 0n;
    const expiry = word(policyResult, 4);
    const remainingDailyBudget = word(remainingResult, 0);
    const recipientAllowlisted = word(targetResult, 0) !== 0n;
    const tokenAllowlisted = word(tokenResult, 0) !== 0n;
    const vaultBalance = word(balanceResult, 0);
    const policyValid = active && (expiry === 0n || BigInt(expires_at) <= expiry) && tokenAllowlisted && recipientAllowlisted && amountBigInt <= maxPerTransaction && amountBigInt <= remainingDailyBudget && amountBigInt <= vaultBalance;
    const risk = calculateRisk({amount: amountBigInt, maxPerTransaction, remainingDailyBudget, recipientAllowlisted, tokenAllowlisted, knownContract: recipientAllowlisted, unusualVelocity: false, category});
    const decision = !policyValid ? "blocked" : risk.recommendation === "block" ? "blocked" : risk.recommendation === "human_approval" ? "requires_approval" : "approved";
    const reason = !active ? "agent not active" : expiry !== 0n && BigInt(expires_at) > expiry ? "policy expires before intent" : !tokenAllowlisted ? "token not allowlisted" : !recipientAllowlisted ? "target not allowlisted" : amountBigInt > maxPerTransaction ? "exceeds maxPerTx" : amountBigInt > remainingDailyBudget ? "exceeds dailyCap" : amountBigInt > vaultBalance ? "insufficient vault balance" : decision === "requires_approval" ? "risk requires human approval" : decision === "blocked" ? "critical risk" : "within policy";
    const intentId = `intent_${crypto.randomUUID()}`;
    const actionId = randomBytes32();
    const intent = await base44.asServiceRole.entities.SpendIntent.create({vault_id, agent_id, intent_type, description: description.trim(), token: token.toLowerCase(), amount, recipient: recipient.toLowerCase(), category, merchant_id, metadata: metadata ?? {}, expires_at: new Date(expires_at * 1000).toISOString(), status: decision, action_id: actionId, validation_errors: policyValid ? [] : [reason]});
    const assessment = await base44.asServiceRole.entities.RiskAssessment.create({vault_id, intent_id: intent.id ?? intentId, algorithm_version: risk.algorithm_version, score: risk.score, level: risk.level, factors: risk.factors, recommendation: risk.recommendation, created_at_chain_time: new Date().toISOString()});
    let approval;
    if (decision === "requires_approval") {
      approval = await base44.asServiceRole.entities.ApprovalRequest.create({vault_id, intent_id: intent.id ?? intentId, agent_id, approval_nonce: randomBytes32(), status: "pending", expires_at: new Date(expires_at * 1000).toISOString()});
    }
    return Response.json({ok: true, intent, risk_assessment: assessment, approval_request: approval ?? null, decision, decision_reason: reason, policy_snapshot: {max_per_transaction: maxPerTransaction.toString(), daily_cap: dailyCap.toString(), remaining_daily: remainingDailyBudget.toString(), vault_balance: vaultBalance.toString()}});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ok: false, error: message}, {status: 500});
  }
});
