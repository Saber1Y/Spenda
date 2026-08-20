export const INTENT_TYPES = ["purchase", "transfer", "service", "agent_payment", "rwa_purchase"] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export const INTENT_STATUSES = [
  "draft",
  "submitted",
  "validated",
  "blocked",
  "requires_approval",
  "approved",
  "rejected",
  "expired",
  "executing",
  "executed",
  "failed",
] as const;
export type IntentStatus = (typeof INTENT_STATUSES)[number];

export type Address = string;

export interface SpendIntent {
  id: string;
  vaultId: string;
  agentId: string;
  intentType: IntentType;
  description: string;
  token: Address;
  amount: string;
  recipient?: Address;
  category?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
  expiresAt: number;
  status: IntentStatus;
  actionId: string;
}

export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RiskFactor {
  code: string;
  label: string;
  points: number;
  evidence: string;
}

export interface RiskAssessment {
  algorithmVersion: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  recommendation: "automatic" | "policy_dependent" | "human_approval" | "block";
}

export interface RiskInput {
  amount: bigint;
  maxPerTransaction: bigint;
  remainingDailyBudget: bigint;
  recipientAllowlisted: boolean;
  tokenAllowlisted: boolean;
  knownContract: boolean;
  unusualVelocity: boolean;
  category?: string;
}

export const RISK_ALGORITHM_VERSION = "v1";

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isPositiveInteger(value: string): boolean {
  return /^[1-9][0-9]*$/.test(value);
}

export function validateSpendIntent(intent: Partial<SpendIntent>, nowSeconds: number): IntentValidationResult {
  const errors: string[] = [];

  if (!intent.id) errors.push("id is required");
  if (!intent.vaultId) errors.push("vaultId is required");
  if (!intent.agentId) errors.push("agentId is required");
  if (!intent.description?.trim()) errors.push("description is required");
  if (!intent.intentType || !INTENT_TYPES.includes(intent.intentType)) errors.push("intentType is invalid");
  if (!intent.token || !isAddress(intent.token)) errors.push("token must be a valid address");
  if (!intent.amount || !isPositiveInteger(intent.amount)) errors.push("amount must be a positive integer string");
  if (intent.recipient !== undefined && !isAddress(intent.recipient)) errors.push("recipient must be a valid address");
  const expiresAt = intent.expiresAt;
  if (!Number.isSafeInteger(expiresAt) || expiresAt === undefined || expiresAt <= nowSeconds) errors.push("expiresAt must be in the future");
  if (Number.isSafeInteger(expiresAt) && expiresAt !== undefined && expiresAt > nowSeconds + 24 * 60 * 60) {
    errors.push("expiresAt cannot be more than 24 hours away");
  }
  if (!intent.actionId || !/^0x[0-9a-fA-F]{64}$/.test(intent.actionId)) errors.push("actionId must be a 32-byte hex value");

  return {valid: errors.length === 0, errors};
}

function amountPoints(amount: bigint, maxPerTransaction: bigint): number {
  if (maxPerTransaction <= 0n) return 30;
  const utilization = (amount * 100n) / maxPerTransaction;
  if (utilization >= 90n) return 25;
  if (utilization >= 50n) return 15;
  if (utilization >= 10n) return 5;
  return 0;
}

function budgetPoints(amount: bigint, remainingDailyBudget: bigint): number {
  if (remainingDailyBudget <= 0n || amount >= remainingDailyBudget) return 20;
  const utilization = (amount * 100n) / remainingDailyBudget;
  if (utilization >= 90n) return 15;
  if (utilization >= 50n) return 8;
  if (utilization >= 10n) return 3;
  return 0;
}

export function calculateRisk(input: RiskInput): RiskAssessment {
  const factors: RiskFactor[] = [];
  const add = (code: string, label: string, points: number, evidence: string) => {
    if (points > 0) factors.push({code, label, points, evidence});
  };

  add("amount", "Amount utilization", amountPoints(input.amount, input.maxPerTransaction), "Amount relative to the agent transaction limit");
  add("new_recipient", "New recipient", input.recipientAllowlisted ? 0 : 25, input.recipientAllowlisted ? "Recipient is allowlisted" : "Recipient is not allowlisted");
  add("unknown_token", "Unknown token", input.tokenAllowlisted ? 0 : 25, input.tokenAllowlisted ? "Token is allowlisted" : "Token is not allowlisted");
  add("unknown_contract", "Unknown contract", input.knownContract ? 0 : 30, input.knownContract ? "Contract is known" : "Contract is not recognized");
  add("velocity", "Unusual spending velocity", input.unusualVelocity ? 15 : 0, input.unusualVelocity ? "Recent spending velocity is unusual" : "Spending velocity is normal");
  add("budget_utilization", "Budget utilization", budgetPoints(input.amount, input.remainingDailyBudget), "Amount relative to remaining daily budget");
  add("rwa_category", "RWA category", input.category === "rwa" || input.category === "real_world_asset" ? 10 : 0, "RWA purchases receive additional review weight");

  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  const level = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const recommendation = level === "critical" ? "block" : level === "high" ? "human_approval" : level === "medium" ? "policy_dependent" : "automatic";

  return {algorithmVersion: RISK_ALGORITHM_VERSION, score, level, factors, recommendation};
}
