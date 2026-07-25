"use client";

import {useEffect, useState} from "react";
import {Panel, PanelNote} from "./Panel";
import {Button} from "@/components/ui/Button";
import {Row} from "@/components/ui/Row";
import {StateBadge} from "@/components/ui/StateBadge";
import {Chip, TxChip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";
import {formatMusd, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {getActiveContracts} from "@/lib/contracts";
import {pollUserOpReceipt, resolveOutcome, type RunOutcome} from "@/lib/bundler";

type Phase = "idle" | "running" | "polling" | "resolved" | "error";
interface RunState {
  phase: Phase;
  amount?: bigint;
  userOpHash?: `0x${string}`;
  outcome?: RunOutcome;
  error?: string;
}

function errorMessage(data: {error?: string; message?: string; retryAfter?: number}): string {
  if (data.error === "rate_limited") return `Slow down${data.retryAfter ? ` — try again in ${data.retryAfter}s` : ""}.`;
  if (data.error === "sponsor_deposit_empty") return "The paymaster deposit is empty — top it up to keep running gasless.";
  if (data.error === "not_configured") return "Live run isn’t configured on this server.";
  return data.message ?? "Submission failed.";
}

function RunResult({run}: {run: RunState}) {
  if (run.phase === "running" || run.phase === "polling") {
    return (
      <Row className="bg-bone">
        <Chip tone="outline">
          <Dot width={9} height={9} className="animate-pulse text-periwinkle" />
          {run.phase === "running" ? "sponsoring…" : "waiting for inclusion…"}
        </Chip>
        <div className="text-body-sm text-fog tabular-nums">{run.amount ? formatMusd(run.amount) : "—"} mUSD</div>
      </Row>
    );
  }
  if (run.phase === "error") {
    return (
      <PanelNote tone="error">
        {run.error}
        {run.userOpHash ? (
          <span className="mt-1 block text-caption">userOp {truncateHash(run.userOpHash)} — check history if it landed.</span>
        ) : null}
      </PanelNote>
    );
  }
  if (run.phase === "resolved") {
    const o = run.outcome;
    return (
      <Row>
        {o ? <StateBadge kind={o.kind} /> : <Chip tone="mint">included</Chip>}
        <div className="min-w-0 flex-1 text-body-sm">
          <span className="text-aubergine tabular-nums">{run.amount ? formatMusd(run.amount) : "—"} mUSD</span>{" "}
          <span className="text-fog">
            {o?.kind === "blocked" ? `held · ${o.reason ?? "policy"}` : o?.kind === "approved" ? "approved · vendor paid" : "landed"}
          </span>
        </div>
        {o?.txHash ? <TxChip href={explorerTx(o.txHash)} label={truncateHash(o.txHash)} /> : null}
      </Row>
    );
  }
  return null;
}

export function RunAgentPanel({refetch, className = ""}: {refetch: () => void; className?: string}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [run, setRun] = useState<RunState>({phase: "idle"});

  useEffect(() => {
    fetch("/api/sponsor")
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, []);

  const busy = run.phase === "running" || run.phase === "polling";

  const doRun = async (amount: bigint) => {
    setRun({phase: "running", amount});
    try {
      const active = getActiveContracts();
      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          amountBaseUnits: amount.toString(),
          agent: active.agent,
          vault: active.vault,
          paymaster: active.paymaster,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRun({phase: "error", amount, error: errorMessage(data)});
        return;
      }
      const userOpHash = data.userOpHash as `0x${string}`;
      setRun({phase: "polling", amount, userOpHash});
      const receipt = await pollUserOpReceipt(userOpHash);
      if (!receipt) {
        setRun({phase: "error", amount, userOpHash, error: "Timed out waiting for inclusion."});
        return;
      }
      // NEVER optimistic — outcome comes from the actual event, not the requested amount
      const outcome = resolveOutcome(receipt);
      setRun({phase: "resolved", amount, userOpHash, outcome: outcome ?? undefined});
      refetch();
    } catch (e) {
      setRun({phase: "error", amount, error: (e as Error)?.message ?? "Network error"});
    }
  };

  if (configured === false) {
    return (
      <Panel title="Run the agent" subtitle="live gasless spend" className={className}>
        <PanelNote>The live run isn&rsquo;t configured on this server — the read-only dashboard above is fully live.</PanelNote>
      </Panel>
    );
  }

  return (
    <Panel title="Run the agent" subtitle="live gasless spend — the fence decides" className={className}>
      <p className="text-body-sm text-fog">
        Submit a real sponsored UserOp. The agent holds nothing; the paymaster pays and the vault decides. The
        outcome is whatever the fence returns — not scripted.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="sm" onClick={() => doRun(4_000_000n)} disabled={busy || configured === null}>
          Spend 4 mUSD
        </Button>
        <Button variant="secondary" size="sm" onClick={() => doRun(6_000_000n)} disabled={busy || configured === null}>
          Spend 6 mUSD
        </Button>
      </div>
      {run.phase !== "idle" ? <RunResult run={run} /> : null}
    </Panel>
  );
}
