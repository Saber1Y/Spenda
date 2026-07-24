"use client";

import {Panel, PanelNote} from "./Panel";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Check, Hand, Bolt} from "@/components/ui/Icons";
import {truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {useAuditLogEntities} from "@/lib/base44-hooks";

interface TimelineEntry {
  id: string;
  time: string;
  timeMs: number;
  icon: "approved" | "blocked" | "info";
  label: string;
  detail?: string;
  txHash?: string;
  groupKey: string;
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
    return d.toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit", hour12: true});
  } catch {
    return "";
  }
}

function timelineFromLogs(logs: Record<string, any>[]): TimelineEntry[] {
  return logs
    .map((log) => {
      const action = ACTION_LABELS[log.action] ?? {icon: "info" as const, label: log.action};
      const meta = log.metadata ?? {};
      let detail = "";
      if (meta.amount && meta.token_symbol) {
        detail = `${meta.amount} ${meta.token_symbol}`;
        if (meta.recipient) detail += ` → ${truncateAddress(meta.recipient)}`;
      }
      if (meta.reason) detail = meta.reason;
      if (log.action === "VAULT_FUNDED" && meta.amount) detail = `${meta.amount} BOT`;
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
        groupKey: log.tx_hash ?? log.id,
      };
    })
    .sort((a, b) => b.timeMs - a.timeMs);
}

function TimelineIcon({kind}: {kind: "approved" | "blocked" | "info"}) {
  if (kind === "approved") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-signal/15 text-mint-signal">
        <Check width={12} height={12} />
      </span>
    );
  }
  if (kind === "blocked") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blush-mist/50 text-blush">
        <Hand width={12} height={12} />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-periwinkle/15 text-periwinkle">
      <Bolt width={12} height={12} />
    </span>
  );
}

function TimelineItem({entry, isLast}: {entry: TimelineEntry; isLast: boolean}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <TimelineIcon kind={entry.icon} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-ash" />}
      </div>
      <div className={`flex-1 ${isLast ? "" : "pb-5"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-caption text-fog tabular-nums">{entry.time}</span>
          <span className="text-body-sm text-aubergine">{entry.label}</span>
        </div>
        {entry.detail && <p className="mt-0.5 text-body-sm text-fog">{entry.detail}</p>}
        {entry.txHash && (
          <a
            href={explorerTx(entry.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-caption text-periwinkle hover:underline"
          >
            {truncateHash(entry.txHash)}
          </a>
        )}
      </div>
    </div>
  );
}

export function AuditTimelinePanel({vaultId, className = ""}: {vaultId?: string; className?: string}) {
  const {data: logs, loading, error, refetch} = useAuditLogEntities(vaultId);
  const entries = logs ? timelineFromLogs(logs) : [];
  const empty = !loading && entries.length === 0;

  return (
    <Panel
      title="Audit timeline"
      subtitle="every decision, in order"
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </Button>
      }
    >
      {loading && entries.length === 0 ? (
        <div className="flex flex-col gap-4 px-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-6 w-6 shrink-0 rounded-full bg-ash" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-32 rounded bg-ash" />
                <div className="h-3 w-48 rounded bg-ash" />
              </div>
            </div>
          ))}
        </div>
      ) : error && entries.length === 0 ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load audit logs.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : empty ? (
        <PanelNote>No audit entries yet. Sync vault state to populate the timeline.</PanelNote>
      ) : (
        <div className="max-h-[480px] overflow-y-auto px-1">
          {entries.map((entry, i) => (
            <TimelineItem key={entry.id} entry={entry} isLast={i === entries.length - 1} />
          ))}
        </div>
      )}
    </Panel>
  );
}
