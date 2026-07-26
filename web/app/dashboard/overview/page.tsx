"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { getActiveContracts } from "@/lib/contracts";
import { useVaultState, useActionHistory } from "@/lib/hooks";
import { useVaultEntities, useTransactionEntities, useActiveVaultEntity } from "@/lib/base44-hooks";
import {
  isSameAddress,
  formatMusd,
  formatBot,
  truncateAddress,
  truncateHash,
  timeAgo,
} from "@/lib/format";
import { explorerAddress, explorerTx } from "@/lib/chain";
import { StatTile } from "@/components/ui/StatTile";
import { Chip, CopyChip, TxChip } from "@/components/ui/Chip";
import { StateBadge } from "@/components/ui/StateBadge";
import { Button } from "@/components/ui/Button";
import { Dot, Check, Hand } from "@/components/ui/Icons";
import { GaslessStatusBadge } from "@/components/dashboard/GaslessStatusBadge";
import { SyncPanel } from "@/components/dashboard/SyncPanel";
import { DailyCapMeter } from "@/components/dashboard/DailyCapMeter";

function ApprovedBlockedDonut({
  approved,
  blocked,
}: {
  approved: number;
  blocked: number;
}) {
  const total = approved + blocked;
  if (total === 0) {
    return (
      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-4 border-ash bg-bone">
        <span className="text-caption text-fog">No data</span>
      </div>
    );
  }
  const pct = Math.round((approved / total) * 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const approvedDash = (pct / 100) * circumference;
  const blockedDash = circumference - approvedDash;

  return (
    <div className="relative h-[120px] w-[120px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e9e8ea"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#2ec08b"
          strokeWidth="10"
          strokeDasharray={`${approvedDash} ${blockedDash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-heading-sm font-heading text-obsidian"
          style={{ fontWeight: 350 }}
        >
          {pct}%
        </span>
        <span className="text-caption text-fog">approved</span>
      </div>
    </div>
  );
}

function BlockReasonBars({
  actions,
}: {
  actions: { kind: string; reason?: string }[];
}) {
  const reasons = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of actions) {
      if (a.kind === "blocked") {
        const r = a.reason ?? "policy";
        map.set(r, (map.get(r) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [actions]);

  if (reasons.length === 0) {
    return (
      <p className="text-body-sm text-fog">No blocked transactions yet.</p>
    );
  }

  const max = reasons[0][1];

  return (
    <div className="flex flex-col gap-2.5">
      {reasons.map(([reason, count]) => (
        <div key={reason} className="flex items-center gap-3">
          <span className="w-[180px] truncate text-[13px] text-fog">
            {reason}
          </span>
          <div className="flex-1 h-6 overflow-hidden rounded-[8px] bg-ash">
            <div
              className="h-full rounded-[8px] bg-blush-mist transition-[width] duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-[13px] tabular-nums text-aubergine w-6 text-right">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpendingBarChart({
  actions,
}: {
  actions: { amount: bigint; kind: string; blockNumber: bigint }[];
}) {
  const buckets = useMemo(() => {
    const map = new Map<number, { approved: bigint; blocked: bigint }>();
    for (const a of actions) {
      const bucket = Number(a.blockNumber / 100n) * 100;
      const existing = map.get(bucket) ?? { approved: 0n, blocked: 0n };
      if (a.kind === "approved") existing.approved += a.amount;
      else existing.blocked += a.amount;
      map.set(bucket, existing);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).slice(-8);
  }, [actions]);

  if (buckets.length === 0) {
    return (
      <p className="text-body-sm text-fog">
        Spending chart will appear after the first transactions.
      </p>
    );
  }

  const maxVal = buckets.reduce((acc, [, v]) => {
    const total = v.approved + v.blocked;
    return total > acc ? total : acc;
  }, 0n);

  return (
    <div className="flex items-end gap-2 h-[120px]">
      {buckets.map(([block, v], i) => {
        const total = v.approved + v.blocked;
        const h =
          maxVal > 0n
            ? Math.max(4, Number((total * 10000n) / maxVal) / 100)
            : 0;
        const approvedH =
          total > 0n ? (Number(v.approved) / Number(total)) * h : 0;
        return (
          <div key={block} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full" style={{ height: `${h}%` }}>
              {v.approved > 0n && (
                <div
                  className="absolute bottom-0 w-full rounded-t-[4px] bg-mint-signal"
                  style={{ height: `${approvedH}%` }}
                />
              )}
              {v.blocked > 0n && (
                <div
                  className="absolute top-0 w-full rounded-t-[4px] bg-blush-mist"
                  style={{ height: `${h - approvedH}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OverviewPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const { data: state, loading, error, refetch } = useVaultState(agent);
  const history = useActionHistory(agent);
  const { address, isConnected } = useAccount();
  const vaultEntity = useActiveVaultEntity();
  const vaultId = vaultEntity?.id;
  const { data: transactions, refetch: refetchTx } = useTransactionEntities(vaultId);

  const isOwner =
    isConnected && !!state && isSameAddress(address, state.vaultOwner);

  const approved = history.actions.filter((a) => a.kind === "approved");
  const blocked = history.actions.filter((a) => a.kind === "blocked");

  const txStats = useMemo(() => {
    if (!transactions) return null;
    let totalApproved = 0n;
    let totalBlocked = 0n;
    let approvedCount = 0;
    let blockedCount = 0;
    for (const tx of transactions) {
      const amt = BigInt(tx.amount ?? "0");
      if (tx.status === "EXECUTED" || tx.status === "APPROVED") {
        totalApproved += amt;
        approvedCount++;
      } else if (tx.status === "BLOCKED") {
        totalBlocked += amt;
        blockedCount++;
      }
    }
    return { totalApproved, totalBlocked, approvedCount, blockedCount };
  }, [transactions]);

  return (
    <div className="max-w-[1200px]">
      {/* Dark hero header */}
      <div className="text-fog px-8 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-heading text-heading "
              style={{ fontWeight: 350 }}
            >
              Overview
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <Chip tone="outline" className="border-ash/30 text-fog">
                <Dot width={8} height={8} className="text-base-orange" />
                BOT Chain 968
              </Chip>
              {isConnected && address && (
                <Chip tone="outline" className="border-ash/30 text-fog">
                  <Dot width={8} height={8} className="text-mint-signal" />
                  {truncateAddress(address)}
                </Chip>
              )}
            </div>
          </div>
          <Button
            variant="onDark"
            size="sm"
            onClick={() => {
              refetch();
              history.refetch();
              refetchTx();
            }}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* KPI Row — dark */}
        <div className="mt-8 grid grid-cols-5 gap-4">
          <div className="rounded-[16px] border border-ash/15 bg-white/5 px-5 py-4">
            <span className="text-[13px] uppercase tracking-wide text-fog">
              Vault Balance
            </span>
            <div
              className="mt-2 font-heading text-heading-sm "
              style={{ fontWeight: 350 }}
            >
              {loading && !state ? (
                <span className="inline-block h-6 w-24 animate-pulse rounded bg-white/10" />
              ) : (
                <>
                  {formatMusd(state?.vaultBalance ?? 0n)}{" "}
                  <span className="text-fog text-body">mUSD</span>
                </>
              )}
            </div>
            <span className="text-[13px] text-fog">
              {state?.vaultBalance === 0n ? "empty" : "protected"}
            </span>
          </div>

          <div className="rounded-[16px] border border-ash/15 bg-white/5 px-5 py-4">
            <span className="text-[13px] uppercase tracking-wide text-fog">
              Spent Today
            </span>
            <div
              className="mt-2 font-heading text-heading-sm "
              style={{ fontWeight: 350 }}
            >
              {loading && !state ? (
                <span className="inline-block h-6 w-24 animate-pulse rounded bg-white/10" />
              ) : (
                <>
                  {formatMusd(state?.policy.spentToday ?? 0n)} /{" "}
                  {formatMusd(state?.policy.dailyCap ?? 0n)}{" "}
                  <span className="text-fog text-body">mUSD</span>
                </>
              )}
            </div>
            <span className="text-[13px] text-fog">
              {formatMusd(state?.remainingDailyCap ?? 0n)} remaining
            </span>
          </div>

          <div className="rounded-[16px] border border-ash/15 bg-white/5 px-5 py-4">
            <span className="text-[13px] uppercase tracking-wide text-fog">
              Approved
            </span>
            <div
              className="mt-2 font-heading text-heading-sm text-mint-signal"
              style={{ fontWeight: 350 }}
            >
              {txStats ? txStats.approvedCount : approved.length}
            </div>
            <span className="text-[13px] text-fog">
              {txStats
                ? `${formatMusd(txStats.totalApproved)} mUSD`
                : approved.length > 0
                  ? `${formatMusd(approved.reduce((s, a) => s + a.amount, 0n))} mUSD`
                  : "no spend yet"}
            </span>
          </div>

          <div className="rounded-[16px] border border-ash/15 bg-white/5 px-5 py-4">
            <span className="text-[13px] uppercase tracking-wide text-fog">
              Blocked
            </span>
            <div
              className="mt-2 font-heading text-heading-sm"
              style={{ fontWeight: 350, color: "#f08080" }}
            >
              {txStats ? txStats.blockedCount : blocked.length}
            </div>
            <span className="text-[13px] text-fog">
              {txStats
                ? `${formatMusd(txStats.totalBlocked)} mUSD held`
                : blocked.length > 0
                  ? `${formatMusd(blocked.reduce((s, a) => s + a.amount, 0n))} mUSD held`
                  : "fence clean"}
            </span>
          </div>

          <div className="rounded-[16px] border border-ash/15 bg-white/5 px-5 py-4">
            <span className="text-[13px] uppercase tracking-wide text-fog">
              Gas Sponsor
            </span>
            <div
              className="mt-2 font-heading text-heading-sm "
              style={{ fontWeight: 350 }}
            >
              {loading && !state ? (
                <span className="inline-block h-6 w-24 animate-pulse rounded bg-white/10" />
              ) : (
                <>
                  {formatBot(state?.paymasterDeposit ?? 0n)}{" "}
                  <span className="text-fog text-body">BOT</span>
                </>
              )}
            </div>
            <GaslessStatusBadge
              paymasterDeposit={state?.paymasterDeposit}
              agentNative={state?.agentNative}
              agentDeposit={state?.agentDeposit}
              loading={loading && !state}
            />
          </div>
        </div>
      </div>

      {/* Content below dark header */}
      <div className="px-8 py-8">
        {/* Agent Status */}
        <div className="mt-8 rounded-[16px] border border-ash bg-bone p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">
            Agent Status
          </h2>
          <div className="grid grid-cols-6 gap-6">
            <div>
              <span className="text-[13px] text-fog">Status</span>
              <div className="mt-1">
                {state?.policy.active ? (
                  <Chip tone="mint">
                    <Dot width={8} height={8} /> Active
                  </Chip>
                ) : (
                  <Chip tone="blush">
                    <Hand width={12} height={12} /> Inactive
                  </Chip>
                )}
              </div>
            </div>
            <div>
              <span className="text-[13px] text-fog">Agent Wallet</span>
              <div className="mt-1">
                <CopyChip value={agent} label={truncateAddress(agent)} />
              </div>
            </div>
            <div>
              <span className="text-[13px] text-fog">Connected Vault</span>
              <div className="mt-1">
                <CopyChip
                  value={active.vault}
                  label={truncateAddress(active.vault)}
                />
              </div>
            </div>
            <div>
              <span className="text-[13px] text-fog">Per-tx Cap</span>
              <div className="mt-1 text-[15px] text-obsidian tabular-nums">
                {formatMusd(state?.policy.maxPerTx ?? 0n)} mUSD
              </div>
            </div>
            <div>
              <span className="text-[13px] text-fog">Daily Cap</span>
              <div className="mt-1 text-[15px] text-obsidian tabular-nums">
                {formatMusd(state?.policy.dailyCap ?? 0n)} mUSD
              </div>
            </div>
            <div>
              <span className="text-[13px] text-fog">Gasless</span>
              <div className="mt-1">
                <GaslessStatusBadge
                  paymasterDeposit={state?.paymasterDeposit}
                  agentNative={state?.agentNative}
                  agentDeposit={state?.agentDeposit}
                  loading={loading && !state}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Analytics + Recent Activity side by side */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          {/* Approved vs Blocked Donut */}
          <div className="rounded-[16px] border border-ash bg-bone p-6">
            <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">
              Approved vs Blocked
            </h2>
            <div className="flex items-center gap-6">
              <ApprovedBlockedDonut
                approved={txStats?.approvedCount ?? approved.length}
                blocked={txStats?.blockedCount ?? blocked.length}
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-mint-signal" />
                  <span className="text-[13px] text-aubergine">
                    {txStats?.approvedCount ?? approved.length} approved
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blush-mist" />
                  <span className="text-[13px] text-aubergine">
                    {txStats?.blockedCount ?? blocked.length} blocked
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Block Reasons */}
          <div className="rounded-[16px] border border-ash bg-bone p-6">
            <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">
              Block Reasons
            </h2>
            <BlockReasonBars actions={history.actions} />
          </div>

          {/* Spending over time */}
          <div className="rounded-[16px] border border-ash bg-bone p-6">
            <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">
              Spending Over Time
            </h2>
            <SpendingBarChart actions={history.actions} />
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="mt-8 rounded-[16px] border border-ash bg-bone p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] uppercase tracking-wide text-fog">
              Recent Activity
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={history.refetch}
              disabled={history.loading}
            >
              {history.loading ? "..." : "Refresh"}
            </Button>
          </div>

          {history.actions.length === 0 && !history.loading ? (
            <div className="py-8 text-center text-[15px] text-fog">
              No transactions yet. Run the agent to see spending activity here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ash">
                    <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">
                      Status
                    </th>
                    <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">
                      Amount
                    </th>
                    <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">
                      Target
                    </th>
                    <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">
                      Decision
                    </th>
                    <th className="pb-3 text-[13px] font-medium uppercase tracking-wide text-fog">
                      Transaction
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ash/70">
                  {history.actions.slice(0, 10).map((a) => (
                    <tr key={`${a.txHash}:${a.logIndex}`} className="group">
                      <td className="py-3 pr-4">
                        <StateBadge kind={a.kind} />
                      </td>
                      <td className="py-3 pr-4 text-[15px] text-obsidian tabular-nums">
                        {formatMusd(a.amount)} mUSD
                      </td>
                      <td className="py-3 pr-4 text-[15px] text-fog">
                        {truncateAddress(a.target)}
                      </td>
                      <td className="py-3 pr-4 text-[15px] text-fog">
                        {a.kind === "blocked"
                          ? (a.reason ?? "policy")
                          : "vendor paid"}
                      </td>
                      <td className="py-3">
                        <TxChip
                          href={explorerTx(a.txHash)}
                          label={truncateHash(a.txHash)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sync Controls */}
        <div className="mt-6">
          <SyncPanel />
        </div>
      </div>
    </div>
  );
}
