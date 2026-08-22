"use client";

import {useState} from "react";
import {parseUnits} from "viem";
import {useAccount, usePublicClient, useWalletClient} from "wagmi";
import {getActiveContracts, MUSD_DECIMALS} from "@/lib/contracts";
import {useActiveVaultEntity, useBudgetEntities, useVaultAgentEntities} from "@/lib/base44-hooks";
import {getBase44Client} from "@/lib/base44";
import {createRestrictedAgent, revokeRestrictedAgent, updateAgentBudget} from "@/lib/createAgent";
import {formatMusd, truncateAddress} from "@/lib/format";
import {explorerAddress} from "@/lib/chain";
import {Chip, CopyChip, TxChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Panel} from "@/components/dashboard/Panel";

export default function AgentsPage() {
  const active = getActiveContracts();
  const vault = useActiveVaultEntity();
  const {address, isConnected} = useAccount();
  const {data: wallet} = useWalletClient();
  const publicClient = usePublicClient();
  const {data: agents, loading, refetch} = useVaultAgentEntities(vault?.id);
  const {data: budgets, refetch: refetchBudgets} = useBudgetEntities(vault?.id);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const create = async (input: {name: string; description: string; max: string; daily: string; days: string; salt: string; capabilities: string}) => {
    if (!vault?.id || !wallet || !publicClient || !address) return setMessage("Connect the vault owner wallet first.");
    setBusy(true);
    try {
      const result = await createRestrictedAgent(wallet, publicClient, {
        factory: active.factory,
        vault: active.vault,
        token: active.mockUSD,
        target: active.vendor,
        owner: address,
        salt: BigInt(input.salt || "0"),
        maxPerTransaction: parseUnits(input.max || "0", MUSD_DECIMALS),
        dailyCap: parseUnits(input.daily || "0", MUSD_DECIMALS),
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + Math.max(1, Number(input.days || "30")) * 86400),
      });
      const client = getBase44Client();
      const response = await client.functions.invoke("registerAgent", {
        vault_id: vault.id,
        agent_address: result.agent,
        owner_eoa: address,
        factory_address: active.factory,
        vault_address: active.vault,
        paymaster_address: active.paymaster,
        salt: input.salt || "0",
        display_name: input.name,
        description: input.description,
        capabilities: input.capabilities.split(",").map((item) => item.trim()).filter(Boolean),
      });
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error ?? "Agent registration failed");
      setMessage(`Agent ${truncateAddress(result.agent)} registered. ${result.hashes.length} on-chain transactions confirmed.`);
      setShowCreate(false);
      refetch();
      refetchBudgets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const updateLifecycle = async (agent: Record<string, any>, budget: Record<string, any>, status: "active" | "paused" | "revoked", values?: {max: string; daily: string; days: string}) => {
    if (!wallet || !publicClient || !vault?.id) return setMessage("Connect the vault owner wallet first.");
    setBusy(true);
    try {
      if (status === "revoked") await revokeRestrictedAgent(wallet, publicClient, active.vault, agent.address);
      else await updateAgentBudget(wallet, publicClient, {
        vault: active.vault,
        agent: agent.address,
        maxPerTransaction: parseUnits(values?.max ?? formatMusd(BigInt(budget?.max_per_transaction ?? "0")), MUSD_DECIMALS),
        dailyCap: parseUnits(values?.daily ?? formatMusd(BigInt(budget?.daily_cap ?? "0")), MUSD_DECIMALS),
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + Math.max(1, Number(values?.days ?? "30")) * 86400),
        active: status === "active",
      });
      const response = await getBase44Client().functions.invoke("updateAgentLifecycle", {agent_id: agent.id, status});
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error ?? "Lifecycle synchronization failed");
      setMessage(`${agent.display_name ?? "Agent"} is now ${status}.`);
      setEditing(null);
      refetch();
      refetchBudgets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return <div className="max-w-[1200px] px-8 py-8"><div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Agents</h1><p className="mt-1 text-[15px] text-fog">Multiple restricted agents, one policy-controlled vault.</p></div><Button variant="primary" size="sm" onClick={() => setShowCreate((value) => !value)} disabled={!isConnected}>{showCreate ? "Close" : "Create agent"}</Button></div>{message && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">{message}</p>}{showCreate && <div className="mt-6"><CreateAgentForm onSubmit={create} busy={busy} /></div>}<div className="mt-8 grid gap-5 lg:grid-cols-2">{agents?.map((agent) => { const budget = budgets?.find((item) => item.agent_id === agent.id || item.agent_address?.toLowerCase() === agent.address?.toLowerCase()); return <AgentCard key={agent.id} agent={agent} budget={budget} editing={editing === agent.id} busy={busy} onEdit={() => setEditing(editing === agent.id ? null : agent.id)} onLifecycle={(status, values) => updateLifecycle(agent, budget ?? {}, status, values)} />; })}</div>{(!agents || agents.length === 0) && <Panel title="No registered agents" subtitle="create one above"><p className="text-body-sm text-fog">An agent account is not a fund custodian. It can only request the vault&apos;s configured spend function.</p></Panel>}</div>;
}

function CreateAgentForm({onSubmit, busy}: {onSubmit: (input: {name: string; description: string; max: string; daily: string; days: string; salt: string; capabilities: string}) => void; busy: boolean}) {
  const [input, setInput] = useState({name: "Procurement Agent", description: "Autonomous procurement and service payments", max: "50", daily: "250", days: "30", salt: "1", capabilities: "procurement, services"});
  const set = (key: keyof typeof input, value: string) => setInput((current) => ({...current, [key]: value}));
  return <Panel title="Create restricted agent" subtitle="owner wallet transaction sequence"><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><TextInput value={input.name} onChange={(event) => set("name", event.target.value)} /></Field><Field label="Capabilities"><TextInput value={input.capabilities} onChange={(event) => set("capabilities", event.target.value)} /></Field><Field label="Description"><TextInput value={input.description} onChange={(event) => set("description", event.target.value)} /></Field><Field label="Salt"><TextInput value={input.salt} onChange={(event) => set("salt", event.target.value)} inputMode="numeric" /></Field><Field label="Max transaction (USDT)"><TextInput value={input.max} onChange={(event) => set("max", event.target.value)} inputMode="decimal" /></Field><Field label="Daily cap (USDT)"><TextInput value={input.daily} onChange={(event) => set("daily", event.target.value)} inputMode="decimal" /></Field><Field label="Expiry (days)"><TextInput value={input.days} onChange={(event) => set("days", event.target.value)} inputMode="numeric" /></Field></div><Button className="mt-5" variant="primary" size="sm" onClick={() => onSubmit(input)} disabled={busy}>{busy ? "Confirming wallet transactions..." : "Create and configure agent"}</Button></Panel>;
}

function AgentCard({agent, budget, editing, busy, onEdit, onLifecycle}: {agent: Record<string, any>; budget?: Record<string, any>; editing: boolean; busy: boolean; onEdit: () => void; onLifecycle: (status: "active" | "paused" | "revoked", values?: {max: string; daily: string; days: string}) => void}) {
  const [values, setValues] = useState({max: formatMusd(BigInt(budget?.max_per_transaction ?? "0")), daily: formatMusd(BigInt(budget?.daily_cap ?? "0")), days: "30"});
  return <Panel title={agent.display_name ?? "Agent"} subtitle={agent.description ?? "Restricted spending agent"}><div className="flex flex-wrap items-center gap-2"><Chip tone={agent.status === "active" ? "mint" : "blush"}>{agent.status}</Chip><Chip tone="outline">restricted account</Chip></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><span className="text-caption text-fog">Agent account</span><div className="mt-1 flex gap-2"><CopyChip value={agent.address} label={truncateAddress(agent.address)} /><TxChip href={explorerAddress(agent.address)} label="BOTScan" /></div></div><div><span className="text-caption text-fog">Owner</span><p className="mt-1 text-body-sm text-obsidian">{truncateAddress(agent.owner_eoa)}</p></div><div><span className="text-caption text-fog">Daily budget</span><p className="mt-1 text-body-sm tabular-nums text-obsidian">{budget ? `${formatMusd(BigInt(budget.daily_cap ?? "0"))} USDT` : "Sync required"}</p></div><div><span className="text-caption text-fog">Remaining</span><p className="mt-1 text-body-sm tabular-nums text-mint-signal">{budget ? `${formatMusd(BigInt(budget.remaining_daily ?? "0"))} USDT` : "--"}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{(agent.capabilities ?? []).map((capability: string) => <Chip key={capability} tone="lavender">{capability}</Chip>)}</div>{editing && <div className="mt-5 grid gap-3 rounded-[12px] border border-ash bg-paper-white p-4 sm:grid-cols-3"><Field label="Max tx"><TextInput value={values.max} onChange={(event) => setValues({...values, max: event.target.value})} /></Field><Field label="Daily cap"><TextInput value={values.daily} onChange={(event) => setValues({...values, daily: event.target.value})} /></Field><Field label="Expiry days"><TextInput value={values.days} onChange={(event) => setValues({...values, days: event.target.value})} /></Field><Button variant="primary" size="sm" onClick={() => onLifecycle("active", values)} disabled={busy}>Save budget</Button></div>}<div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={onEdit} disabled={busy || agent.status === "revoked"}>{editing ? "Cancel edit" : "Edit budget"}</Button>{agent.status === "active" && <Button variant="secondary" size="sm" onClick={() => onLifecycle("paused")} disabled={busy}>Pause</Button>}{agent.status === "paused" && <Button variant="secondary" size="sm" onClick={() => onLifecycle("active")} disabled={busy}>Resume</Button>}<Button variant="ghost" size="sm" onClick={() => onLifecycle("revoked")} disabled={busy || agent.status === "revoked"}>Revoke</Button></div></Panel>;
}
