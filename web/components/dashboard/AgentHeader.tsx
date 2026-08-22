import type {Address} from "viem";
import {CopyChip, TxChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {GaslessStatusBadge} from "./GaslessStatusBadge";
import {explorerAddress} from "@/lib/chain";
import {truncateAddress} from "@/lib/format";
import type {VaultState} from "@/lib/reads";

export function AgentHeader({
  agent,
  state,
  loading,
  onRefresh,
}: {
  agent: Address;
  state: VaultState | undefined;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-ash pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3">
        <span className="text-caption uppercase tracking-[0.08em] text-fog">Agent vault · BOT Chain mainnet</span>
        <h1 className="font-heading text-heading text-aubergine sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
          Spend control
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <CopyChip value={agent} label={truncateAddress(agent)} tone="lavender" />
          <TxChip href={explorerAddress(agent)} label="on BOTScan" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GaslessStatusBadge
          paymasterDeposit={state?.paymasterDeposit}
          agentNative={state?.agentNative}
          agentDeposit={state?.agentDeposit}
          loading={loading && !state}
        />
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
