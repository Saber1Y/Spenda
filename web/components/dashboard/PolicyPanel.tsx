"use client";

import {useState} from "react";
import {parseUnits, type Address} from "viem";
import {Panel, PanelNote} from "./Panel";
import {StatTile} from "@/components/ui/StatTile";
import {Chip} from "@/components/ui/Chip";
import {Skeleton} from "@/components/ui/Row";
import {Button} from "@/components/ui/Button";
import {Field, TextInput, Toggle} from "@/components/ui/Input";
import {Check, Hand} from "@/components/ui/Icons";
import {formatMusd, formatExpiry, truncateAddress} from "@/lib/format";
import {CONTRACTS, MUSD_DECIMALS, vaultAbi, getActiveContracts} from "@/lib/contracts";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import type {VaultState} from "@/lib/reads";

export function PolicyPanel({
  agent,
  state,
  loading,
  error,
  onRetry,
  isOwner,
  refetch,
  className = "",
}: {
  agent: Address;
  state: VaultState | undefined;
  loading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  isOwner: boolean;
  refetch: () => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const write = useOwnerWrite(() => {
    refetch();
    setEditing(false);
  });

  const active = getActiveContracts();
  const noPolicy = state ? state.policy.lastResetTime === 0n : false;
  const editAction =
    isOwner && state && !editing ? (
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
    ) : undefined;

  return (
    <Panel title="Policy" subtitle="the on-chain leash" action={editAction} className={className}>
      {!state && loading ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      ) : !state && error ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load the policy.{" "}
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : editing && state ? (
        <PolicyForm agent={agent} state={state} write={write} vaultAddress={active.vault} onCancel={() => setEditing(false)} />
      ) : noPolicy ? (
        <PanelNote>No policy set for this agent yet.</PanelNote>
      ) : state ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            {state.policy.active ? (
              <Chip tone="mint">
                <Check width={13} height={13} /> Active
              </Chip>
            ) : (
              <Chip tone="blush">
                <Hand width={13} height={13} /> Revoked
              </Chip>
            )}
            <Chip tone="outline">expires {formatExpiry(state.policy.expiry).label}</Chip>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <StatTile label="Per-tx cap" value={<>{formatMusd(state.policy.maxPerTx)} <span className="text-body text-fog">mUSD</span></>} />
            <StatTile label="Daily cap" value={<>{formatMusd(state.policy.dailyCap)} <span className="text-body text-fog">mUSD</span></>} />
          </div>

          <div>
            <span className="text-caption uppercase tracking-[0.06em] text-fog">Allowlisted</span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone={state.targetAllowed ? "lavender" : "outline"}>
                {state.targetAllowed ? <Check width={12} height={12} /> : null}
                target {truncateAddress(active.vendor)}
              </Chip>
              <Chip tone={state.tokenAllowed ? "lavender" : "outline"}>
                {state.tokenAllowed ? <Check width={12} height={12} /> : null}
                mUSD {truncateAddress(CONTRACTS.mockUSD)}
              </Chip>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function PolicyForm({
  agent,
  state,
  write,
  vaultAddress,
  onCancel,
}: {
  agent: Address;
  state: VaultState;
  write: ReturnType<typeof useOwnerWrite>;
  vaultAddress: Address;
  onCancel: () => void;
}) {
  const [maxPerTx, setMaxPerTx] = useState(formatMusd(state.policy.maxPerTx));
  const [dailyCap, setDailyCap] = useState(formatMusd(state.policy.dailyCap));
  const [days, setDays] = useState("30");
  const [active, setActive] = useState(state.policy.active);

  const submit = () => {
    let mpt: bigint, dc: bigint;
    try {
      mpt = parseUnits(maxPerTx || "0", MUSD_DECIMALS);
      dc = parseUnits(dailyCap || "0", MUSD_DECIMALS);
    } catch {
      return;
    }
    const d = Number(days);
    const expiry = !d || d <= 0 ? 0n : BigInt(Math.floor(Date.now() / 1000) + d * 86400);
    write.run({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "setAgentPolicy",
      args: [agent, mpt, dc, expiry, active],
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Per-tx cap (mUSD)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
        <Field label="Daily cap (mUSD)">
          <TextInput inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
        </Field>
        <Field label="Expiry (days from now)" hint="0 = never expires">
          <TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Active">
          <Toggle checked={active} onChange={setActive} label={active ? "policy active" : "inactive"} />
        </Field>
      </div>

      {write.error ? <PanelNote tone="error">{write.error}</PanelNote> : null}

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={submit} disabled={write.pending}>
          {write.pending ? "Confirming…" : "Save policy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={write.pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
