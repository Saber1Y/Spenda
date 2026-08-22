"use client";

import {useRouter} from "next/navigation";
import {Panel, PanelNote} from "@/components/dashboard/Panel";
import {Button} from "@/components/ui/Button";
import {CONTRACTS, DEMO} from "@/lib/contracts";

const short = (value: string) => `${value.slice(0, 10)}...${value.slice(-6)}`;

export default function DeployPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-paper-white pb-24">
      <div className="mx-auto max-w-[720px] px-6 pt-10">
        <Panel title="Mainnet stack" subtitle="BOT Chain 677 · deployed and verified">
          <div className="flex flex-col gap-5">
            <PanelNote>
              Spenda is already deployed on BOT Chain mainnet. This dashboard uses official bridged USDT;
              it does not deploy or mint a mock token here.
            </PanelNote>

            <div className="space-y-3 rounded-[14px] border border-ash bg-bone p-4 text-body-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-fog">Vault</span><code>{short(CONTRACTS.vault)}</code></div>
              <div className="flex items-center justify-between gap-4"><span className="text-fog">Paymaster</span><code>{short(CONTRACTS.paymaster)}</code></div>
              <div className="flex items-center justify-between gap-4"><span className="text-fog">Agent</span><code>{short(DEMO.agent)}</code></div>
              <div className="flex items-center justify-between gap-4"><span className="text-fog">Spend token</span><code>USDT · 6 decimals</code></div>
            </div>

            <p className="text-body-sm leading-6 text-fog">
              The pilot vault is funded and its agent policy is active. Use Owner Controls to transfer USDT into
              the vault, manage allowlists, or top up the BOT paymaster deposit.
            </p>

            <Button variant="primary" size="md" onClick={() => router.push("/dashboard")}>
              Open mainnet dashboard
            </Button>
          </div>
        </Panel>
      </div>
    </main>
  );
}
