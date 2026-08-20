"use client";

import {useEffect, useState} from "react";
import {isAddress, type Address} from "viem";
import {usePublicClient, useWalletClient} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {useActiveVaultEntity, useAgentAllowlistEntities, useVaultAgentEntities} from "@/lib/base44-hooks";
import {getBase44Client} from "@/lib/base44";
import {updateAgentAllowlist} from "@/lib/createAgent";
import {truncateAddress} from "@/lib/format";
import {Chip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Panel} from "@/components/dashboard/Panel";

export default function AllowlistPage() {
  const active = getActiveContracts();
  const vault = useActiveVaultEntity();
  const {data: wallet} = useWalletClient();
  const publicClient = usePublicClient();
  const {data: agents} = useVaultAgentEntities(vault?.id);
  const [agentId, setAgentId] = useState("");
  const selected = agents?.find((agent) => agent.id === agentId);
  const {data: entries, refetch} = useAgentAllowlistEntities(vault?.id, selected?.address);
  const [target, setTarget] = useState(active.vendor);
  const [token, setToken] = useState(active.mockUSD);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!agentId && agents?.length) setAgentId(agents[0].id);
  }, [agentId, agents]);

  const update = async (kind: "target" | "token", addressValue: string, allowed: boolean) => {
    if (!selected || !wallet || !publicClient || !isAddress(addressValue)) return setMessage("Select an agent, connect the owner wallet, and enter a valid address.");
    setBusy(true);
    try {
      const hash = await updateAgentAllowlist(wallet, publicClient, {vault: active.vault, agent: selected.address, kind, address: addressValue as Address, allowed});
      const result = await getBase44Client().functions.invoke("syncAllowlistEntry", {agent_id: selected.id, kind, address: addressValue, label: label || (kind === "token" ? "Token" : "Recipient"), category});
      const payload = result?.data ?? result;
      if (!payload?.ok || payload.allowed !== allowed) throw new Error(payload?.error ?? "On-chain allowlist state did not match the request");
      setMessage(`${kind === "target" ? "Target" : "Token"} ${allowed ? "allowed" : "removed"}. Transaction ${truncateAddress(hash)}.`);
      refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const targets = (entries ?? []).filter((entry) => entry.kind === "target");
  const tokens = (entries ?? []).filter((entry) => entry.kind === "token");

  return <div className="max-w-[1200px] px-8 py-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Allowlist</h1><p className="mt-1 text-[15px] text-fog">Agent-specific recipients and tokens enforced by the vault.</p></div><label className="flex items-center gap-2 text-body-sm text-fog">Agent<select className="rounded-[10px] border border-ash bg-bone px-3 py-2 text-obsidian" value={agentId} onChange={(event) => setAgentId(event.target.value)}>{agents?.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name ?? agent.address}</option>)}</select></label></div>{message && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">{message}</p>}<div className="mt-8 grid gap-6 lg:grid-cols-2"><AllowlistPanel title="Approved targets" description="Recipient addresses this agent may pay." entries={targets} value={target} onValue={(value) => setTarget(value as Address)} label={label} onLabel={setLabel} category={category} onCategory={setCategory} busy={busy} onUpdate={(allowed) => update("target", target, allowed)} /><AllowlistPanel title="Approved tokens" description="ERC-20 tokens this agent may spend." entries={tokens} value={token} onValue={(value) => setToken(value as Address)} label={label} onLabel={setLabel} category={category} onCategory={setCategory} busy={busy} onUpdate={(allowed) => update("token", token, allowed)} /></div></div>;
}

function AllowlistPanel({title, description, entries, value, onValue, label, onLabel, category, onCategory, busy, onUpdate}: {title: string; description: string; entries: Record<string, any>[]; value: string; onValue: (value: string) => void; label: string; onLabel: (value: string) => void; category: string; onCategory: (value: string) => void; busy: boolean; onUpdate: (allowed: boolean) => void}) {
  return <Panel title={title} subtitle={description}><div className="flex flex-col gap-2">{entries.length ? entries.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-[10px] border border-ash bg-paper-white px-3 py-2"><div><p className="text-body-sm text-obsidian">{entry.label || truncateAddress(entry.address)}</p><p className="text-caption text-fog">{truncateAddress(entry.address)} · {entry.category || "other"}</p></div><Chip tone={entry.status === "active" ? "mint" : "outline"}>{entry.status}</Chip></div>) : <p className="text-body-sm text-fog">No synchronized entries for this agent.</p>}</div><div className="mt-5 grid gap-3"><Field label="Address"><TextInput value={value} onChange={(event) => onValue(event.target.value)} spellCheck={false} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Label"><TextInput value={label} onChange={(event) => onLabel(event.target.value)} /></Field><Field label="Category"><TextInput value={category} onChange={(event) => onCategory(event.target.value)} /></Field></div><div className="flex gap-2"><Button variant="primary" size="sm" onClick={() => onUpdate(true)} disabled={busy}>Allow</Button><Button variant="secondary" size="sm" onClick={() => onUpdate(false)} disabled={busy}>Remove</Button></div></div></Panel>;
}
