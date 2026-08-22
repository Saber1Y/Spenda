"use client";

import {useState, useMemo} from "react";
import {getActiveContracts} from "@/lib/contracts";
import {useVaultState, useActionHistory} from "@/lib/hooks";
import {useVaultEntities, useTransactionEntities, useActiveVaultEntity} from "@/lib/base44-hooks";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {StatTile} from "@/components/ui/StatTile";
import {Chip, TxChip} from "@/components/ui/Chip";
import {StateBadge} from "@/components/ui/StateBadge";
import {Button} from "@/components/ui/Button";
import {Dot} from "@/components/ui/Icons";

type Filter = "all" | "approved" | "blocked";

function parseAmount(base: string | undefined): bigint {
  if (!base) return 0n;
  try { return BigInt(base); } catch { return 0n; }
}

export default function SpendingPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const {data: state, loading: stateLoading, refetch: refetchState} = useVaultState(agent);
  const history = useActionHistory(agent);
  const vaultEntity = useActiveVaultEntity();
  const vaultId = vaultEntity?.id;
  const {data: transactions, loading: txLoading, refetch: refetchTx} = useTransactionEntities(vaultId);
  const [filter, setFilter] = useState<Filter>("all");

  const allRows = useMemo(() => {
    const rows: {
      key: string;
      kind: "approved" | "blocked";
      amount: bigint;
      target: string;
      reason?: string;
      txHash: string;
      time?: string;
      source: "onchain" | "base44";
    }[] = [];

    for (const a of history.actions) {
      rows.push({
        key: `oc:${a.txHash}:${a.logIndex}`,
        kind: a.kind,
        amount: a.amount,
        target: a.target,
        reason: a.reason,
        txHash: a.txHash,
        source: "onchain",
      });
    }

    if (transactions) {
      for (const tx of transactions) {
        const status = tx.status?.toLowerCase();
        const kind: "approved" | "blocked" = status === "blocked" ? "blocked" : "approved";
        rows.push({
          key: `b44:${tx.id}`,
          kind,
          amount: parseAmount(tx.amount),
          target: tx.recipient ?? "",
          reason: tx.block_reason,
          txHash: tx.tx_hash ?? "",
          time: tx.created_at,
          source: "base44",
        });
      }
    }

    return rows.sort((a, b) => {
      if (a.time && b.time) return b.time.localeCompare(a.time);
      return 0;
    });
  }, [history.actions, transactions]);

  const filtered = useMemo(() => {
    if (filter === "all") return allRows;
    return allRows.filter((r) => r.kind === filter);
  }, [allRows, filter]);

  const approved = allRows.filter((r) => r.kind === "approved");
  const blocked = allRows.filter((r) => r.kind === "blocked");
  const totalApproved = approved.reduce((s, r) => s + r.amount, 0n);
  const totalBlocked = blocked.reduce((s, r) => s + r.amount, 0n);

  const filterTabs: {label: string; value: Filter; count: number}[] = [
    {label: "All", value: "all", count: allRows.length},
    {label: "Approved", value: "approved", count: approved.length},
    {label: "Blocked", value: "blocked", count: blocked.length},
  ];

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>
            Spending
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            Every agent spending attempt, approved and blocked
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { history.refetch(); refetchTx(); }} disabled={history.loading || txLoading}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-[16px] border border-ash bg-bone px-5 py-4">
          <StatTile label="Total Attempts" value={String(allRows.length)} />
        </div>
        <div className="rounded-[16px] border border-ash bg-bone px-5 py-4">
          <StatTile
            label="Approved"
            value={String(approved.length)}
            sub={`${formatMusd(totalApproved)} USDT`}
            valueClassName="text-mint-signal"
          />
        </div>
        <div className="rounded-[16px] border border-ash bg-bone px-5 py-4">
          <StatTile
            label="Blocked"
            value={String(blocked.length)}
            sub={`${formatMusd(totalBlocked)} USDT held`}
            valueClassName="text-blush"
          />
        </div>
        <div className="rounded-[16px] border border-ash bg-bone px-5 py-4">
          <StatTile
            label="Approval Rate"
            value={allRows.length > 0 ? `${Math.round((approved.length / allRows.length) * 100)}%` : "--"}
            sub="fence working"
          />
        </div>
      </div>

      {/* Filter tabs + Table */}
      <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
        <div className="flex items-center gap-1 mb-5">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex items-center gap-2 rounded-pill px-4 py-2 text-[15px] transition ${
                filter === tab.value
                  ? "bg-base-orange text-paper-white"
                  : "text-fog hover:bg-ash/60"
              }`}
            >
              {tab.label}
              <span className={`text-[13px] tabular-nums ${filter === tab.value ? "text-paper-white/80" : "text-fog"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[15px] text-fog">
            {filter === "all"
              ? "No transactions yet. Run the agent to see spending activity."
              : `No ${filter} transactions.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ash">
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Status</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Amount</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Target</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Decision</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Source</th>
                  <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ash/70">
                {filtered.map((row) => (
                  <tr key={row.key} className="group">
                    <td className="py-3 pr-4"><StateBadge kind={row.kind} /></td>
                    <td className="py-3 pr-4 text-[15px] text-obsidian tabular-nums">{formatMusd(row.amount)} USDT</td>
                    <td className="py-3 pr-4 text-[15px] text-fog">{truncateAddress(row.target)}</td>
                    <td className="py-3 pr-4 text-[15px] text-fog">
                      {row.kind === "blocked" ? row.reason ?? "policy" : "vendor paid"}
                    </td>
                    <td className="py-3 pr-4">
                      <Chip tone={row.source === "onchain" ? "lavender" : "outline"}>
                        {row.source === "onchain" ? "on-chain" : "Base44"}
                      </Chip>
                    </td>
                    <td className="py-3">
                      {row.txHash ? <TxChip href={explorerTx(row.txHash)} label={truncateHash(row.txHash)} /> : <span className="text-fog text-[13px]">--</span>}
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
