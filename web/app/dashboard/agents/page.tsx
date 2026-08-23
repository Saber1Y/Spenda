"use client";

import {useEffect, useState} from "react";
import {parseUnits, type Hex} from "viem";
import {useAccount, usePublicClient, useWalletClient} from "wagmi";
import {getActiveContracts, MUSD_DECIMALS, vaultAbi} from "@/lib/contracts";
import {revokeRestrictedAgent, updateAgentBudget} from "@/lib/createAgent";
import {runUserSpend, describeSpendError, type UserSpendOutcome} from "@/lib/userSpend";
import {rememberMyAgent, loadMyAgents} from "@/lib/intentStore";
import {friendlyErrorFrom} from "@/lib/errorMessages";
import {formatMusd, truncateAddress} from "@/lib/format";
import {explorerAddress} from "@/lib/chain";
import {Chip, CopyChip, TxChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Panel} from "@/components/dashboard/Panel";

interface AgentEntry {
  address: string;
  name: string;
  description?: string;
}

interface PolicyLite {
  active: boolean;
  maxPerTx: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  expirySeconds: number;
}

// Minimal ABI for the restricted account's public immutable owner accessor.
const ownerAbi = [{
  name: "owner",
  type: "function",
  stateMutability: "view",
  inputs: [],
  outputs: [{type: "address"}],
}] as const;

