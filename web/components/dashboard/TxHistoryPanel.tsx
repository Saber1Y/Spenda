"use client";

import {Panel, PanelNote} from "./Panel";
import {Row, Skeleton} from "@/components/ui/Row";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {useTransactionEntities} from "@/lib/base44-hooks";

function TxRow({tx}: {tx: Record<string, any>}) {
  const blocked = tx.status === "BLOCKED";
  return (
    <Row>
      <StateBadge kind={blocked ? "blocked" : "approved"} />
      <div className="min-w-0 flex-1">
        <div className="text-body text-aubergine tabular-nums">
          {tx.amount_display} {tx.token_symbol}{" "}
          <span className="text-fog">→ {truncateAddress(tx.recipient)}</span>
        </div>
        <div className="text-body-sm text-fog">
          {blocked ? `held · ${tx.block_reason ?? "policy"}` : "approved · vendor paid"}
        </div>
      </div>
      <TxChip href={explorerTx(tx.tx_hash)} label={truncateHash(tx.tx_hash)} />
    </Row>
  );
}

export function TxHistoryPanel({className = ""}: {className?: string}) {
  const {data: transactions, loading, error, refetch} = useTransactionEntities();

  const empty = !loading && (!transactions || transactions.length === 0);

  return (
    <Panel
      title="Transaction log"
      subtitle="synced from on-chain events via Base44"
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </Button>
      }
    >
      {loading && (!transactions || transactions.length === 0) ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </div>
      ) : error && (!transactions || transactions.length === 0) ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load transactions.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : empty ? (
        <PanelNote>No synced transactions yet. Run &ldquo;Sync transactions&rdquo; to pull on-chain events.</PanelNote>
      ) : (
        <div className="flex flex-col divide-y divide-ash">
          {transactions!.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </Panel>
  );
}
