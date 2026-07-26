"use client";

import {useMemo} from "react";
import {useActiveVaultEntity, useAuditLogEntities} from "@/lib/base44-hooks";
import {truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {Button} from "@/components/ui/Button";
import {Chip, TxChip} from "@/components/ui/Chip";

interface TimelineEntry {
  id: string;
  time: string;
  timeMs: number;
  icon: "approved" | "blocked" | "info";
  label: string;
  detail?: string;
  txHash?: string;
  action: string;
  actor?: string;
}

const ACTION_LABELS: Record<string, {icon: "approved" | "blocked" | "info"; label: string}> = {
  VAULT_CREATED: {icon: "info", label: "Vault created"},
  POLICY_CREATED: {icon: "info", label: "Policy created"},
  POLICY_UPDATED: {icon: "info", label: "Policy updated"},
  AGENT_REGISTERED: {icon: "info", label: "Agent registered"},
  AGENT_REVOKED: {icon: "blocked", label: "Agent revoked"},
  ALLOWLIST_UPDATED: {icon: "info", label: "Allowlist updated"},
  PAYMENT_REQUESTED: {icon: "info", label: "Payment requested"},
  PAYMENT_APPROVED: {icon: "approved", label: "Payment approved"},
  PAYMENT_BLOCKED: {icon: "blocked", label: "Payment blocked"},
  PAYMENT_EXECUTED: {icon: "approved", label: "Payment executed"},
  PAYMENT_FAILED: {icon: "blocked", label: "Payment failed"},
  VAULT_FUNDED: {icon: "info", label: "Vault funded"},
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true});
  } catch { return ""; }
}

function timelineFromLogs(logs: Record<string, any>[]): TimelineEntry[] {
  return logs
    .map((log) => {
      const action = ACTION_LABELS[log.action] ?? {icon: "info" as const, label: log.action};
      const meta = log.metadata ?? {};
      let detail = "";
      if (meta.amount && meta.token_symbol) {
        detail = `${meta.amount} ${meta.token_symbol}`;
        if (meta.recipient) detail += ` -> ${truncateAddress(meta.recipient)}`;
      }
      if (meta.reason) detail = meta.reason;
      if (log.action === "VAULT_FUNDED" && meta.amount) detail = `${meta.amount} ${meta.token ?? "BOT"}`;
      if (log.action === "POLICY_UPDATED") {
        const parts: string[] = [];
        if (meta.max_per_tx) parts.push(`per-tx: ${meta.max_per_tx}`);
        if (meta.daily_cap) parts.push(`daily: ${meta.daily_cap}`);
        if (parts.length) detail = parts.join(", ");
      }

      return {
        id: log.id,
        time: formatTime(log.timestamp),
        timeMs: new Date(log.timestamp).getTime(),
        icon: action.icon,
        label: action.label,
        detail,
        txHash: log.tx_hash,
        action: log.action,
        actor: log.actor,
      };
    })
    .sort((a, b) => b.timeMs - a.timeMs);
}

export default function AuditPage() {
  const vaultEntity = useActiveVaultEntity();
  const vaultId = vaultEntity?.id;
  const {data: logs, loading, error, refetch} = useAuditLogEntities(vaultId);
  const entries = logs ? timelineFromLogs(logs) : [];
  const empty = !loading && entries.length === 0;

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>
            Audit Log
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            Every decision, in order. Complete audit trail of all vault operations.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </Button>
      </div>

      <div className="mt-8 rounded-[16px] border border-ash bg-bone p-6">
        {loading && entries.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-5 w-28 rounded bg-ash" />
                <div className="h-5 w-40 rounded bg-ash" />
                <div className="h-5 flex-1 rounded bg-ash" />
              </div>
            ))}
          </div>
        ) : error && entries.length === 0 ? (
          <div className="py-8 text-center text-[15px] text-fog">
            Couldn&apos;t load audit logs.{" "}
            <button onClick={refetch} className="underline text-base-orange">Retry</button>
          </div>
        ) : empty ? (
          <div className="py-12 text-center text-[15px] text-fog">
            No audit entries yet. Sync vault state to populate the timeline.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ash">
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Time</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Event</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Decision</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Actor</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Details</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ash/70">
                {entries.map((entry) => (
                  <tr key={entry.id} className="group">
                    <td className="py-3 pr-4 text-[15px] text-fog tabular-nums whitespace-nowrap">{entry.time}</td>
                    <td className="py-3 pr-4 text-[15px] text-obsidian">{entry.label}</td>
                    <td className="py-3 pr-4">
                      {entry.icon === "approved" && <Chip tone="mint">Approved</Chip>}
                      {entry.icon === "blocked" && <Chip tone="blush">Blocked</Chip>}
                      {entry.icon === "info" && <Chip tone="outline">Info</Chip>}
                    </td>
                    <td className="py-3 pr-4 text-[15px] text-fog">{entry.actor ? truncateAddress(entry.actor) : "--"}</td>
                    <td className="py-3 pr-4 text-[15px] text-fog">{entry.detail || "--"}</td>
                    <td className="py-3">
                      {entry.txHash ? (
                        <TxChip href={explorerTx(entry.txHash)} label={truncateHash(entry.txHash)} />
                      ) : (
                        <span className="text-[13px] text-fog">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
