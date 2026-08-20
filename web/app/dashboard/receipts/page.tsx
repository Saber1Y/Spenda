"use client";

import {useState} from "react";
import {getActiveContracts} from "@/lib/contracts";
import {useActiveVaultEntity, useReceiptEntities} from "@/lib/base44-hooks";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {Button} from "@/components/ui/Button";
import {Chip, TxChip} from "@/components/ui/Chip";

export default function ReceiptsPage() {
  const vault = useActiveVaultEntity();
  const {data: receipts, loading, refetch} = useReceiptEntities(vault?.id);
  const [filter, setFilter] = useState("all");
  const rows = (receipts ?? []).filter((receipt) => filter === "all" || receipt.decision === filter);
  return <div className="max-w-[1200px] px-8 py-8"><div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Spending receipts</h1><p className="mt-1 text-[15px] text-fog">A searchable record of every policy decision and payment.</p></div><Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>Refresh</Button></div><div className="mt-6 flex gap-2">{["all", "approved", "blocked", "human_approved", "human_rejected"].map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-pill px-3 py-1.5 text-[13px] ${filter === value ? "bg-base-orange text-paper-white" : "bg-bone text-fog"}`}>{value.replace("_", " ")}</button>)}</div><div className="mt-6 overflow-x-auto rounded-[16px] border border-ash bg-bone p-6"><table className="w-full text-left"><thead><tr className="border-b border-ash"><th className="pb-3 text-caption text-fog">Decision</th><th className="pb-3 text-caption text-fog">Amount</th><th className="pb-3 text-caption text-fog">Agent</th><th className="pb-3 text-caption text-fog">Recipient</th><th className="pb-3 text-caption text-fog">Risk</th><th className="pb-3 text-caption text-fog">Transaction</th></tr></thead><tbody className="divide-y divide-ash/70">{rows.map((receipt) => <tr key={receipt.id}><td className="py-3"><Chip tone={receipt.decision === "blocked" || receipt.decision === "human_rejected" ? "blush" : "mint"}>{receipt.decision}</Chip></td><td className="py-3 text-body-sm tabular-nums">{formatMusd(BigInt(receipt.amount ?? "0"))}</td><td className="py-3 text-body-sm text-fog">{truncateAddress(receipt.agent_address ?? receipt.agent_id)}</td><td className="py-3 text-body-sm text-fog">{truncateAddress(receipt.recipient)}</td><td className="py-3 text-body-sm tabular-nums">{receipt.risk_score ?? 0}</td><td className="py-3">{receipt.transaction_hash ? <TxChip href={explorerTx(receipt.transaction_hash)} label={truncateHash(receipt.transaction_hash)} /> : <span className="text-caption text-fog">Not executed</span>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="py-10 text-center text-body-sm text-fog">No receipts match this filter.</p>}</div></div>;
}