export default function AgentsPage() {
  const active = getActiveContracts();
  const {address, isConnected} = useAccount();
  const {data: wallet} = useWalletClient();
  const publicClient = usePublicClient();
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  // On-chain policy per agent address - the single source of truth.
  const [policies, setPolicies] = useState<Record<string, PolicyLite | null> | null>(null);
  const [owners, setOwners] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const list = [...loadMyAgents()];
    if (!list.some((a) => a.address.toLowerCase() === active.agent.toLowerCase())) {
      list.unshift({address: active.agent, name: "Demo pilot agent", description: "Live pilot restricted account"});
    }
    setAgents(list);
  }, [active.agent]);

  useEffect(() => {
    if (!publicClient || agents.length === 0) return setPolicies((current) => current ?? {});
    let alive = true;
    (async () => {
      const entries = await Promise.all(agents.map(async (agent) => {
        try {
          const policy = await publicClient.readContract({
            address: active.vault,
            abi: vaultAbi,
            functionName: "getPolicy",
            args: [agent.address as `0x${string}`],
          });
          return [agent.address.toLowerCase(), {
            active: policy.active === true,
            maxPerTx: policy.maxPerTx as bigint,
            dailyCap: policy.dailyCap as bigint,
            spentToday: policy.spentToday as bigint,
            expirySeconds: Number(policy.expiry),
          }] as const;
        } catch {
          return [agent.address.toLowerCase(), null] as const;
        }
      }));
      if (alive) setPolicies(Object.fromEntries(entries));
      const ownerEntries = await Promise.all(agents.map(async (agent) => {
        try {
          return [agent.address.toLowerCase(), (await publicClient.readContract({address: agent.address as `0x${string}`, abi: ownerAbi, functionName: "owner"})) as `0x${string}`] as const;
        } catch {
          return [agent.address.toLowerCase(), ""] as const;
        }
      }));
      if (alive) setOwners(Object.fromEntries(ownerEntries));
    })();
    return () => {
      alive = false;
    };
  }, [agents, publicClient, active.vault]);

  const visibleAgents = agents.filter((agent) => policies?.[agent.address.toLowerCase()]?.active === true);

  const refreshPolicies = () => setPolicies(null);

  const create = async (input: {name: string; description: string; max: string; daily: string; days: string; salt: string; capabilities: string; vendor: string}) => {
    if (!wallet || !address) return setMessage("Connect your wallet first.");
    setBusy(true);
    try {
      const maxVal = Number(input.max);
      const dailyVal = Number(input.daily);
      if (!(maxVal > 0) || maxVal > 10) throw new Error("Max per transaction must be between 0 and 10 USDT.");
      if (!(dailyVal >= maxVal) || dailyVal > 25) throw new Error("Daily cap must be at least the per-tx cap and at most 25 USDT.");
      const salt = BigInt(input.salt || "0").toString();
      const daysNum = String(Math.max(1, Math.min(365, Math.floor(Number(input.days || "30")))));
      const vendor = input.vendor;
      // Message must match the server-side provisioning message byte-for-byte.
      const messageText = [
        "Spenda agent provisioning",
        "chainId: 677",
        `owner: ${address.toLowerCase()}`,
        `salt: ${salt}`,
        `maxPerTxUsdt: ${input.max}`,
        `dailyCapUsdt: ${input.daily}`,
        `expiryDays: ${daysNum}`,
        `vendor: ${vendor.toLowerCase()}`,
      ].join("\n");
      const signature = await wallet.signMessage({message: messageText});
      const response = await fetch("/api/provision", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          owner: address,
          salt,
          maxPerTx: input.max,
          dailyCap: input.daily,
          expiryDays: daysNum,
          vendor,
          signature,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? payload?.message ?? "Provisioning failed");
      rememberMyAgent({address: payload.agent, name: input.name || "My Agent", description: input.description, owner: address});
      setMessage(`Agent ${truncateAddress(payload.agent)} created and activated. ${payload.txHashes.length} on-chain transactions confirmed.`);
      setShowCreate(false);
      refreshPolicies();
    } catch (error) {
      setMessage(friendlyErrorFrom(error));
    } finally {
      setBusy(false);
    }
  };

  const updateLifecycle = async (agent: AgentEntry, status: "active" | "paused" | "revoked", values?: {max: string; daily: string; days: string}) => {
    if (!wallet || !publicClient) return setMessage("Connect the owner wallet first.");
    setBusy(true);
    try {
      const policy = policies?.[agent.address.toLowerCase()];
      if (status === "revoked") await revokeRestrictedAgent(wallet, publicClient, active.vault, agent.address as `0x${string}`);
      else await updateAgentBudget(wallet, publicClient, {
        vault: active.vault,
        agent: agent.address as `0x${string}`,
        maxPerTransaction: parseUnits(values?.max ?? formatMusd(policy?.maxPerTx ?? 0n), MUSD_DECIMALS),
        dailyCap: parseUnits(values?.daily ?? formatMusd(policy?.dailyCap ?? 0n), MUSD_DECIMALS),
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + Math.max(1, Number(values?.days ?? "30")) * 86400),
        active: status === "active",
      });
      setMessage(`${agent.name ?? "Agent"} is now ${status}.`);
      setEditing(null);
      refreshPolicies();
    } catch (error) {
      setMessage(friendlyErrorFrom(error));
    } finally {
      setBusy(false);
    }
  };

  return <div className="max-w-[1200px] px-8 py-8"><div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Agents</h1><p className="mt-1 text-[15px] text-fog">Multiple restricted agents, one policy-controlled vault.</p></div><Button variant="primary" size="sm" onClick={() => setShowCreate((value) => !value)} disabled={!isConnected}>{showCreate ? "Close" : "Create agent"}</Button></div>{message && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">{message}</p>}{showCreate && <div className="mt-6"><CreateAgentForm onSubmit={create} busy={busy} vendorDefault={active.vendor} /></div>}<div className="mt-8 grid gap-5 lg:grid-cols-2">{visibleAgents.map((agent) => { const policy = policies?.[agent.address.toLowerCase()] ?? undefined; const spendWallet = address && wallet && owners[agent.address.toLowerCase()]?.toLowerCase() === address.toLowerCase() ? wallet : null; return <AgentCard key={agent.address} agent={agent} policy={policy} ownedByYou={spendWallet != null} editing={editing === agent.address} busy={busy} spendWallet={spendWallet} onEdit={() => setEditing(editing === agent.address ? null : agent.address)} onLifecycle={(status, values) => updateLifecycle(agent, status, values)} />; })}</div>{visibleAgents.length === 0 && policies !== null && <Panel title="No active agents" subtitle="verified against the live vault"><p className="text-body-sm text-fog">Only agents with an active on-chain policy are shown. Create one above - your wallet signs one message, the treasury pays gas.</p></Panel>}</div>;
}

