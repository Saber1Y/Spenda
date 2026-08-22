import {Panel, PanelNote} from "./Panel";
import {StatTile} from "@/components/ui/StatTile";
import {Skeleton} from "@/components/ui/Row";
import {Button} from "@/components/ui/Button";
import {DailyCapMeter} from "./DailyCapMeter";
import {formatMusd} from "@/lib/format";
import type {VaultState} from "@/lib/reads";

export function VaultPanel({
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
    <Panel title="Vault" subtitle="funds held + daily cap" className={className}>
      {!state && loading ? (
        <div className="space-y-5">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : !state && error ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load the vault.{" "}
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : state ? (
        <div className="flex flex-col gap-6">
          <StatTile
            label="Vault balance"
            value={
              <>
                {formatMusd(state.vaultBalance)} <span className="text-body text-fog">USDT</span>
              </>
            }
            sub={state.vaultBalance === 0n ? "fund the vault to enable spends" : undefined}
          />
          <DailyCapMeter spent={state.policy.spentToday} cap={state.policy.dailyCap} remaining={state.remainingDailyCap} />
          {state.vaultBalance === 0n ? (
            <div className="flex justify-start">
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Refresh
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
