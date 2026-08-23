"use client";

import {useEffect, useState} from "react";
import {useAccount, useWalletClient} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {MERCHANTS} from "@/lib/merchants";
import {runUserSpend, describeSpendError, type UserSpendOutcome} from "@/lib/userSpend";
import {savePendingApproval, rememberIntentMeta, loadMyAgents, type MyAgent} from "@/lib/intentStore";
import type {Intent, PolicySnapshot} from "@/lib/intentTypes";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";

type Phase = {kind: "idle"} | {kind: "deciding"} | {kind: "intent"; intent: Intent; policy: PolicySnapshot} | {kind: "executing"; intent: Intent; policy: PolicySnapshot} | {kind: "done"; outcome: UserSpendOutcome; intent: Intent};

export default function CommercePage() {
  const active = getActiveContracts();
  const {address} = useAccount();
  const {data: wallet} = useWalletClient();
  const [agentId, setAgentId] = useState("");
  const [phase, setPhase] = useState<Phase>({kind: "idle"});
  const [agents, setAgents] = useState<MyAgent[]>([]);

  useEffect(() => {
    if (!address || !wallet) return;
    // Candidate paying agents: the user's own created agents (localStorage
    // registry written at creation time) plus the demo pilot agent.
    const candidates = [...loadMyAgents()];
    if (!candidates.some((c) => c.address === active.agent)) {
      candidates.unshift({address: active.agent, name: "Demo pilot agent"});
    }
    setAgents(candidates);
    setAgentId((current) => current || candidates[0]?.address || "");
  }, [address, wallet, active.agent]);

  const requestPurchase = async (merchantId: string) => {
    if (!agentId) return;
    setPhase({kind: "deciding"});
    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({agent: agentId, merchantId}),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Intent failed");
      const {intent, policySnapshot} = payload as {intent: Intent; policySnapshot: PolicySnapshot};
      if (intent.decision === "human_approval") {
        savePendingApproval(intent);
        setPhase({kind: "intent", intent, policy: policySnapshot});
        return;
      }
      setPhase({kind: "intent", intent, policy: policySnapshot});
    } catch (error) {
      setPhase({kind: "done", outcome: {ok: false, error: "intent_failed", message: error instanceof Error ? error.message : String(error)}, intent: {label: "Intent"} as Intent});
    }
  };

  const executeApproved = async (intent: Intent) => {
    if (!wallet) return;
    setPhase((p) => ({...(p as Extract<Phase, {kind: "intent"}>), kind: "executing"}));
    try {
      const outcome = await runUserSpend(wallet.signMessage.bind(wallet), intent.agent, intent.amount, intent.recipient, intent.actionId);
      rememberIntentMeta(intent);
      setPhase((p) => ({...(p as Extract<Phase, {kind: "executing"}>), kind: "done", outcome}));
    } catch (error) {
      setPhase({kind: "done", outcome: {ok: false, error: "wallet_error", message: error instanceof Error ? error.message : String(error)}, intent});
    }
  };

  return <div className="max-w-[1100px] px-8 py-8">
    <div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Spenda Commerce</h1>
      <p className="mt-1 text-[15px] text-fog">Real BOT Chain payment authorization with simulated merchant fulfillment.</p></div>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Chip tone="outline">Merchant Sandbox</Chip>
      <label className="flex items-center gap-2 text-body-sm text-fog">Paying agent
        <select className="rounded-[10px] border border-ash bg-bone px-3 py-2 text-obsidian" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
          {agents.map((agent) => <option key={agent.address} value={agent.address}>{agent.name}</option>)}
        </select>
      </label>
    </div>
    {!address && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">Connect a wallet to create intents. The paying agent must be one you own (or the demo pilot).</p>}

    {phase.kind === "intent" && <DecisionCard phase={phase} onExecute={() => executeApproved(phase.intent)} busy={false} />}
    {phase.kind === "executing" && <p className="mt-6 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">Signing and submitting the sponsored payment...</p>}
    {phase.kind === "done" && <DoneCard phase={phase} onReset={() => setPhase({kind: "idle"})} />}

    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {MERCHANTS.map((merchant) => (
        <Panel key={merchant.merchantId} title={merchant.name} subtitle={merchant.category}>
          <p className="text-body-sm text-fog">{merchant.description}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[15px] tabular-nums text-aubergine">{(Number(merchant.priceBaseUnits) / 1_000_000).toFixed(2)} USDT</span>
            <Button variant="primary" size="sm" onClick={() => requestPurchase(merchant.merchantId)} disabled={!agentId || !address || phase.kind === "deciding" || phase.kind === "executing"}>
              {phase.kind === "deciding" ? "Checking policy..." : "Create intent"}
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  </div>;
}

function DecisionCard({phase, onExecute, busy}: {phase: Extract<Phase, {kind: "intent"}>; onExecute: () => void; busy: boolean}) {
  const {intent, policy} = phase;
  const tone = intent.decision === "approved" ? "mint" : intent.decision === "blocked" ? "blush" : "lavender";
  const usedPct = Math.min(100, Math.round((policy.spentTodayUsdt / Math.max(policy.dailyCapUsdt, 0.01)) * 100));
  return <Panel title="Policy decision" subtitle={intent.label}>
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone={tone}>{intent.decision.replace("_", " ")}</Chip>
      {intent.riskScore !== null && <Chip tone={intent.riskLevel === "LOW" ? "mint" : intent.riskLevel === "HIGH" ? "blush" : "lavender"}>risk {intent.riskScore}/100</Chip>}
    </div>
    <p className="mt-3 text-body-sm text-fog">{intent.decisionReason}. No funds moved yet.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div><span className="text-caption text-fog">Amount</span><p className="text-body-sm tabular-nums text-obsidian">{(Number(intent.amount) / 1e6).toFixed(2)} USDT</p></div>
      <div><span className="text-caption text-fog">Recipient</span><p className="text-body-sm text-obsidian">{truncate(intent.recipient)}</p></div>
      <div><span className="text-caption text-fog">Daily budget used</span><p className="text-body-sm tabular-nums text-obsidian">{policy.spentTodayUsdt.toFixed(2)} / {policy.dailyCapUsdt.toFixed(2)} USDT ({usedPct}%)</p></div>
      <div><span className="text-caption text-fog">Max per transaction</span><p className="text-body-sm tabular-nums text-obsidian">{policy.maxPerTxUsdt.toFixed(2)} USDT</p></div>
    </div>
    {intent.decision === "approved" && <Button className="mt-5" variant="primary" size="sm" onClick={onExecute} disabled={busy}>Sign &amp; pay now</Button>}
    {intent.decision === "human_approval" && <p className="mt-5 text-body-sm text-aubergine">Queued for human approval - find it on the Approvals page.</p>}
  </Panel>;
}

function DoneCard({phase, onReset}: {phase: Extract<Phase, {kind: "done"}>; onReset: () => void}) {
  const {outcome} = phase;
  return <Panel title="Execution result" subtitle={outcome.status === "included" && outcome.success ? "payment settled" : undefined}>
    {outcome.status === "included" && outcome.success && <p className="text-body-sm text-mint-signal">Payment executed. Receipt emitted on-chain.{outcome.txHash ? ` tx ${outcome.txHash.slice(0, 14)}...` : ""}</p>}
    {outcome.status === "included" && !outcome.success && <p className="text-body-sm text-obsidian">Blocked by the on-chain fence{outcome.reason ? `: ${outcome.reason}` : "."}</p>}
    {outcome.ok === false && <p className="text-body-sm text-obsidian">{describeSpendError(outcome)}</p>}
    {outcome.status === "timeout" && <p className="text-body-sm text-fog">Submitted but not yet included - check BOTScan shortly.</p>}
    <Button className="mt-4" variant="secondary" size="sm" onClick={onReset}>New purchase</Button>
  </Panel>;
}

const truncate = (value: string) => value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
