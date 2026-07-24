"use client";

import {useAccount} from "wagmi";
import {DEMO} from "@/lib/contracts";
import {useVaultState, useActionHistory} from "@/lib/hooks";
import {isSameAddress} from "@/lib/format";
import {DashboardNav} from "@/components/dashboard/DashboardNav";
import {AgentHeader} from "@/components/dashboard/AgentHeader";
import {PolicyPanel} from "@/components/dashboard/PolicyPanel";
import {VaultPanel} from "@/components/dashboard/VaultPanel";
import {SponsorPanel} from "@/components/dashboard/SponsorPanel";
import {ActionHistoryPanel} from "@/components/dashboard/ActionHistoryPanel";
import {OwnerControls} from "@/components/dashboard/OwnerControls";
import {RunAgentPanel} from "@/components/dashboard/RunAgentPanel";
import {SyncPanel} from "@/components/dashboard/SyncPanel";
import {TxHistoryPanel} from "@/components/dashboard/TxHistoryPanel";
import {AuditTimelinePanel} from "@/components/dashboard/AuditTimelinePanel";
import {OverviewPanel} from "@/components/dashboard/OverviewPanel";
import {useVaultEntities} from "@/lib/base44-hooks";

export default function DashboardPage() {
  const agent = DEMO.agent;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const history = useActionHistory(agent);
  const {address, isConnected} = useAccount();
  const {data: vaultEntities} = useVaultEntities();
  const vaultId = vaultEntities?.[0]?.id;

  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  const refetchAll = () => {
    void refetch();
    void history.refetch();
  };

  return (
    <main className="min-h-screen bg-paper-white pb-24">
      <DashboardNav />
      <div className="mx-auto max-w-[1200px] px-6 pt-10">
        <AgentHeader agent={agent} state={state} loading={loading} onRefresh={refetchAll} />

        {/* DOM order = mobile priority (run + history first, controls last).
            Desktop uses explicit col/row placement - main column left, side column right. */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <OverviewPanel className="lg:col-span-3 lg:col-start-1 lg:row-start-1" />
          <RunAgentPanel refetch={refetchAll} className="lg:col-span-1 lg:col-start-3 lg:row-start-2" />
          <ActionHistoryPanel
            actions={history.actions}
            loading={history.loading}
            error={history.error}
            refetch={history.refetch}
            className="lg:col-span-2 lg:col-start-1 lg:row-start-4"
          />
          <SponsorPanel
            state={state}
            loading={loading}
            error={error}
            onRetry={refetch}
            className="lg:col-span-1 lg:col-start-3 lg:row-start-3"
          />
          <VaultPanel
            state={state}
            loading={loading}
            error={error}
            onRetry={refetch}
            className="lg:col-span-2 lg:col-start-1 lg:row-start-3"
          />
          <PolicyPanel
            agent={agent}
            state={state}
            loading={loading}
            error={error}
            onRetry={refetch}
            isOwner={isOwner}
            refetch={refetchAll}
            className="lg:col-span-2 lg:col-start-1 lg:row-start-2"
          />
          <OwnerControls
            agent={agent}
            isOwner={isOwner}
            connected={isConnected}
            refetch={refetchAll}
            className="lg:col-span-1 lg:col-start-3 lg:row-start-4"
          />
          <SyncPanel className="lg:col-span-1 lg:col-start-3 lg:row-start-5" />
          <TxHistoryPanel className="lg:col-span-2 lg:col-start-1 lg:row-start-5" />
          <AuditTimelinePanel vaultId={vaultId} className="lg:col-span-3 lg:col-start-1 lg:row-start-6" />
        </div>
      </div>
    </main>
  );
}
