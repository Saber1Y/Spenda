"use client";

import {useState} from "react";
import {parseEther} from "viem";
import {getActiveContracts, paymasterAbi} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {formatBot} from "@/lib/format";
import {StatTile} from "@/components/ui/StatTile";
import {Chip} from "@/components/ui/Chip";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Dot, Check} from "@/components/ui/Icons";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {recordAuditLog} from "@/lib/audit";

function InvariantRow({label, holds, value}: {label: string; holds: boolean; value: string}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-ash/70 last:border-0">
      <span className="text-[15px] text-fog">{label}</span>
      <span className="flex items-center gap-2 text-[15px] text-obsidian tabular-nums">
        {value}
        {holds && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint-signal/15 text-mint-signal">
            <Check width={12} height={12} />
          </span>
        )}
      </span>
    </div>
  );
}

export default function GasPage() {
  const active = getActiveContracts();
  const agent = active.agent;
  const {data: state, loading, refetch} = useVaultState(agent);
  const write = useOwnerWrite(refetch);
  const [paymasterFundAmt, setPaymasterFundAmt] = useState("0.05");

  const fundPaymaster = () => {
    let amt;
    try { amt = parseEther(paymasterFundAmt || "0"); } catch { return; }
    recordAuditLog({action: "VAULT_FUNDED", actor: "user", actorType: "user", metadata: {amount: paymasterFundAmt, token: "BOT", target: "paymaster"}});
    write.run({address: active.paymaster, abi: paymasterAbi, functionName: "deposit", args: [], value: amt});
  };

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-heading text-obsidian" style={{fontWeight: 350}}>
            Gas Sponsorship
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            Agents don&apos;t need to hold native BOT to execute approved transactions.
            The paymaster sponsors gas while the vault enforces spending policy.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Status Banner */}
      <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
        <div className="flex items-center gap-3 mb-4">
          {loading && !state ? (
            <span className="inline-block h-6 w-24 animate-pulse rounded bg-ash" />
          ) : (state?.paymasterDeposit ?? 0n) > 0n ? (
            <Chip tone="mint"><Dot width={8} height={8} /> Gasless active</Chip>
          ) : (
            <Chip tone="blush"><Dot width={8} height={8} /> Sponsor unfunded</Chip>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6">
          <StatTile
            label="Paymaster Deposit"
            value={loading && !state ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-ash" /> : <>{formatBot(state?.paymasterDeposit ?? 0n)} <span className="text-fog text-body">BOT</span></>}
            sub={state && state.paymasterDeposit > 0n ? "funds every gasless UserOp" : "unfunded - gasless paused"}
          />
          <StatTile
            label="Agent Native"
            value={loading && !state ? "--" : <>{formatBot(state?.agentNative ?? 0n)} <span className="text-fog text-body">BOT</span></>}
            sub="should be 0"
          />
          <StatTile
            label="Agent Deposit"
            value={loading && !state ? "--" : <>{formatBot(state?.agentDeposit ?? 0n)} <span className="text-fog text-body">BOT</span></>}
            sub="should be 0"
          />
          <StatTile
            label="Owner EOA"
            value={loading && !state ? "--" : <>{formatBot(state?.ownerNative ?? 0n)} <span className="text-fog text-body">BOT</span></>}
          />
        </div>
      </div>

      {/* Invariant Check */}
      <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
        <h2 className="text-[13px] uppercase tracking-wide text-fog mb-3">Security Invariants</h2>
        <p className="text-[15px] text-fog mb-4">The agent should never hold native tokens or EntryPoint deposits.</p>
        <div className="rounded-[12px] border border-ash bg-paper-white px-4 py-1">
          <InvariantRow label="Agent native balance" holds={state?.agentNative === 0n} value={`${formatBot(state?.agentNative ?? 0n)} BOT`} />
          <InvariantRow label="Agent EntryPoint deposit" holds={state?.agentDeposit === 0n} value={`${formatBot(state?.agentDeposit ?? 0n)} BOT`} />
          <InvariantRow label="Paymaster funded" holds={(state?.paymasterDeposit ?? 0n) > 0n} value={`${formatBot(state?.paymasterDeposit ?? 0n)} BOT`} />
        </div>
      </div>

      {/* Fund Paymaster */}
      <div className="mt-6 rounded-[16px] border border-ash bg-bone p-6">
        <h2 className="text-[13px] uppercase tracking-wide text-fog mb-2">Fund Paymaster</h2>
        <p className="text-[15px] text-fog mb-4">Deposit native BOT to the EntryPoint to sponsor gasless transactions.</p>
        <Field label="Amount (BOT)" hint="native BOT goes to EntryPoint deposit for gasless ops">
          <div className="flex gap-2">
            <TextInput inputMode="decimal" value={paymasterFundAmt} onChange={(e) => setPaymasterFundAmt(e.target.value)} className="flex-1" />
            <Button variant="primary" size="sm" onClick={fundPaymaster} disabled={write.pending}>
              {write.pending ? "Confirming..." : "Fund"}
            </Button>
          </div>
        </Field>
        {write.error && (
          <div className="mt-3 rounded-[12px] border border-blush-mist bg-blush-mist/30 px-4 py-3 text-[15px] text-aubergine">{write.error}</div>
        )}
      </div>
    </div>
  );
}
