"use client";

import {useEffect, useMemo, useState} from "react";

type ScenarioId = "spotify" | "agent" | "rwa" | "blocked";
type PathKind = "auto" | "human" | "block";
type StageId =
  | "user"
  | "vault"
  | "agent"
  | "intent"
  | "budget"
  | "policy"
  | "risk"
  | "decision"
  | "auto"
  | "human"
  | "block"
  | "approval"
  | "execution"
  | "paymaster"
  | "chain"
  | "destination"
  | "receipt"
  | "audit";

type Tone = "violet" | "blue" | "indigo" | "purple" | "green" | "amber" | "orange" | "teal";

type Scenario = {
  label: string;
  agentName: string;
  intent: string;
  request: string;
  budget: string;
  remaining: string;
  risk: number;
  path: PathKind;
  destination: {kind: "merchant" | "agent" | "service" | "rwa"; label: string; example: string};
  receipt: string;
  receiptStatus: string;
};

const SCENARIOS: Record<ScenarioId, Scenario> = {
  spotify: {
    label: "Spotify Renewal",
    agentName: "Personal Agent",
    intent: "Renew Spotify if under $15",
    request: "$11.99 USDT",
    budget: "$100 / day",
    remaining: "$64",
    risk: 12,
    path: "auto",
    destination: {kind: "merchant", label: "Merchant", example: "Spotify"},
    receipt: "Spotify Renewal",
    receiptStatus: "Executed",
  },
  agent: {
    label: "Agent Payment",
    agentName: "Research Agent",
    intent: "Purchase market data",
    request: "$5 USDT",
    budget: "$100 / day",
    remaining: "$77",
    risk: 18,
    path: "auto",
    destination: {kind: "agent", label: "Another Agent", example: "Market Data Agent"},
    receipt: "Agent to Agent",
    receiptStatus: "Settled",
  },
  rwa: {
    label: "RWA Purchase",
    agentName: "Procurement Agent",
    intent: "Purchase tokenized invoice",
    request: "$180 USDT",
    budget: "$500 / day",
    remaining: "$320",
    risk: 68,
    path: "human",
    destination: {kind: "rwa", label: "RWA", example: "Tokenized Asset"},
    receipt: "Tokenized Invoice",
    receiptStatus: "Human Approved",
  },
  blocked: {
    label: "Policy Violation",
    agentName: "Personal Agent",
    intent: "Spend above the daily limit",
    request: "$500 USDT",
    budget: "$100 / day",
    remaining: "$100",
    risk: 92,
    path: "block",
    destination: {kind: "service", label: "Service", example: "AI API Credits"},
    receipt: "Blocked Request",
    receiptStatus: "Nothing moved",
  },
};

const BASE_STAGES: StageId[] = ["user", "vault", "agent", "intent", "budget", "policy", "risk", "decision"];

function stagesFor(path: PathKind): StageId[] {
  if (path === "human") return [...BASE_STAGES, "human", "approval", "execution", "paymaster", "chain", "destination", "receipt"];
  if (path === "block") return [...BASE_STAGES, "block", "audit"];
  return [...BASE_STAGES, "auto", "execution", "paymaster", "chain", "destination", "receipt"];
}

const DETAIL: Record<string, {title: string; body: string}> = {
  user: {title: "User", body: "Your EOA owns the funds and permissions. The private key never leaves your wallet."},
  vault: {title: "Spenda Vault", body: "The vault holds user funds and enforces the policy boundary before any token moves."},
  agent: {title: "AI Agent", body: "The agent has its own identity and requests economic actions. It holds no user funds."},
  intent: {title: "Spending Intent", body: "Natural-language intent becomes a structured request with a token, recipient, amount, and action."},
  budget: {title: "Agent Budget", body: "Per-transaction and daily limits constrain what this identity can ask the vault to spend."},
  policy: {title: "Policy Check", body: "Spenda checks the token, recipient, budget, and whether the agent is still active."},
  risk: {title: "Risk Engine", body: "Amount, recipient, contract, velocity, budget utilization, and agent history contribute to the score."},
  decision: {title: "Spenda Decision", body: "The policy result routes the request to automatic approval, human approval, or a permanent block record."},
  approval: {title: "Human Approval", body: "The user signs one specific request. Approval never grants the agent unrestricted access."},
  execution: {title: "ERC-4337 Execution", body: "An authorized UserOperation executes through account abstraction without exposing the user's EOA."},
  paymaster: {title: "Spenda Paymaster", body: "The paymaster sponsors BOT gas so the agent does not need to hold native funds."},
  chain: {title: "BOT Chain", body: "The authorized operation settles on BOT Chain mainnet and produces a chain-derived receipt."},
  destination: {title: "Destination", body: "The approved transfer can reach a merchant, another agent, a service, or a tokenized real-world asset."},
  receipt: {title: "Spending Receipt", body: "Every decision and execution leaves an auditable record with the amount, risk, status, and transaction hash."},
  audit: {title: "Blocked Audit", body: "A rejected request still produces evidence. No token moves and no execution path is opened."},
};

