"use client";

import {useEffect, useState} from "react";
import {getAbiItem} from "viem";
import {getActiveContracts, vaultAbi} from "@/lib/contracts";
import {readIntentMeta, type IntentMeta} from "@/lib/intentStore";
import {publicClient, explorerTx} from "@/lib/chain";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {Button} from "@/components/ui/Button";
import {Chip, TxChip} from "@/components/ui/Chip";

interface Row {
  kind: "approved" | "blocked";
  agent: string;
  target: string;
  amount: bigint;
  reason?: string;
  actionId?: string;
  blockNumber: bigint;
  txHash: string;
}

const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

export default function ReceiptsPage() {
  const active = getActiveContracts();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Record<string, IntentMeta>>({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    void (async () => {
      setMeta(readIntentMeta());
      try {
        const latest = await publicClient.getBlockNumber();
        // From deployment forward - the live stack is young enough that a
        // full-range query is cheap and misses nothing.
        const fromBlock = active.deployBlock > 0n ? active.deployBlock : latest - 50_000n;
        const [approved, blocked] = await Promise.all([
          publicClient.getLogs({address: active.vault, event: approvedEvent, fromBlock, toBlock: latest}),
          publicClient.getLogs({address: active.vault, event: blockedEvent, fromBlock, toBlock: latest}),
        ]);
        if (!alive) return;
        const rowsOut: Row[] = [
          ...approved.map((l) => ({kind: "approved" as const, agent: l.args.agent!, target: l.args.target!, amount: l.args.amount!, actionId: l.args.actionId, blockNumber: l.blockNumber!, txHash: l.transactionHash!})),
          ...blocked.map((l) => ({kind: "blocked" as const, agent: l.args.agent!, target: l.args.target!, amount: l.args.amount!, reason: l.args.reason, blockNumber: l.blockNumber!, txHash: l.transactionHash!})),
        ];
        rowsOut.sort((a, b) => a.blockNumber === b.blockNumber ? Number(b.txHash.slice(2, 10)) : Number(b.blockNumber - a.blockNumber));
        setRows(rowsOut);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [active.vault, active.deployBlock]);

  const rowsFiltered = rows.filter((row) => filter === "all" || row.kind === filter);
  return <div className="max-w-[1200px] px-8 py-8">
    <div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Spending receipts</h1><p className="mt-1 text-[15px] text-fog">Every policy decision and payment, read directly from chain events.</p></div><Button variant="secondary" size="sm" onClick={() => window.location.reload()} disabled={loading}>Refresh</Button></div>
    <div className="mt-6 flex gap-2">{["all", "approved", "blocked"].map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-pill px-3 py-1.5 text-[13px] ${filter === value ? "bg-base-orange text-paper-white" : "bg-bone text-fog"}`}>{value}</button>)}</div>
    <div className="mt-6 overflow-x-auto rounded-[16px] border border-ash bg-bone p-6">
      <table className="w-full text-left">
        <thead><tr className="border-b border-ash"><th className="pb-3 text-caption text-fog">Decision</th><th className="pb-3 text-caption text-fog">Amount</th><th className="pb-3 text-caption text-fog">Agent</th><th className="pb-3 text-caption text-fog">Recipient</th><th className="pb-3 text-caption text-fog">Context</th><th className="pb-3 text-caption text-fog">Transaction</th></tr></thead>
        <tbody className="divide-y divide-ash/70">
          {rowsFiltered.map((row) => {
            const m = row.actionId ? meta[row.actionId.toLowerCase()] : undefined;
            return <tr key={`${row.txHash}-${row.actionId ?? ""}`}>
              <td className="py-3"><Chip tone={row.kind === "blocked" ? "blush" : "mint"}>{row.kind}</Chip></td>
              <td className="py-3 text-body-sm tabular-nums">{formatMusd(row.amount)}</td>
              <td className="py-3 text-body-sm text-fog">{truncateAddress(row.agent)}</td>
              <td className="py-3 text-body-sm text-fog">{truncateAddress(row.target)}</td>
              <td className="py-3 text-body-sm text-fog">{m ? `${m.label}${m.riskScore !== null ? ` - risk ${m.riskScore}/100` : ""}` : row.reason ?? "-"}</td>
              <td className="py-3">{<TxChip href={explorerTx(row.txHash)} label={truncateHash(row.txHash)} />}</td>
            </tr>;
          })}
          {!loading && rowsFiltered.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-body-sm text-fog">No decisions recorded yet.</td></tr>}
          {loading && <tr><td colSpan={6} className="py-6 text-center text-body-sm text-fog">Reading chain events...</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
