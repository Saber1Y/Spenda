"use client";

import {useState} from "react";
import {getBase44Client} from "@/lib/base44";
import {useActiveVaultEntity, useOperationsAlerts, useOperationsSnapshots} from "@/lib/base44-hooks";
import {getActiveContracts} from "@/lib/contracts";
import {formatBot, formatMusd} from "@/lib/format";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";
import {StatTile} from "@/components/ui/StatTile";

export default function MonitoringPage() {
  const active = getActiveContracts();
  const vault = useActiveVaultEntity();
  const {data: snapshots, loading, refetch} = useOperationsSnapshots(vault?.id);
  const {data: alerts, refetch: refetchAlerts} = useOperationsAlerts(vault?.id);
  const [status, setStatus] = useState("");
  const latest = snapshots?.[0];
  const refresh = async () => {
    if (!vault?.id) return;
    setStatus("Reading chain state...");
    try {
      const result = await getBase44Client().functions.invoke("getOperationsSnapshot", {vault_id: vault.id});
      const response = result?.data ?? result;
      if (!response?.ok) throw new Error(response?.error ?? "Snapshot failed");
      setStatus(`${response.alerts?.length ?? 0} open alert(s) observed.`);
      refetch();
      refetchAlerts();
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };
  return <div className="max-w-[1200px] px-8 py-8"><div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Monitoring</h1><p className="mt-1 text-[15px] text-fog">Chain-derived health for the vault, paymaster, agents, and execution queue.</p></div><Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>{loading ? "Loading..." : "Refresh health"}</Button></div>{status && <p className="mt-4 text-body-sm text-fog">{status}</p>}<div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4"><div className="rounded-[16px] border border-ash bg-bone p-5"><StatTile label="Health" value={latest?.status ?? "No snapshot"} /></div><div className="rounded-[16px] border border-ash bg-bone p-5"><StatTile label="Vault balance" value={latest ? `${formatMusd(BigInt(latest.vault_balance))} USDT` : "--"} /></div><div className="rounded-[16px] border border-ash bg-bone p-5"><StatTile label="Paymaster" value={latest ? `${formatBot(BigInt(latest.paymaster_deposit))} BOT` : "--"} /></div><div className="rounded-[16px] border border-ash bg-bone p-5"><StatTile label="Open alerts" value={String(alerts?.length ?? 0)} /></div></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Open alerts" subtitle="read-only operational signals">{alerts?.length ? <div className="flex flex-col gap-3">{alerts.map((alert) => <div key={alert.id} className="rounded-[12px] border border-ash bg-paper-white p-4"><div className="flex items-center justify-between gap-3"><Chip tone={alert.severity === "critical" ? "blush" : "outline"}>{alert.severity}</Chip><span className="text-caption text-fog">{alert.code}</span></div><p className="mt-2 text-body-sm text-obsidian">{alert.message}</p></div>)}</div> : <p className="text-body-sm text-fog">No open operational alerts.</p>}</Panel><Panel title="Security posture" subtitle="restricted-account invariants"><div className="flex flex-col gap-3 text-body-sm text-fog"><p>Agent count: <strong className="text-obsidian">{latest?.agent_count ?? "--"}</strong></p><p>Custody violations: <strong className={latest?.custody_violations ? "text-blush" : "text-mint-signal"}>{latest?.custody_violations ?? "--"}</strong></p><p>Stuck executions: <strong className={latest?.stuck_executions ? "text-blush" : "text-mint-signal"}>{latest?.stuck_executions ?? "--"}</strong></p><p>RPC health: <strong className={latest?.rpc_healthy === false ? "text-blush" : "text-mint-signal"}>{latest ? latest.rpc_healthy ? "healthy" : "degraded" : "--"}</strong></p><p>Indexer lag: <strong className="text-obsidian">{latest?.indexer_lag_blocks ?? "--"} blocks</strong></p></div></Panel></div><p className="mt-6 text-caption text-fog">Monitoring is read-only. It never retries UserOperations or moves funds automatically. Use agent revocation and the owner wallet for emergency response.</p></div>;
}
