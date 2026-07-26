import {Panel, PanelNote} from "./Panel";
import {StatTile} from "@/components/ui/StatTile";
import {Skeleton} from "@/components/ui/Row";
import {Check} from "@/components/ui/Icons";
import {formatBot} from "@/lib/format";
import type {VaultState} from "@/lib/reads";

function InvariantRow({label, holds, value}: {label: string; holds: boolean; value: string}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-body-sm text-fog">{label}</span>
      <span className="flex items-center gap-2 text-body-sm text-aubergine tabular-nums">
        {value}
        {holds ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-mint-signal/15 text-mint-signal">
            <Check width={12} height={12} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function SponsorPanel({
  state,
  loading,
  error,
  onRetry,
  className = "",
}: {
  state: VaultState | undefined;
  loading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Panel title="Sponsor" subtitle="who pays the gas" className={className}>
      {!state && loading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      ) : !state && error ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load sponsor status.{" "}
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : state ? (
        <div className="flex flex-col gap-5">
          <StatTile
            label="Paymaster deposit"
            value={
              <>
                {formatBot(state.paymasterDeposit)} <span className="text-body text-fog">BOT</span>
              </>
            }
            sub={state.paymasterDeposit > 0n ? "funds every gasless UserOp" : "unfunded, gasless paused"}
          />
          <div className="rounded-card border border-ash bg-bone p-4">
            <span className="text-caption uppercase tracking-[0.06em] text-fog">Agent holds nothing</span>
            <div className="mt-2 divide-y divide-ash/70">
              <InvariantRow label="Agent native" holds={state.agentNative === 0n} value={`${formatBot(state.agentNative)} BOT`} />
              <InvariantRow label="Agent deposit" holds={state.agentDeposit === 0n} value={`${formatBot(state.agentDeposit)} BOT`} />
              <InvariantRow label="Owner EOA" holds={state.ownerNative === 0n} value={`${formatBot(state.ownerNative)} BOT`} />
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
