"use client";

import {useEffect, useState} from "react";
import {useAccount, useWalletClient} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {MERCHANTS} from "@/lib/merchants";
import {parseSpendCommand} from "@/lib/nlParse";
import {runUserSpend, describeSpendError, type UserSpendOutcome} from "@/lib/userSpend";
import {friendlyErrorFrom} from "@/lib/errorMessages";
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
  const [agents, setAgents] = useState<MyAgent[]>([]);
  const [command, setCommand] = useState("");
  const [commandError, setCommandError] = useState("");
  // Restore last execution result from localStorage so navigating away
  // during the bundler poll doesn't silently lose the outcome.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return {kind: "idle"};
    try {
      const raw = localStorage.getItem("spenda:lastCommerceResult");
      if (!raw) return {kind: "idle"};
      const parsed = JSON.parse(raw) as Phase;
      if (parsed.kind === "done") return parsed;
    } catch {}
    return {kind: "idle"};
  });

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

  const createIntent = async (body: Record<string, unknown>) => {
    if (!agentId) return;
    setPhase({kind: "deciding"});
    setCommandError("");
    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({agent: agentId, ...body}),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? payload?.message ?? "intent_failed");
      const {intent, policySnapshot} = payload as {intent: Intent; policySnapshot: PolicySnapshot};
      if (intent.decision === "human_approval") savePendingApproval(intent);
      setPhase({kind: "intent", intent, policy: policySnapshot});
    } catch (error) {
      setCommandError(friendlyErrorFrom(error));
      setPhase({kind: "idle"});
      localStorage.removeItem("spenda:lastCommerceResult");
    }
  };

  const requestPurchase = (merchantId: string) => void createIntent({merchantId});

  const submitCommand = () => {
    const parsed = parseSpendCommand(command);
    if (!parsed) {
      setCommandError("Could not read that. Name a purchase - try \"renew spotify\", \"buy gpu compute for $3\" or \"pay the market data agent\".");
      return;
    }
    if (parsed.merchantId) void createIntent({merchantId: parsed.merchantId});
    else void createIntent({amountBaseUnits: parsed.amountBaseUnits, category: parsed.category, label: parsed.label, vendor: active.vendor});
  };

  const executeApproved = async (intent: Intent) => {
    if (!wallet) return;
    setPhase((p) => ({...(p as Extract<Phase, {kind: "intent"}>), kind: "executing"}));
    try {
      const outcome = await runUserSpend(wallet.signMessage.bind(wallet), intent.agent, intent.amount, intent.recipient, intent.actionId);
      rememberIntentMeta(intent);
      const done: Phase = {kind: "done", outcome, intent};
      localStorage.setItem("spenda:lastCommerceResult", JSON.stringify(done));
      setPhase(done);
    } catch (error) {
      const done: Phase = {kind: "done", outcome: {ok: false, error: "wallet_error", message: friendlyErrorFrom(error)}, intent};
      localStorage.setItem("spenda:lastCommerceResult", JSON.stringify(done));
      setPhase(done);
    }
  };

  const busy = phase.kind === "deciding" || phase.kind === "executing";

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

    <div className="mt-6">
      <Panel title="What should the agent buy?" subtitle="plain English - parsed on your device, decided by your on-chain policy">
        <div className="flex gap-2">
          <input
            className="w-full rounded-[10px] border border-ash bg-bone px-4 py-2.5 text-body-sm text-obsidian"
            placeholder='Try: "renew my domain" - "buy ai credits for $4" - "pay the market data agent"'
            value={command}
            onChange={(event) => {
              setCommand(event.target.value);
              setCommandError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && command.trim() && !busy) submitCommand();
            }}
          />
          <Button variant="primary" size="sm" onClick={submitCommand} disabled={!command.trim() || !agentId || busy}>
            {busy ? "Checking..." : "Get approval"}
          </Button>
        </div>
        {commandError && <p className="mt-2 text-caption text-blush-signal">{commandError}</p>}
      </Panel>
    </div>

    {phase.kind === "intent" && <DecisionCard phase={phase} onExecute={() => executeApproved(phase.intent)} busy={false} />}
    {phase.kind === "executing" && <p className="mt-6 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">Signing and submitting the sponsored payment - stay on this page until you see the result (usually under 30 seconds, never more than 2 minutes).</p>}
    {phase.kind === "done" && <DoneCard phase={phase} onReset={() => { localStorage.removeItem("spenda:lastCommerceResult"); setPhase({kind: "idle"}); }} />}

    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {MERCHANTS.map((merchant) => (
        <Panel key={merchant.merchantId} title={merchant.name} subtitle={merchant.category}>
          <p className="text-body-sm text-fog">{merchant.description}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[15px] tabular-nums text-aubergine">{(Number(merchant.priceBaseUnits) / 1_000_000).toFixed(2)} USDT</span>
            <Button variant="primary" size="sm" onClick={() => requestPurchase(merchant.merchantId)} disabled={!agentId || !address || busy}>
              {busy ? "Checking policy..." : "Create intent"}
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
    <p className="mt-3 text-body-sm text-fog">{friendlyDecisionReason(intent.decisionReason)}. No funds moved yet.</p>
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

/** Expand terse contract fence strings into sentences. */
function friendlyDecisionReason(reason: string): string {
  const map: Record<string, string> = {
    "Agent policy is inactive": "This agent's policy is inactive",
    "Agent policy has expired": "This agent's policy has expired - create a new agent or extend it on the Agents page",
    "Exceeds daily cap": "The purchase would push this agent past its daily cap",
  };
  const exact = map[reason];
  if (exact) return exact;
  if (/^Exceeds maxPerTx/.test(reason)) return `The amount is above this agent's per-transaction limit (${reason.replace(/^Exceeds maxPerTx \(/, "").replace(/\)$/, "")})`;
  if (/not allowlisted/i.test(reason)) return reason.replace("token not allowlisted", "that token is not allowlisted for this agent").replace("target not allowlisted", "that vendor is not allowlisted for this agent");
  return reason;
}