function CreateAgentForm({onSubmit, busy, vendorDefault}: {onSubmit: (input: {name: string; description: string; max: string; daily: string; days: string; salt: string; capabilities: string; vendor: string}) => void; busy: boolean; vendorDefault: string}) {
  const [input, setInput] = useState({name: "My Agent", description: "Restricted spending agent", max: "5", daily: "10", days: "30", salt: String(Math.floor(Math.random() * 1_000_000)), capabilities: "general", vendor: vendorDefault});
  const set = (key: keyof typeof input, value: string) => setInput((current) => ({...current, [key]: value}));
  return <Panel title="Create your agent" subtitle="sign a provisioning request - the treasury activates your policy on-chain"><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><TextInput value={input.name} onChange={(event) => set("name", event.target.value)} /></Field><Field label="Capabilities"><TextInput value={input.capabilities} onChange={(event) => set("capabilities", event.target.value)} /></Field><Field label="Description"><TextInput value={input.description} onChange={(event) => set("description", event.target.value)} /></Field><Field label="Salt"><TextInput value={input.salt} onChange={(event) => set("salt", event.target.value)} inputMode="numeric" /></Field><Field label="Vendor / payee address"><TextInput value={input.vendor} onChange={(event) => set("vendor", event.target.value)} spellCheck={false} /></Field><Field label="Max transaction (USDT)"><TextInput value={input.max} onChange={(event) => set("max", event.target.value)} inputMode="decimal" /></Field><Field label="Daily cap (USDT)"><TextInput value={input.daily} onChange={(event) => set("daily", event.target.value)} inputMode="decimal" /></Field><Field label="Expiry (days, max 365)"><TextInput value={input.days} onChange={(event) => set("days", event.target.value)} inputMode="numeric" /></Field></div><p className="mt-4 text-caption text-fog">Caps are bounded server-side: max 10 USDT per transaction, 25 USDT per day. Your wallet only signs one message; it never pays gas.</p><Button className="mt-5" variant="primary" size="sm" onClick={() => onSubmit(input)} disabled={busy}>{busy ? "Provisioning on-chain..." : "Sign and create agent"}</Button></Panel>;
}