const ARCHITECTURE = [
  ["Agent Identity", "A dedicated account gives every autonomous actor a traceable on-chain identity."],
  ["Intent", "A natural-language goal becomes a bounded economic request."],
  ["Policy", "Caps, expiries, tokens, and recipients are stored as enforceable rules."],
  ["Risk", "Spenda evaluates the request context before authorization."],
  ["Authorization", "The result is auto-approved, routed to a human, or blocked."],
  ["ERC-4337", "Account abstraction executes the authorized operation."],
  ["Paymaster", "Gas sponsorship keeps native BOT away from the agent."],
  ["BOT Chain", "Settlement and receipts are written on-chain."],
] as const;

function Icon({name}: {name: string}) {
  const common = {fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const};
  const paths: Record<string, React.ReactNode> = {
    user: <><circle cx="12" cy="8" r="3" {...common}/><path d="M5 20c.8-3.4 3.1-5 7-5s6.2 1.6 7 5" {...common}/></>,
    vault: <><path d="M4 10h16v9H4z" {...common}/><path d="M3 10 12 4l9 6" {...common}/><path d="M9 14h6M12 14v3" {...common}/></>,
    agent: <><rect x="5" y="7" width="14" height="11" rx="3" {...common}/><path d="M9 12h.01M15 12h.01M9 15h6M12 4v3M3 11h2M19 11h2" {...common}/></>,
    intent: <><circle cx="11" cy="11" r="6" {...common}/><path d="m16 16 4 4M11 8v6M8 11h6" {...common}/></>,
    budget: <><path d="M4 17a8 8 0 1 1 16 0" {...common}/><path d="M12 17v-5M8 21h8" {...common}/></>,
    policy: <><path d="M4 7h16M4 12h16M4 17h16" {...common}/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="11" cy="17" r="2" fill="currentColor" stroke="none"/></>,
    risk: <><path d="M4 17c2-7 5-10 8-10 2.5 0 4 2 8 2" {...common}/><path d="M4 20h16M7 17h.01M12 12h.01M17 9h.01" {...common}/></>,
    decision: <><path d="M5 5v14M5 8h6v4h8M5 16h6v-4" {...common}/><circle cx="19" cy="8" r="1.5" fill="currentColor"/><circle cx="19" cy="16" r="1.5" fill="currentColor"/></>,
    approval: <><circle cx="10" cy="8" r="3" {...common}/><path d="M4 20c.7-3.4 2.7-5 6-5 1.7 0 3 .4 4 1.2M16 12v6l3-2 2 2V12a3 3 0 0 0-5.8-1" {...common}/></>,
    execution: <><rect x="5" y="5" width="14" height="14" rx="2" {...common}/><path d="M9 9h6v6H9zM2 9h3M19 9h3M9 2v3M15 19v3" {...common}/></>,
    paymaster: <><path d="m13 2-8 11h6l-1 9 8-12h-6z" {...common}/></>,
    chain: <><circle cx="7" cy="12" r="3" {...common}/><circle cx="17" cy="12" r="3" {...common}/><path d="M10 12h4" {...common}/></>,
    merchant: <><path d="M4 10h16l-2-5H6zM5 10v9h14v-9M9 19v-5h6v5" {...common}/></>,
    service: <><path d="M5 6h14v12H5zM8 10h8M8 14h5" {...common}/></>,
    rwa: <><path d="m4 10 8-6 8 6v9H4zM8 19v-5h8v5M9 10h6" {...common}/></>,
    receipt: <><path d="M6 4h12v16l-3-2-3 2-3-2-3 2z" {...common}/><path d="m9 12 2 2 4-4M9 8h6" {...common}/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{paths[name] ?? paths.intent}</svg>;
}

function toneClasses(tone: Tone) {
  const map: Record<Tone, string> = {
    violet: "bg-[#f6f3ff] text-[#7564bf]",
    blue: "bg-[#eff6ff] text-[#4779bd]",
    indigo: "bg-[#eff1ff] text-[#5863be]",
    purple: "bg-[#f8f1ff] text-[#9164bd]",
    green: "bg-[#edf9f2] text-[#299b61]",
    amber: "bg-[#fff7e8] text-[#bf7d1c]",
    orange: "bg-[#fff1e8] text-[#d66b31]",
    teal: "bg-[#eaf8f6] text-[#258b84]",
  };
  return map[tone];
}

function Connector({state, tone}: {state: "idle" | "active" | "done"; tone?: "amber" | "red"}) {
  return <div className="fconn" data-state={state} data-tone={tone} aria-hidden="true"><span className="fdot" /></div>;
}

function Node({
  id,
  label,
  description,
  badge,
  footnote,
  tone,
  icon,
  state,
  muted,
  onClick,
}: {
  id: StageId;
  label: string;
  description: string;
  badge?: string;
  footnote?: React.ReactNode;
  tone: Tone;
  icon: string;
  state: "idle" | "current" | "done";
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="fnode shrink-0" data-state={state} data-muted={muted} onClick={onClick} aria-label={`Inspect ${label}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${toneClasses(tone)}`}><Icon name={icon} /></span>
        {badge ? <span className="max-w-[90px] truncate rounded-full bg-[#f5f5f3] px-2 py-1 font-mono text-[10px] text-[#77757c]">{badge}</span> : null}
      </div>
      <p className="mt-3 font-heading text-[16px] font-semibold leading-tight text-obsidian">{label}</p>
      <p className="mt-1 text-[12px] leading-[1.35] text-fog">{description}</p>
      {footnote ? <div className="mt-3 border-t border-black/[0.06] pt-2 text-[11px] leading-[1.35] text-obsidian">{footnote}</div> : null}
    </button>
  );
}

function outcomeClasses(path: PathKind, active: boolean) {
  if (!active) return "border-black/[0.07] bg-white text-[#8b8990]";
  if (path === "auto") return "border-[#b7e4c9] bg-[#edf9f2] text-[#238952]";
  if (path === "human") return "border-[#f0d399] bg-[#fff7e8] text-[#a96d12]";
  return "border-[#f0b9b9] bg-[#fff1f1] text-[#bd3f3f]";
}

function DecisionNode({scenario, state, onClick}: {scenario: Scenario; state: "idle" | "current" | "done"; onClick: () => void}) {
  const active = scenario.path;
  return (
    <div className="flex w-[224px] shrink-0 flex-col gap-3">
      <button type="button" className="fnode w-full" data-state={state} onClick={onClick}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-obsidian text-base-orange"><Icon name="decision" /></span>
          <span className="rounded-full bg-base-orange-light px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-base-orange">Decision</span>
        </div>
        <p className="mt-3 font-heading text-[16px] font-semibold leading-tight text-obsidian">Spenda Decision</p>
        <p className="mt-1 text-[12px] leading-[1.35] text-fog">What happens next?</p>
      </button>
      <div className="space-y-1.5 rounded-[16px] border border-black/[0.07] bg-[#f5f5f3] p-2">
        <div className={`rounded-[11px] border px-3 py-2 ${outcomeClasses("auto", active === "auto")}`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em]"><span>Auto approve</span><span>Risk {scenario.path === "auto" ? scenario.risk : 12}</span></div>
          <p className="mt-1 text-[11px]">Low risk · Within policy</p>
        </div>
        <div className={`rounded-[11px] border px-3 py-2 ${outcomeClasses("human", active === "human")}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em]">Human approval</div>
          <p className="mt-1 text-[11px]">Higher value / elevated risk</p>
        </div>
        <div className={`rounded-[11px] border px-3 py-2 ${outcomeClasses("block", active === "block")}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em]">Block</div>
          <p className="mt-1 text-[11px]">Policy violation · Nothing moved</p>
        </div>
      </div>
    </div>
  );
}

function DestinationNode({scenario, state, onClick}: {scenario: Scenario; state: "idle" | "current" | "done"; onClick: () => void}) {
  const icon = scenario.destination.kind === "merchant" ? "merchant" : scenario.destination.kind === "agent" ? "agent" : scenario.destination.kind === "rwa" ? "rwa" : "service";
  return <Node id="destination" label={scenario.destination.label} description="Where value arrives" badge={scenario.destination.example} tone={scenario.destination.kind === "rwa" ? "amber" : "blue"} icon={icon} state={state} onClick={onClick} />;
}

export function ProductFlow() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("spotify");
  const [stageIndex, setStageIndex] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [detail, setDetail] = useState<StageId>("vault");
  const [architectureDetail, setArchitectureDetail] = useState(0);
  const scenario = SCENARIOS[scenarioId];
  const stages = useMemo(() => stagesFor(scenario.path), [scenario.path]);

  useEffect(() => {
    setStageIndex(-1);
    setPlaying(true);
  }, [scenarioId]);

  useEffect(() => {
    if (!playing || stageIndex >= stages.length - 1) return;
    const timer = window.setTimeout(() => setStageIndex((value) => value + 1), 400);
    return () => window.clearTimeout(timer);
  }, [playing, stageIndex, stages.length]);

  const replay = () => {
    setStageIndex(-1);
    setPlaying(true);
  };

  const stateFor = (id: StageId): "idle" | "current" | "done" => {
    const index = stages.indexOf(id);
    if (index < 0 || stageIndex < 0) return "idle";
    if (index === stageIndex) return "current";
    return index < stageIndex ? "done" : "idle";
  };

  const connectorState = (from: StageId, to: StageId): "idle" | "active" | "done" => {
    const target = stages.indexOf(to);
    if (target < 0 || stageIndex < 0) return "idle";
    if (stageIndex === target) return "active";
    return stageIndex > target ? "done" : "idle";
  };

  const node = (id: StageId, props: Omit<Parameters<typeof Node>[0], "id" | "state" | "onClick">) => (
    <Node key={id} id={id} {...props} state={stateFor(id)} onClick={() => setDetail(id)} />
  );

  const flowNodes = [
    node("user", {label: "User", description: "Owns funds & permissions", badge: "EOA", tone: "violet", icon: "user", footnote: <span>Private key never shared</span>}),
    <Connector key="user-vault" state={connectorState("user", "vault")} />,
    node("vault", {label: "Spenda Vault", description: "Holds user funds", badge: "$4.80 USDT · LIVE", tone: "blue", icon: "vault", footnote: <><span className="text-fog">Agent balance:</span> $0</>}),
    <Connector key="vault-agent" state={connectorState("vault", "agent")} />,
    node("agent", {label: "AI Agent", description: "Requests economic actions", badge: "0x45EC…5d60", tone: "indigo", icon: "agent", footnote: <><span className="text-fog">Own address ·</span> $0 balance</>}),
    <Connector key="agent-intent" state={connectorState("agent", "intent")} />,
    node("intent", {label: "Spending Intent", description: "What does the agent want to do?", badge: "INTENT", tone: "purple", icon: "intent", footnote: <><strong>{scenario.intent}</strong><br />{scenario.request}</>}),
    <Connector key="intent-budget" state={connectorState("intent", "budget")} />,
    node("budget", {label: "Agent Budget", description: "How much can this agent spend?", badge: "BUDGET", tone: "green", icon: "budget", footnote: <><span className="flex justify-between"><span>Daily limit</span><strong>{scenario.budget}</strong></span><span className="mt-1 flex justify-between"><span>Remaining</span><strong>{scenario.remaining}</strong></span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#d8eee0]"><span className="block h-full w-[64%] rounded-full bg-[#299b61]" /></span></>}),
    <Connector key="budget-policy" state={connectorState("budget", "policy")} />,
    node("policy", {label: "Policy Check", description: "Is this action allowed?", badge: "4 CHECKS", tone: "amber", icon: "policy", footnote: <span className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]"><span>✓ Token allowed</span><span>✓ Recipient</span><span>✓ Budget</span><span>✓ Agent active</span></span>}),
    <Connector key="policy-risk" state={connectorState("policy", "risk")} />,
    node("risk", {label: "Risk Engine", description: "How risky is this request?", badge: scenario.risk <= 20 ? "LOW" : scenario.risk < 80 ? "ELEVATED" : "HIGH", tone: "orange", icon: "risk", footnote: <><span className="flex items-center justify-between"><span>Risk Score</span><strong>{scenario.risk} / 100</strong></span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#f3ded1]"><span className={`block h-full rounded-full ${scenario.risk > 80 ? "bg-[#d64545]" : scenario.risk > 50 ? "bg-[#d08a1f]" : "bg-[#299b61]"}`} style={{width: `${scenario.risk}%`}} /></span></>}),
    <Connector key="risk-decision" state={connectorState("risk", "decision")} />,
    <DecisionNode key="decision" scenario={scenario} state={stateFor("decision")} onClick={() => setDetail("decision")} />,
  ];

  const tail = scenario.path === "block"
    ? [
        <Connector key="decision-audit" tone="red" state={connectorState("decision", "audit")} />,
        node("audit", {label: "Spending Receipt", description: "Permanent execution record", badge: "BLOCKED", tone: "orange", icon: "receipt", footnote: <><strong>Nothing moved</strong><br /><span className="text-fog">Requested: {scenario.request}</span></>}),
      ]
    : [
        <Connector key="decision-next" tone={scenario.path === "human" ? "amber" : undefined} state={connectorState("decision", scenario.path === "human" ? "human" : "execution")} />,
        ...(scenario.path === "human" ? [node("approval", {label: "Human Approval", description: "User signs this request", badge: "REQUIRED", tone: "amber", icon: "approval", footnote: <><strong>{scenario.request}</strong><br />{scenario.destination.example}<br /><span className="mt-1 inline-flex items-center gap-1 text-fog"><Icon name="lock" /> Private key never shared</span></>}), <Connector key="approval-execution" tone="amber" state={connectorState("approval", "execution")} />] : []),
        node("execution", {label: "ERC-4337 Execution", description: "Execute authorized operation", badge: "UserOperation", tone: "indigo", icon: "execution", muted: false}),
        <Connector key="execution-paymaster" state={connectorState("execution", "paymaster")} />,
        node("paymaster", {label: "Spenda Paymaster", description: "Sponsors gas", badge: "BOT", tone: "teal", icon: "paymaster", footnote: <span>The agent holds no native BOT</span>}),
        <Connector key="paymaster-chain" state={connectorState("paymaster", "chain")} />,
        node("chain", {label: "BOT Chain", description: "On-chain execution", badge: "MAINNET", tone: "blue", icon: "chain"}),
        <Connector key="chain-destination" state={connectorState("chain", "destination")} />,
        <DestinationNode key="destination" scenario={scenario} state={stateFor("destination")} onClick={() => setDetail("destination")} />,
        <Connector key="destination-receipt" state={connectorState("destination", "receipt")} />,
        node("receipt", {label: "Spending Receipt", description: "Permanent execution record", badge: "EXECUTED", tone: "green", icon: "receipt", footnote: <><strong>{scenario.receipt}</strong><br />{scenario.request}<br /><span className="text-fog">Tx: 0x8a…4f</span></>}),
      ];

  return (
    <section id="flow" className="flow-canvas overflow-hidden border-y border-black/[0.06] px-6 py-24 sm:px-10 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.12em] text-base-orange">How Spenda works</p>
            <h2 className="mt-4 max-w-[760px] font-heading text-[clamp(2.25rem,5vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.055em] text-obsidian">Give your agent autonomy.<br /><span className="text-base-orange">Keep control of your money.</span></h2>
            <p className="mt-6 max-w-[650px] text-[17px] leading-7 text-fog">Spenda gives AI agents programmable identities, budgets, and permissions to act on your behalf while your funds remain secured inside a policy-controlled vault.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
            <button type="button" onClick={replay} className="rounded-full px-3 py-2 text-[12px] font-semibold text-obsidian transition hover:bg-[#f1f1ef]">Replay</button>
            <button type="button" onClick={() => setPlaying((value) => !value)} className="rounded-full bg-obsidian px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#35343c]">{playing ? "Pause" : "Play"}</button>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2" role="tablist" aria-label="Product flow scenarios">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={scenarioId === id} onClick={() => setScenarioId(id)} className={`rounded-full border px-4 py-2.5 text-[13px] font-semibold transition ${scenarioId === id ? "border-obsidian bg-obsidian text-white" : "border-black/[0.09] bg-white text-fog hover:border-black/20 hover:text-obsidian"}`}>{SCENARIOS[id].label}</button>
          ))}
          <span className="ml-2 text-[12px] text-fog">{stageIndex >= stages.length - 1 ? "Complete" : playing ? "Flow running" : "Paused"}</span>
        </div>

        <div className="flow-track mt-8 overflow-x-auto rounded-[28px] border border-black/[0.07] bg-[#f5f5f3] p-5 shadow-[0_1px_2px_rgba(30,30,36,.03)] sm:p-8">
          <div className="flex min-w-max items-center gap-0 py-10 pr-10">{flowNodes}{tail}</div>
          {scenario.path === "block" ? <p className="mt-1 border-t border-[#f0b9b9] pt-4 text-[12px] font-medium text-[#bd3f3f]">Blocked path terminates in an audit receipt. ERC-4337 execution is never opened.</p> : null}
        </div>

        <div className="mt-5 min-h-[92px] rounded-[20px] border border-black/[0.07] bg-white p-5 detail-panel-enter">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-base-orange">{DETAIL[detail]?.title ?? "Inspect a stage"}</p>
          <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-fog">{DETAIL[detail]?.body ?? "Click any node to understand the boundary it controls."}</p>
        </div>

        <div className="mt-16 rounded-[28px] border border-black/[0.07] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-caption font-semibold uppercase tracking-[0.1em] text-base-orange">Custody boundary</p>
              <h3 className="mt-3 font-heading text-[28px] font-medium tracking-[-0.04em] text-obsidian">The agent never gets your wallet.</h3>
              <p className="mt-3 max-w-[550px] text-[14px] leading-6 text-fog">Your private key stays in the user wallet. The agent has an address and a request path, not custody of your money.</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-center">
              <div className="rounded-[16px] border border-[#e4def8] bg-[#f6f3ff] px-4 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7564bf]">User wallet</p><p className="mt-1 text-[12px] text-fog">Private key</p></div>
              <div className="flex flex-col items-center text-[#d64545]"><span className="text-[20px] leading-none">×</span><span className="text-[10px] uppercase tracking-[0.08em]">never shared</span></div>
              <div className="rounded-[16px] border border-[#eff1ff] bg-[#eff1ff] px-4 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5863be]">AI agent</p><p className="mt-1 text-[12px] text-fog">Own address · $0</p></div>
              <div className="text-[#299b61]">→</div>
              <div className="rounded-[16px] border border-[#d7ebff] bg-[#eff6ff] px-4 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4779bd]">Spenda Vault</p><p className="mt-1 text-[12px] text-fog">Policy-controlled execution</p></div>
              <div className="text-[#299b61]">→</div>
              <div className="rounded-[16px] border border-[#d8eee0] bg-[#edf9f2] px-4 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#299b61]">Recipient</p><p className="mt-1 text-[12px] text-fog">Receipt on-chain</p></div>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <div className="flex items-end justify-between gap-4"><div><p className="text-caption font-semibold uppercase tracking-[0.1em] text-base-orange">Technical layer</p><h3 className="mt-3 font-heading text-[28px] font-medium tracking-[-0.04em] text-obsidian">From identity to settlement.</h3></div><span className="hidden text-[12px] text-fog sm:block">Select a layer to inspect it</span></div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{ARCHITECTURE.map(([label], index) => <button type="button" key={label} onClick={() => setArchitectureDetail(index)} className={`flex items-center justify-between rounded-[14px] border px-4 py-3 text-left text-[13px] font-semibold transition ${architectureDetail === index ? "border-base-orange bg-base-orange-light text-obsidian" : "border-black/[0.07] bg-white text-fog hover:border-black/20 hover:text-obsidian"}`}><span>{label}</span><span className="text-base-orange">→</span></button>)}</div>
          <div className="mt-3 rounded-[16px] border border-black/[0.07] bg-white px-5 py-4 text-[13px] leading-6 text-fog"><strong className="text-obsidian">{ARCHITECTURE[architectureDetail][0]}:</strong> {ARCHITECTURE[architectureDetail][1]}</div>
        </div>

        <div className="mt-20 border-t border-black/[0.08] pt-10"><p className="font-heading text-[30px] font-medium tracking-[-0.045em] text-obsidian sm:text-[42px]">Autonomous spending without autonomous custody.</p><p className="mt-4 max-w-[700px] text-[16px] leading-7 text-fog">Every transaction is evaluated, authorized, executed, and recorded on-chain. Agents get autonomy. Users keep custody. Spenda controls the boundary.</p></div>
      </div>
    </section>
  );
}
