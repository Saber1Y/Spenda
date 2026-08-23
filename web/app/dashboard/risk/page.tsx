"use client";

import {RISK_POLICY, riskLevel} from "@/lib/riskPolicy";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";

const CATEGORY_ROWS = Object.entries(RISK_POLICY.categoryWeights);

export default function RiskPage() {
  return <div className="max-w-[900px] px-8 py-8">
    <div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Risk policy</h1>
      <p className="mt-1 text-[15px] text-fog">Deterministic intent scoring - the same code runs server-side and here, so every decision is reproducible.</p></div>

    <div className="mt-8"><Panel title={`Intent scoring policy v${RISK_POLICY.version}`} subtitle="deterministic and open">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><span className="text-caption text-fog">Human approval threshold</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">score &ge; {RISK_POLICY.humanApprovalScoreMin}/100 escalates to the Approvals page</p></div>
        <div><span className="text-caption text-fog">Repeat spend today</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">+{RISK_POLICY.repeatSpendTodayPenalty} points</p></div>
        <div><span className="text-caption text-fog">Unknown vendor</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">+{RISK_POLICY.unknownVendorPenalty} points</p></div>
        <div><span className="text-caption text-fog">Amount bands</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">{RISK_POLICY.amountBands.map((b) => `≤${b.maxUsdt === Infinity ? "∞" : b.maxUsdt}$: +${b.score}`).join("  ")}</p></div>
      </div>
      <div className="mt-5">
        <span className="text-caption text-fog">Category baseline weights</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORY_ROWS.map(([category, weight]) => <Chip key={category} tone={riskLevel(weight + 25) === "LOW" ? "mint" : riskLevel(weight + 25) === "HIGH" ? "blush" : "lavender"}>{category}: {weight}</Chip>)}
        </div>
      </div>
      <p className="mt-5 text-caption text-fog">The on-chain fence (per-tx caps, daily caps, expiry, vendor/token allowlists) is enforced by the vault contract no matter what this score says. Scoring only decides who confirms: the machine, or a human.</p>
    </Panel></div>
  </div>;
}
