export interface Intent {
  intentId: string;
  actionId: string;
  agent: string;
  token: string;
  amount: string;
  recipient: string;
  category: string;
  label: string;
  expiresAt: number;
  decision: "approved" | "blocked" | "human_approval";
  decisionReason: string;
  riskScore: number | null;
  riskLevel: string | null;
}

export interface PolicySnapshot {
  maxPerTxUsdt: number;
  dailyCapUsdt: number;
  spentTodayUsdt: number;
  remainingTodayUsdt: number;
}
