"use client";

import {useEffect, useState} from "react";
import {useAccount, useSignTypedData, useWalletClient} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {runUserSpend, describeSpendError, type UserSpendOutcome} from "@/lib/userSpend";
import {friendlyErrorFrom} from "@/lib/errorMessages";
import {loadPendingApprovals, removePendingApproval, rememberIntentMeta} from "@/lib/intentStore";
import type {Intent} from "@/lib/intentTypes";
import {truncateAddress} from "@/lib/format";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";

const loadPending = (): Intent[] => loadPendingApprovals();

export default function ApprovalsPage() {
  const active = getActiveContracts();
  const {address} = useAccount();
  const {data: wallet} = useWalletClient();
  const {signTypedDataAsync} = useSignTypedData();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<Intent[]>([]);
  useEffect(() => setPending(loadPendingApprovals()), []);

  const decide = async (intent: Intent, decision: "approved" | "rejected") => {
    setBusy(intent.intentId);
    setStatus("");
    try {
      if (!wallet || !address) throw new Error("Connect your wallet first");
      let outcome: UserSpendOutcome | null = null;
      if (decision === "approved") {
        // Explicit human consent, bound to the exact intent parameters.
        await signTypedDataAsync({
          domain: {name: "Spenda Approval", version: "1", chainId: 677, verifyingContract: active.vault},
          types: {SpendApproval: [
            {name: "actionId", type: "bytes32"}, {name: "agent", type: "address"}, {name: "token", type: "address"},
            {name: "amount", type: "uint256"}, {name: "recipient", type: "address"}, {name: "expiresAt", type: "uint256"},
          ]},
          primaryType: "SpendApproval",
          message: {actionId: intent.actionId as `0x${string}`, agent: intent.agent as `0x${string}`, token: intent.token as `0x${string}`, amount: BigInt(intent.amount), recipient: intent.recipient as `0x${string}`, expiresAt: BigInt(intent.expiresAt)},
        });
        setStatus("Consent signed - submitting the sponsored payment...");
        outcome = await runUserSpend(wallet.signMessage.bind(wallet), intent.agent, intent.amount, intent.recipient, intent.actionId);
        rememberIntentMeta(intent);
        setStatus(
          outcome.status === "included" && outcome.success
            ? "Payment executed."
            : outcome.status === "included"
              ? `Blocked by the fence: ${outcome.reason ?? "policy"}`
              : describeSpendError(outcome),
        );
      } else {
        setStatus(`Rejected "${intent.label}". Nothing was executed.`);
      }
      setPending(removePendingApproval(intent.intentId));
    } catch (error) {
      setStatus(friendlyErrorFrom(error));
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => setPending(loadPendingApprovals());

  return <div className="max-w-[900px] px-8 py-8">
    <div className="flex items-start justify-between">
      <div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Pending approvals</h1>
        <p className="mt-1 text-[15px] text-fog">High-risk intents wait here for an exact, wallet-signed consent.</p></div>
      <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
    </div>
    {status && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">{status}</p>}
    <div className="mt-8 flex flex-col gap-4">
      {pending.length ? pending.map((intent) => (
        <ApprovalCard key={intent.intentId} intent={intent} busy={busy === intent.intentId}
          onDecide={(decision) => decide(intent, decision)} />
      )) : <Panel title="No approvals" subtitle="clear"><p className="text-body-sm text-fog">Risky requests will appear here with their exact scope and expiry.</p></Panel>}
    </div>
  </div>;
}

function ApprovalCard({intent, onDecide, busy}: {intent: Intent; onDecide: (decision: "approved" | "rejected") => void; busy: boolean}) {
  const expired = Date.now() / 1000 > intent.expiresAt;
  return <Panel title={intent.label} subtitle={`expires ${new Date(intent.expiresAt * 1000).toLocaleString()}`}>
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone={expired ? "blush" : "lavender"}>{expired ? "expired" : "human review"}</Chip>
      {intent.riskScore !== null && <Chip tone={intent.riskLevel === "LOW" ? "mint" : intent.riskLevel === "HIGH" ? "blush" : "lavender"}>risk {intent.riskScore}/100</Chip>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div><span className="text-caption text-fog">Amount</span><p className="text-body-sm tabular-nums text-obsidian">{(Number(intent.amount) / 1e6).toFixed(2)} USDT</p></div>
      <div><span className="text-caption text-fog">Paying agent</span><p className="text-body-sm text-obsidian">{truncateAddress(intent.agent)}</p></div>
      <div><span className="text-caption text-fog">Recipient</span><p className="text-body-sm text-obsidian">{truncateAddress(intent.recipient)}</p></div>
    </div>
    <div className="mt-5 flex gap-3">
      <Button variant="primary" size="sm" onClick={() => onDecide("approved")} disabled={busy || expired}>{busy ? "Working..." : "Approve with wallet"}</Button>
      <Button variant="secondary" size="sm" onClick={() => onDecide("rejected")} disabled={busy}>Reject</Button>
    </div>
  </Panel>;
}
