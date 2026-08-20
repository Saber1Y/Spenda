"use client";

import {useAccount} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {useActiveVaultEntity, useBudgetEntities} from "@/lib/base44-hooks";
import {isSameAddress, formatMusd, formatBot, truncateAddress} from "@/lib/format";
import {explorerAddress} from "@/lib/chain";
import {Chip, CopyChip, TxChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Dot, Check, Hand} from "@/components/ui/Icons";
import {GaslessStatusBadge} from "@/components/dashboard/GaslessStatusBadge";

export default function AgentsPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const {data: state, loading, refetch} = useVaultState(agent);
  const vault = useActiveVaultEntity();
  const {data: budgets} = useBudgetEntities(vault?.id);
  const {address, isConnected} = useAccount();

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>
            Agents
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            Registered spending agents connected to your vault
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Agent Card */}
      <div className="mt-8 rounded-[16px] border border-ash bg-bone p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-orange/10 text-base-orange">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8l4 4 4-4h-4Z" />
              <rect x="4" y="12" width="16" height="9" rx="3" />
              <circle cx="9" cy="16" r="1" fill="currentColor" />
              <circle cx="15" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-medium text-obsidian">Agent</h2>
            <span className="text-[13px] text-fog">Primary spending agent</span>
          </div>
          {state?.policy.active ? (
            <Chip tone="mint"><Dot width={8} height={8} /> Active</Chip>
          ) : (
            <Chip tone="blush"><Hand width={12} height={12} /> Inactive</Chip>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div>
            <span className="text-[13px] uppercase tracking-wide text-fog">Wallet</span>
            <div className="mt-2 flex items-center gap-2">
              <CopyChip value={agent} label={truncateAddress(agent)} />
              <TxChip href={explorerAddress(agent)} label="BOTScan" />
            </div>
          </div>
          <div>
            <span className="text-[13px] uppercase tracking-wide text-fog">Connected Vault</span>
            <div className="mt-2">
              <CopyChip value={active.vault} label={truncateAddress(active.vault)} />
            </div>
          </div>
          <div>
            <span className="text-[13px] uppercase tracking-wide text-fog">Gasless Status</span>
            <div className="mt-2">
              <GaslessStatusBadge
                paymasterDeposit={state?.paymasterDeposit}
                agentNative={state?.agentNative}
                agentDeposit={state?.agentDeposit}
                loading={loading && !state}
              />
            </div>
          </div>
          <div>
            <span className="text-[13px] uppercase tracking-wide text-fog">Deployed Code</span>
            <div className="mt-2">
              {loading && !state ? (
                <span className="inline-block h-6 w-20 animate-pulse rounded bg-ash" />
              ) : state?.agentDeployed ? (
                <Chip tone="mint"><Check width={12} height={12} /> Deployed</Chip>
              ) : (
                <Chip tone="blush">Not deployed</Chip>
              )}
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-3">
            <span className="text-[13px] text-fog">Agent native balance</span>
            <div className="mt-1 text-[15px] text-obsidian tabular-nums">
              {loading && !state ? "--" : <>{formatBot(state?.agentNative ?? 0n)} <span className="text-fog">BOT</span></>}
            </div>
          </div>
          <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-3">
            <span className="text-[13px] text-fog">Agent EntryPoint deposit</span>
            <div className="mt-1 text-[15px] text-obsidian tabular-nums">
              {loading && !state ? "--" : <>{formatBot(state?.agentDeposit ?? 0n)} <span className="text-fog">BOT</span></>}
            </div>
          </div>
          <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-3">
            <span className="text-[13px] text-fog">Owner EOA balance</span>
            <div className="mt-1 text-[15px] text-obsidian tabular-nums">
              {loading && !state ? "--" : <>{formatBot(state?.ownerNative ?? 0n)} <span className="text-fog">BOT</span></>}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-medium text-obsidian">Authorization budgets</h2>
            <p className="mt-1 text-[13px] text-fog">Budgets are limits on the vault, not custodial balances.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
        {budgets?.length ? (
          <div className="mt-5 overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-ash"><th className="pb-3 text-caption text-fog">Agent</th><th className="pb-3 text-caption text-fog">Daily cap</th><th className="pb-3 text-caption text-fog">Spent</th><th className="pb-3 text-caption text-fog">Remaining</th><th className="pb-3 text-caption text-fog">Max tx</th></tr></thead><tbody className="divide-y divide-ash/70">{budgets.map((budget) => <tr key={budget.id}><td className="py-3 text-body-sm text-obsidian">{budget.display_name ?? truncateAddress(budget.agent_address)}</td><td className="py-3 text-body-sm tabular-nums">{formatMusd(BigInt(budget.daily_cap ?? "0"))} mUSD</td><td className="py-3 text-body-sm tabular-nums">{formatMusd(BigInt(budget.spent_today ?? "0"))} mUSD</td><td className="py-3 text-body-sm tabular-nums text-mint-signal">{formatMusd(BigInt(budget.remaining_daily ?? "0"))} mUSD</td><td className="py-3 text-body-sm tabular-nums">{formatMusd(BigInt(budget.max_per_transaction ?? "0"))} mUSD</td></tr>)}</tbody></table></div>
        ) : <p className="mt-5 text-body-sm text-fog">Run budget synchronization after registering more than one agent.</p>}
      </div>
    </div>
  );
}