function AgentCard({agent, policy, ownedByYou, editing, busy, spendWallet, onEdit, onLifecycle}: {agent: AgentEntry; policy?: PolicyLite; ownedByYou: boolean; editing: boolean; busy: boolean; spendWallet?: {signMessage: (args: {message: {raw: Hex}}) => Promise<Hex>} | null; onEdit: () => void; onLifecycle: (status: "active" | "paused" | "revoked", values?: {max: string; daily: string; days: string}) => void}) {
  const [values, setValues] = useState({max: formatMusd(policy?.maxPerTx ?? 0n), daily: formatMusd(policy?.dailyCap ?? 0n), days: "30"});
  const remaining = policy ? BigInt(policy.dailyCap) - BigInt(policy.spentToday) : 0n;
  return <Panel title={agent.name ?? "Agent"} subtitle={agent.description ?? "Restricted spending agent"}><div className="flex flex-wrap items-center gap-2"><Chip tone="mint">active</Chip><Chip tone="outline">restricted account</Chip>{ownedByYou && <Chip tone="lavender">yours</Chip>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><span className="text-caption text-fog">Agent account</span><div className="mt-1 flex gap-2"><CopyChip value={agent.address} label={truncateAddress(agent.address)} /><TxChip href={explorerAddress(agent.address)} label="BOTScan" /></div></div><div><span className="text-caption text-fog">Max per tx</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">{policy ? `${formatMusd(BigInt(policy.maxPerTx))} USDT` : "--"}</p></div><div><span className="text-caption text-fog">Daily budget</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">{policy ? `${formatMusd(BigInt(policy.dailyCap))} USDT` : "--"}</p></div><div><span className="text-caption text-fog">Remaining today</span><p className="mt-1 text-body-sm tabular-nums text-mint-signal">{policy ? `${formatMusd(remaining < 0n ? 0n : remaining)} USDT` : "--"}</p></div></div><div className="mt-3 text-caption text-fog">Policy expires {policy ? new Date(policy.expirySeconds * 1000).toLocaleDateString() : "--"}</div>{spendWallet && <SpendBox agentAddress={agent.address} wallet={spendWallet} />}{editing && <div className="mt-5 grid gap-3 rounded-[12px] border border-ash bg-paper-white p-4 sm:grid-cols-3"><Field label="Max tx"><TextInput value={values.max} onChange={(event) => setValues({...values, max: event.target.value})} /></Field><Field label="Daily cap"><TextInput value={values.daily} onChange={(event) => setValues({...values, daily: event.target.value})} /></Field><Field label="Expiry days"><TextInput value={values.days} onChange={(event) => setValues({...values, days: event.target.value})} /></Field><Button variant="primary" size="sm" onClick={() => onLifecycle("active", values)} disabled={busy}>Save &amp; activate</Button><Button variant="secondary" size="sm" onClick={() => onLifecycle("paused", values)} disabled={busy}>Pause</Button><Button variant="secondary" size="sm" onClick={() => onLifecycle("revoked")} disabled={busy}>Revoke</Button></div>}<div className="mt-5 flex gap-2"><Button variant="secondary" size="sm" onClick={onEdit}>{editing ? "Close editor" : "Manage policy"}</Button></div></Panel>;
}

function SpendBox({agentAddress, wallet}: {agentAddress: string; wallet: {signMessage: (args: {message: {raw: Hex}}) => Promise<Hex>}}) {
  const [amount, setAmount] = useState("0.50");
  const [busySpend, setBusySpend] = useState(false);
  const [outcome, setOutcome] = useState<UserSpendOutcome | null>(null);
  const go = async () => {
    setBusySpend(true);
    setOutcome(null);
    try {
      const baseUnits = parseUnits(amount || "0", MUSD_DECIMALS);
      if (baseUnits <= 0n) throw new Error("Enter a positive amount.");
      const result = await runUserSpend(wallet.signMessage.bind(wallet), agentAddress, baseUnits.toString());
      setOutcome(result);
    } catch (error) {
      setOutcome({ok: false, error: "wallet_error", message: friendlyErrorFrom(error)});
    } finally {
      setBusySpend(false);
    }
  };
  return <div className="mt-5 rounded-[12px] border border-ash bg-paper-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-caption text-fog">Test spend - gas sponsored, your wallet signs only</span><div className="flex items-center gap-2"><div className="w-24"><TextInput value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></div><Button variant="primary" size="sm" onClick={go} disabled={busySpend}>{busySpend ? "Signing..." : "Sign & spend"}</Button></div></div>{outcome && outcome.status === "included" && outcome.success === true && <p className="mt-3 text-body-sm text-mint-signal">Included. {outcome.txHash && <TxChip href={`${explorerAddress(agentAddress).replace(/\/address\/.*/, "")}tx/${outcome.txHash}`} label="View transaction" />}</p>}{outcome && outcome.status === "included" && outcome.success === false && <p className="mt-3 text-body-sm text-obsidian">Blocked by policy{outcome.reason ? `: ${outcome.reason}` : "."}</p>}{outcome && outcome.ok === false && <p className="mt-3 text-body-sm text-obsidian">{describeSpendError(outcome)}</p>}{outcome && outcome.status === "timeout" && <p className="mt-3 text-body-sm text-fog">Submitted but not yet included - check BOTScan shortly.</p>}</div>;
}
