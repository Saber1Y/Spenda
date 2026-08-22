"use client";

import {useState} from "react";
import {parseUnits, type Address} from "viem";
import {useAccount} from "wagmi";
import {getActiveContracts, MUSD_DECIMALS, vaultAbi} from "@/lib/contracts";
import {useVaultState, useActionHistory} from "@/lib/hooks";
import {isSameAddress, formatMusd, formatExpiry, truncateAddress} from "@/lib/format";
import {StatTile} from "@/components/ui/StatTile";
import {Chip, CopyChip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput, Toggle} from "@/components/ui/Input";
import {Check, Hand} from "@/components/ui/Icons";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {DailyCapMeter} from "@/components/dashboard/DailyCapMeter";

export default function PoliciesPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const history = useActionHistory(agent);
  const {address, isConnected} = useAccount();
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  const [editing, setEditing] = useState(false);
  const write = useOwnerWrite(() => {
    refetch();
    setEditing(false);
  });

  const noPolicy = state ? state.policy.lastResetTime === 0n : false;

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>
            Policies
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            The on-chain leash that governs agent spending
          </p>
        </div>
        {isOwner && state && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit Policy
          </Button>
        )}
      </div>

      {/* Policy Status */}
      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="rounded-[16px] border border-ash bg-bone p-6">
          <span className="text-[13px] uppercase tracking-wide text-fog">Status</span>
          <div className="mt-3">
            {loading && !state ? (
              <span className="inline-block h-7 w-20 animate-pulse rounded bg-ash" />
            ) : noPolicy ? (
              <Chip tone="outline">No policy set</Chip>
            ) : state?.policy.active ? (
              <Chip tone="mint"><Check width={13} height={13} /> Active</Chip>
            ) : (
              <Chip tone="blush"><Hand width={13} height={13} /> Revoked</Chip>
            )}
          </div>
          {state && !noPolicy && (
            <div className="mt-3 text-[15px] text-fog">
              Expires {formatExpiry(state.policy.expiry).label}
            </div>
          )}
        </div>

        <div className="rounded-[16px] border border-ash bg-bone p-6">
          <StatTile
            label="Per-tx Cap"
              value={loading && !state ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-ash" /> : <>{formatMusd(state?.policy.maxPerTx ?? 0n)} <span className="text-fog text-body">USDT</span></>}
          />
        </div>

        <div className="rounded-[16px] border border-ash bg-bone p-6">
          <StatTile
            label="Daily Cap"
              value={loading && !state ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-ash" /> : <>{formatMusd(state?.policy.dailyCap ?? 0n)} <span className="text-fog text-body">USDT</span></>}
          />
        </div>
      </div>

      {/* Daily Cap Meter */}
      {state && !noPolicy && (
        <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">Daily Spending</h2>
          <DailyCapMeter spent={state.policy.spentToday} cap={state.policy.dailyCap} remaining={state.remainingDailyCap} />
        </div>
      )}

      {/* Allowlists */}
      {state && (
        <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">Allowlist Status</h2>
          <div className="flex flex-wrap gap-3">
            <Chip tone={state.targetAllowed ? "lavender" : "outline"}>
              {state.targetAllowed ? <Check width={12} height={12} /> : null}
              Target: {truncateAddress(active.vendor)}
            </Chip>
            <Chip tone={state.tokenAllowed ? "lavender" : "outline"}>
              {state.tokenAllowed ? <Check width={12} height={12} /> : null}
              Token: USDT ({truncateAddress(active.mockUSD)})
            </Chip>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && state && (
        <div className="mt-6 rounded-[16px] border border-base-orange/20 bg-base-orange-light p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">Edit Policy</h2>
          <PolicyForm agent={agent} state={state} write={write} vaultAddress={active.vault} onCancel={() => setEditing(false)} />
        </div>
      )}

      {/* Revoke Agent */}
      <div className="mt-8 rounded-[16px] border border-blush-mist/50 bg-blush-mist/20 p-6">
        <h2 className="text-[13px] uppercase tracking-wide text-fog mb-2">Emergency Controls</h2>
        <RevokeAgentSection agent={agent} isOwner={isOwner} refetch={refetch} />
      </div>
    </div>
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
  state: {policy: {maxPerTx: bigint; dailyCap: bigint; active: boolean; expiry: bigint}};
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
    } catch { return; }
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
      <div className="grid grid-cols-2 gap-4">
              <Field label="Per-tx cap (USDT)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
              <Field label="Daily cap (USDT)">
          <TextInput inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
        </Field>
        <Field label="Expiry (days from now)" hint="0 = never expires">
          <TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Active">
          <Toggle checked={active} onChange={setActive} label={active ? "policy active" : "inactive"} />
        </Field>
      </div>
      {write.error && <div className="rounded-[12px] border border-blush-mist bg-blush-mist/30 px-4 py-3 text-[15px] text-aubergine">{write.error}</div>}
      {write.pending && <div className="text-[15px] text-fog">Confirming on-chain, then reading back...</div>}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={submit} disabled={write.pending}>
          {write.pending ? "Confirming..." : "Save Policy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={write.pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RevokeAgentSection({
  agent,
  isOwner,
  refetch,
}: {
  agent: Address;
  isOwner: boolean;
  refetch: () => void;
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const write = useOwnerWrite(refetch);
  const active = getActiveContracts();
  const disabled = !isOwner || write.pending;

  const revoke = () => {
    write.run({address: active.vault, abi: vaultAbi, functionName: "revokeAgent", args: [agent]});
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[15px] text-aubergine">Revoke agent</p>
        <p className="text-[13px] text-fog">Hard off-switch - sets the policy inactive. This action cannot be undone.</p>
      </div>
      {confirmRevoke ? (
        <div className="flex gap-2">
          <Button variant="accent" size="sm" onClick={revoke} disabled={disabled}>
            Confirm Revoke
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)} disabled={write.pending}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(true)} disabled={disabled}>
          Revoke Agent
        </Button>
      )}
      {write.error && <div className="mt-2 text-[13px] text-blush">{write.error}</div>}
    </div>
  );
}
