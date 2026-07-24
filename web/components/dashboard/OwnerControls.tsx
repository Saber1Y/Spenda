"use client";

import {useEffect, useRef, useState} from "react";
import {isAddress, parseUnits, type Address} from "viem";
import {Panel, PanelNote} from "./Panel";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {ConnectionHint} from "./OwnerConnectButton";
import {CONTRACTS, DEMO, MUSD_DECIMALS, erc20Abi, vaultAbi} from "@/lib/contracts";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {recordAuditLog} from "@/lib/audit";

interface PendingAudit {
  action: string;
  metadata: Record<string, any>;
}

export function OwnerControls({
  agent,
  isOwner,
  connected,
  refetch,
  className = "",
}: {
  agent: Address;
  isOwner: boolean;
  connected: boolean;
  refetch: () => void;
  className?: string;
}) {
  const write = useOwnerWrite(refetch);
  const [fundAmt, setFundAmt] = useState("100");
  const [target, setTarget] = useState<string>(DEMO.vendor);
  const [token, setToken] = useState<string>(CONTRACTS.mockUSD);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const disabled = !isOwner || write.pending;
  const pendingAudit = useRef<PendingAudit | null>(null);

  useEffect(() => {
    if (write.okKey && pendingAudit.current) {
      const {action, metadata} = pendingAudit.current;
      recordAuditLog({action, actor: "user", actorType: "user", metadata, txHash: write.lastHash});
      pendingAudit.current = null;
    }
  }, [write.okKey, write.lastHash]);

  const fund = () => {
    let amt: bigint;
    try {
      amt = parseUnits(fundAmt || "0", MUSD_DECIMALS);
    } catch {
      return;
    }
    pendingAudit.current = {action: "VAULT_FUNDED", metadata: {amount: fundAmt, token: "mUSD"}};
    write.run({address: CONTRACTS.mockUSD, abi: erc20Abi, functionName: "mint", args: [CONTRACTS.vault, amt]});
  };
  const allowTarget = (allowed: boolean) => {
    if (!isAddress(target)) return;
    pendingAudit.current = {
      action: "ALLOWLIST_UPDATED",
      metadata: {kind: "target", address: target, allowed, agent_address: agent},
    };
    write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "setAllowedTarget", args: [agent, target as Address, allowed]});
  };
  const allowToken = (allowed: boolean) => {
    if (!isAddress(token)) return;
    pendingAudit.current = {
      action: "ALLOWLIST_UPDATED",
      metadata: {kind: "token", address: token, allowed, agent_address: agent},
    };
    write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "setAllowedToken", args: [agent, token as Address, allowed]});
  };
  const revoke = () => {
    pendingAudit.current = {action: "AGENT_REVOKED", metadata: {agent_address: agent}};
    write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "revokeAgent", args: [agent]});
  };

  return (
    <Panel title="Owner controls" subtitle="fund + configure the vault" className={className} action={<ConnectionHint isOwner={isOwner} connected={connected} />}>
      {!isOwner ? (
        <PanelNote>
          {connected
            ? "The connected wallet isn’t the vault owner — controls are read-only."
            : "Connect the vault owner wallet to fund and configure this agent."}
        </PanelNote>
      ) : null}

      <div className={`flex flex-col gap-6 ${!isOwner ? "pointer-events-none opacity-50" : ""}`}>
        {/* Fund vault */}
        <div className="flex flex-col gap-3">
          <Field label="Fund vault (mint mUSD)">
            <div className="flex gap-2">
              <TextInput inputMode="decimal" value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} className="flex-1" />
              <Button variant="primary" size="sm" onClick={fund} disabled={disabled}>
                Fund
              </Button>
            </div>
          </Field>
        </div>

        <div className="border-t border-ash" />

        {/* Allowlist target */}
        <Field label="Allowlisted target" hint="the address the agent may pay">
          <div className="flex flex-col gap-2">
            <TextInput value={target} onChange={(e) => setTarget(e.target.value)} className="w-full" spellCheck={false} />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => allowTarget(true)} disabled={disabled}>
                Allow
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => allowTarget(false)} disabled={disabled}>
                Remove
              </Button>
            </div>
          </div>
        </Field>

        {/* Allowlist token */}
        <Field label="Allowlisted token" hint="the ERC-20 the agent may spend">
          <div className="flex flex-col gap-2">
            <TextInput value={token} onChange={(e) => setToken(e.target.value)} className="w-full" spellCheck={false} />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => allowToken(true)} disabled={disabled}>
                Allow
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => allowToken(false)} disabled={disabled}>
                Remove
              </Button>
            </div>
          </div>
        </Field>

        <div className="border-t border-ash" />

        {/* Revoke */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-body-sm text-aubergine">Revoke agent</div>
            <div className="text-caption text-fog">hard off-switch — sets the policy inactive</div>
          </div>
          {confirmRevoke ? (
            <div className="flex gap-2">
              <Button variant="accent" size="sm" onClick={revoke} disabled={disabled}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)} disabled={write.pending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(true)} disabled={disabled}>
              Revoke
            </Button>
          )}
        </div>

        {write.pending ? <PanelNote>Confirming on-chain, then reading back…</PanelNote> : null}
        {write.error ? <PanelNote tone="error">{write.error}</PanelNote> : null}
      </div>
    </Panel>
  );
}
