"use client";

import {useState} from "react";
import {isAddress, type Address} from "viem";
import {getActiveContracts, vaultAbi} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {truncateAddress} from "@/lib/format";
import {Chip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Check} from "@/components/ui/Icons";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {recordAuditLog} from "@/lib/audit";

export default function AllowlistPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const {data: state, loading, refetch} = useVaultState(agent);
  const write = useOwnerWrite(refetch);
  const [target, setTarget] = useState<string>(active.vendor);
  const [token, setToken] = useState<string>(active.mockUSD);

  const allowTarget = (allowed: boolean) => {
    if (!isAddress(target)) return;
    recordAuditLog({
      action: "ALLOWLIST_UPDATED",
      actor: "user",
      actorType: "user",
      metadata: {kind: "target", address: target, allowed, agent_address: agent},
    });
    write.run({address: active.vault, abi: vaultAbi, functionName: "setAllowedTarget", args: [agent, target as Address, allowed]});
  };

  const allowToken = (allowed: boolean) => {
    if (!isAddress(token)) return;
    recordAuditLog({
      action: "ALLOWLIST_UPDATED",
      actor: "user",
      actorType: "user",
      metadata: {kind: "token", address: token, allowed, agent_address: agent},
    });
    write.run({address: active.vault, abi: vaultAbi, functionName: "setAllowedToken", args: [agent, token as Address, allowed]});
  };

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>
            Allowlist
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            Addresses and tokens the agent is permitted to interact with
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Current Allowlist Status */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        {/* Approved Targets */}
        <div className="rounded-[16px] border border-ash bg-bone p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">Approved Targets</h2>
          <p className="text-[15px] text-fog mb-4">The addresses the agent may send payments to.</p>

          {state?.targetAllowed ? (
            <div className="flex items-center gap-3 rounded-[12px] border border-mint-signal/20 bg-mint-signal/5 px-4 py-3">
              <Check width={14} height={14} className="text-mint-signal" />
              <span className="text-[15px] text-obsidian tabular-nums">{truncateAddress(active.vendor)}</span>
              <span className="text-[13px] text-fog">allowed</span>
            </div>
          ) : (
            <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-3 text-[15px] text-fog">
              No targets allowlisted.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <Field label="Target address" hint="the address the agent may pay">
              <TextInput value={target} onChange={(e) => setTarget(e.target.value)} className="w-full" spellCheck={false} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => allowTarget(true)} disabled={write.pending}>
                Allow
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => allowTarget(false)} disabled={write.pending}>
                Remove
              </Button>
            </div>
          </div>
        </div>

        {/* Approved Tokens */}
        <div className="rounded-[16px] border border-ash bg-bone p-6">
          <h2 className="text-[13px] uppercase tracking-wide text-fog mb-4">Approved Tokens</h2>
          <p className="text-[15px] text-fog mb-4">The ERC-20 tokens the agent may spend.</p>

          {state?.tokenAllowed ? (
            <div className="flex items-center gap-3 rounded-[12px] border border-mint-signal/20 bg-mint-signal/5 px-4 py-3">
              <Check width={14} height={14} className="text-mint-signal" />
              <span className="text-[15px] text-obsidian tabular-nums">mUSD ({truncateAddress(active.mockUSD)})</span>
              <span className="text-[13px] text-fog">allowed</span>
            </div>
          ) : (
            <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-3 text-[15px] text-fog">
              No tokens allowlisted.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <Field label="Token address" hint="the ERC-20 the agent may spend">
              <TextInput value={token} onChange={(e) => setToken(e.target.value)} className="w-full" spellCheck={false} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => allowToken(true)} disabled={write.pending}>
                Allow
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => allowToken(false)} disabled={write.pending}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>

      {write.pending && (
        <div className="mt-4 text-[15px] text-fog">Confirming on-chain...</div>
      )}
      {write.error && (
        <div className="mt-4 rounded-[12px] border border-blush-mist bg-blush-mist/30 px-4 py-3 text-[15px] text-aubergine">
          {write.error}
        </div>
      )}
    </div>
  );
}
