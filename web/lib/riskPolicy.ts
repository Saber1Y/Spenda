/**
 * Deterministic intent risk scoring - the same code runs on the server
 * (/api/intent) and renders in the dashboard, so judges can read exactly why a
 * spend was auto-approved, escalated to a human, or blocked.
 *
 * The on-chain policy fence (caps, expiry, allowlists) is enforced by the vault
 * contract regardless of this score; scoring only decides WHO gets to confirm:
 * machine-auto vs human approval.
 */

export const RISK_POLICY = {
  version: 1,
  /** Category baseline weights. */
  categoryWeights: {saas: 10, ai: 15, compute: 20, agent: 30, rwa: 45, marketplace: 25} as Record<string, number>,
  defaultCategoryWeight: 20,
  /** Amount bands relative to nothing absolute - absolute USDT per transaction. */
  amountBands: [
    {maxUsdt: 5, score: 0},
    {maxUsdt: 20, score: 10},
    {maxUsdt: Infinity, score: 25},
  ],
  repeatSpendTodayPenalty: 10,
  unknownVendorPenalty: 15,
  /** Score at or above which a human must approve before execution. */
  humanApprovalScoreMin: 40,
} as const;

export interface ScoreInput {
  amountBaseUnits: bigint;
  spentTodayBaseUnits: bigint;
  category: string;
  knownVendor: boolean;
}

export function scoreIntent(input: ScoreInput): number {
  let score = RISK_POLICY.categoryWeights[input.category] ?? RISK_POLICY.defaultCategoryWeight;
  const usdt = Number(input.amountBaseUnits) / 1e6;
  for (const band of RISK_POLICY.amountBands) {
    if (usdt <= band.maxUsdt) {
      score += band.score;
      break;
    }
  }
  if (input.spentTodayBaseUnits > 0n) score += RISK_POLICY.repeatSpendTodayPenalty;
  if (!input.knownVendor) score += RISK_POLICY.unknownVendorPenalty;
  return Math.max(0, Math.min(100, score));
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function riskLevel(score: number): RiskLevel {
  if (score < 25) return "LOW";
  if (score < 60) return "MEDIUM";
  return "HIGH";
}
