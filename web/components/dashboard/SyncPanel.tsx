"use client";

import {useState} from "react";
import {getBase44Client} from "@/lib/base44";
import {getActiveContracts} from "@/lib/contracts";
import {Panel, PanelNote} from "./Panel";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Check, Dot} from "@/components/ui/Icons";

export function SyncPanel({className = ""}: {className?: string}) {
  const [syncingVault, setSyncingVault] = useState(false);
  const [syncingTx, setSyncingTx] = useState(false);
  const [lastVaultSync, setLastVaultSync] = useState<string | null>(null);
  const [lastTxSync, setLastTxSync] = useState<string | null>(null);
  const [vaultResult, setVaultResult] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);

  async function syncVaultState() {
    setSyncingVault(true);
    setVaultResult(null);
    try {
      const client = getBase44Client();
      const active = getActiveContracts();
      const raw = await client.functions.invoke("syncVaultState", {body: {vaultAddress: active.vault, agentAddress: active.agent}});
      const res = raw?.data ?? raw;
      setLastVaultSync(new Date().toLocaleTimeString());
      setVaultResult(res?.ok ? "Vault state synced" : res?.error ?? "Sync completed");
    } catch (e) {
      console.error("[SyncVault] exception:", e);
      setVaultResult(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncingVault(false);
    }
  }

  async function syncTransactions() {
    setSyncingTx(true);
    setTxResult(null);
    try {
      const client = getBase44Client();
      const active = getActiveContracts();
      const raw = await client.functions.invoke("syncTransactions", {body: {vaultAddress: active.vault, agentAddress: active.agent}});
      const res = raw?.data ?? raw;
      setLastTxSync(new Date().toLocaleTimeString());
      const msg = res?.ok
        ? `${res.new_records ?? 0} new records (${res.approved ?? 0} approved, ${res.blocked ?? 0} blocked)`
        : res?.error ?? "Sync completed";
      setTxResult(msg);
    } catch (e) {
      console.error("[SyncTx] exception:", e);
      setTxResult(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncingTx(false);
    }
  }

  return (
    <Panel title="Base44 Sync" subtitle="pull on-chain state into the backend" className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body-sm text-aubergine">Vault & policy state</p>
            {lastVaultSync && (
              <p className="text-caption text-fog">Last sync: {lastVaultSync}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={syncVaultState} disabled={syncingVault}>
            {syncingVault ? "Syncing..." : "Sync vault"}
          </Button>
        </div>
        {vaultResult && (
          <div className="text-body-sm text-fog">{vaultResult}</div>
        )}

        <div className="border-t border-ash" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body-sm text-aubergine">Transaction history</p>
            {lastTxSync && (
              <p className="text-caption text-fog">Last sync: {lastTxSync}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={syncTransactions} disabled={syncingTx}>
            {syncingTx ? "Syncing..." : "Sync transactions"}
          </Button>
        </div>
        {txResult && (
          <div className="text-body-sm text-fog">{txResult}</div>
        )}
      </div>
    </Panel>
  );
}
