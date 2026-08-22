"use client";

import {useState} from "react";
import {useAccount, useSignTypedData} from "wagmi";
import {getActiveContracts} from "@/lib/contracts";
import {useActiveVaultEntity, useApprovalEntities, useReceiptEntities, useVaultEntities} from "@/lib/base44-hooks";
import {getBase44Client} from "@/lib/base44";
import {formatMusd, truncateAddress} from "@/lib/format";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";
import {executeIntent} from "@/lib/intent-execution";

export default function ApprovalsPage() {
  const active = getActiveContracts();
  const vault = useActiveVaultEntity();
  const {data: approvals, loading, refetch} = useApprovalEntities(vault?.id);
  const {data: vaults} = useVaultEntities();
  const {address} = useAccount();
  const {signTypedDataAsync} = useSignTypedData();
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (approval: Record<string, any>, decision: "approved" | "rejected") => {
    setBusy(approval.id);
    try {
      const client = getBase44Client();
      const intentRes = await client.functions.invoke("queryEntities", {entity: "SpendIntent", filter: {id: approval.intent_id}, limit: 1});
      const intent = (intentRes?.data ?? intentRes)?.data?.[0];
      if (!intent) throw new Error("Intent context not found");
      let signature = "";
      if (decision === "approved") {
        if (!address) throw new Error("Connect the vault owner wallet first");
        signature = await signTypedDataAsync({
          domain: {name: "Spenda Approval", version: "1", chainId: 677, verifyingContract: active.vault},
          types: {SpendApproval: [
            {name: "approvalId", type: "bytes32"}, {name: "intentId", type: "string"}, {name: "agentId", type: "string"},
            {name: "token", type: "address"}, {name: "amount", type: "uint256"}, {name: "recipient", type: "address"}, {name: "expiresAt", type: "uint256"},
          ]},
          primaryType: "SpendApproval",
          message: {approvalId: approval.approval_nonce, intentId: approval.intent_id, agentId: approval.agent_id, token: intent.token, amount: BigInt(intent.amount), recipient: intent.recipient, expiresAt: BigInt(Math.floor(Date.parse(approval.expires_at) / 1000))},
        });
      }
      const result = await client.functions.invoke("decideApproval", {approval_id: approval.id, decision, signer: address ?? "", signature, reason: decision === "approved" ? "Approved by vault owner" : "Rejected by vault owner"});
      const response = result?.data ?? result;
      if (!response?.ok) throw new Error(response?.error ?? "Approval update failed");
      if (decision === "approved") await executeIntent(approval.intent_id);
      refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return <div className="max-w-[900px] px-8 py-8">
    <div className="flex items-start justify-between"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Pending approvals</h1><p className="mt-1 text-[15px] text-fog">Approve one exact intent through your connected wallet.</p></div><Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>Refresh</Button></div>
    <div className="mt-8 flex flex-col gap-4">
      {approvals?.length ? approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} onDecide={decide} busy={busy === approval.id} />) : <Panel title="No approvals" subtitle="clear" ><p className="text-body-sm text-fog">Risky requests will appear here with their exact scope and expiry.</p></Panel>}
    </div>
  </div>;
}

function ApprovalCard({approval, onDecide, busy}: {approval: Record<string, any>; onDecide: (approval: Record<string, any>, decision: "approved" | "rejected") => void; busy: boolean}) {
  return <Panel title={`Approval ${String(approval.id).slice(0, 12)}`} subtitle={`expires ${new Date(approval.expires_at).toLocaleString()}`}>
    <div className="flex flex-wrap items-center gap-3"><Chip tone="blush">Human review</Chip><span className="text-body-sm text-fog">Agent {truncateAddress(approval.agent_id)}</span></div>
    <div className="mt-4 flex gap-3"><Button variant="primary" size="sm" onClick={() => onDecide(approval, "approved")} disabled={busy}>Approve with wallet</Button><Button variant="secondary" size="sm" onClick={() => onDecide(approval, "rejected")} disabled={busy}>Reject</Button></div>
  </Panel>;
}
