import {Panel, PanelNote} from "./Panel";
import {Row, Skeleton} from "@/components/ui/Row";
import {Button} from "@/components/ui/Button";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip} from "@/components/ui/Chip";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import type {AgentAction} from "@/lib/reads";

function ActionRow({action}: {action: AgentAction}) {
  const blocked = action.kind === "blocked";
  return (
    <Row>
      <StateBadge kind={action.kind} />
      <div className="min-w-0 flex-1">
        <div className="text-body text-aubergine tabular-nums">
          {formatMusd(action.amount)} USDT <span className="text-fog">→ {truncateAddress(action.target)}</span>
        </div>
        <div className="text-body-sm text-fog">
          {blocked ? `held · ${action.reason ?? "policy"}` : "approved · vendor paid"}
        </div>
      </div>
      <TxChip href={explorerTx(action.txHash)} label={truncateHash(action.txHash)} />
    </Row>
  );
}

export function ActionHistoryPanel({
  actions,
  loading,
  error,
  refetch,
  className = "",
}: {
  actions: AgentAction[];
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
  className?: string;
}) {
  const empty = !loading && actions.length === 0;
  return (
    <Panel
      title="Action history"
      subtitle="every approved and held decision, newest first"
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </Button>
      }
    >
      {loading && actions.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </div>
      ) : error && actions.length === 0 ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load history.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : empty ? (
        <PanelNote>No actions yet. This agent hasn&rsquo;t spent.</PanelNote>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-ash">
            {actions.map((a) => (
              <ActionRow key={`${a.txHash}:${a.logIndex}`} action={a} />
            ))}
          </div>
          {error && actions.length > 0 ? (
            <p className="text-caption text-fog">Showing last loaded. The latest refresh didn&rsquo;t reach the node.</p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
