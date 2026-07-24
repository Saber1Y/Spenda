"use client";

import {Panel, PanelNote} from "./Panel";
import {StatTile} from "@/components/ui/StatTile";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Check, Hand} from "@/components/ui/Icons";
import {truncateAddress} from "@/lib/format";
import {useTransactionEntities} from "@/lib/base44-hooks";

function parseAmount(base: string | undefined): bigint {
  if (!base) return 0n;
  try {
    return BigInt(base);
  } catch {
    return 0n;
  }
}

function formatMusd(base: bigint): string {
  const n = Number(base) / 1_000_000;
  return n.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 2});
}

interface VendorStat {
  address: string;
  count: number;
  totalApproved: bigint;
}

function computeStats(transactions: Record<string, any>[]) {
  let totalApproved = 0n;
  let totalBlocked = 0n;
  let approvedCount = 0;
  let blockedCount = 0;
  const vendorMap = new Map<string, VendorStat>();

  for (const tx of transactions) {
    const amount = parseAmount(tx.amount);
    const recipient = tx.recipient?.toLowerCase() ?? "";

    if (tx.status === "EXECUTED" || tx.status === "APPROVED") {
      totalApproved += amount;
      approvedCount++;
      if (recipient) {
        const existing = vendorMap.get(recipient) ?? {address: tx.recipient, count: 0, totalApproved: 0n};
        existing.count++;
        existing.totalApproved += amount;
        vendorMap.set(recipient, existing);
      }
    } else if (tx.status === "BLOCKED") {
      totalBlocked += amount;
      blockedCount++;
    }
  }

  const vendors = [...vendorMap.values()].sort((a, b) => (a.count > b.count ? -1 : a.count < b.count ? 1 : 0)).slice(0, 5);

  return {totalApproved, totalBlocked, approvedCount, blockedCount, vendors};
}

export function OverviewPanel({className = ""}: {className?: string}) {
  const {data: transactions, loading, error, refetch} = useTransactionEntities();
  const stats = transactions ? computeStats(transactions) : null;
  const empty = !loading && transactions && transactions.length === 0;

  return (
    <Panel
      title="Agent overview"
      subtitle="aggregated from Base44 transaction records"
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </Button>
      }
    >
      {loading && !stats ? (
        <div className="grid grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-3 w-20 rounded bg-ash" />
              <div className="h-7 w-24 rounded bg-ash" />
            </div>
          ))}
        </div>
      ) : error && !stats ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load overview.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : empty ? (
        <PanelNote>No transaction data yet. Sync transactions to see aggregated stats.</PanelNote>
      ) : stats ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <StatTile
              label="Total approved"
              value={`${formatMusd(stats.totalApproved)} mUSD`}
              sub={`${stats.approvedCount} transaction${stats.approvedCount !== 1 ? "s" : ""}`}
            />
            <StatTile
              label="Total blocked"
              value={`${formatMusd(stats.totalBlocked)} mUSD`}
              sub={`${stats.blockedCount} attempt${stats.blockedCount !== 1 ? "s" : ""} held`}
              valueClassName={stats.blockedCount > 0 ? "text-blush" : ""}
            />
            <StatTile
              label="Transactions"
              value={String(stats.approvedCount + stats.blockedCount)}
              sub={
                stats.approvedCount + stats.blockedCount > 0
                  ? `${Math.round((stats.approvedCount / (stats.approvedCount + stats.blockedCount)) * 100)}% approved`
                  : undefined
              }
            />
            <StatTile
              label="Blocked rate"
              value={
                stats.approvedCount + stats.blockedCount > 0
                  ? `${Math.round((stats.blockedCount / (stats.approvedCount + stats.blockedCount)) * 100)}%`
                  : "0%"
              }
              sub="fence working as designed"
            />
          </div>

          {stats.vendors.length > 0 && (
            <div>
              <span className="text-caption uppercase tracking-[0.06em] text-fog">Top vendors</span>
              <div className="mt-2 flex flex-col gap-2">
                {stats.vendors.map((v) => (
                  <div key={v.address} className="flex items-center justify-between rounded-card border border-ash bg-bone px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Check width={12} height={12} className="text-mint-signal" />
                      <span className="text-body-sm text-aubergine">{truncateAddress(v.address)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm text-fog tabular-nums">{v.count}x</span>
                      <Chip tone="outline">{formatMusd(v.totalApproved)} mUSD</Chip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
