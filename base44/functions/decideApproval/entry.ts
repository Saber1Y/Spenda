import {createClientFromRequest} from "npm:@base44/sdk";
import {recoverTypedDataAddress} from "npm:viem";

const TERMINAL = ["approved", "rejected", "expired", "consumed"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {approval_id, decision, signer, signature, reason} = await req.json();
    if (!approval_id || !["approved", "rejected"].includes(decision)) {
      return Response.json({ok: false, error: "approval_id and an approved/rejected decision are required"}, {status: 400});
    }

    const approvals = await base44.asServiceRole.entities.ApprovalRequest.filter({id: approval_id});
    if (approvals.length === 0) return Response.json({ok: false, error: "approval_not_found"}, {status: 404});
    const approval = approvals[0];
    if (TERMINAL.includes(approval.status)) return Response.json({ok: false, error: "approval_not_pending"}, {status: 409});
    if (Date.parse(approval.expires_at) <= Date.now()) {
      await base44.asServiceRole.entities.ApprovalRequest.update(approval_id, {status: "expired"});
      return Response.json({ok: false, error: "approval_expired"}, {status: 409});
    }
    if (decision === "approved" && (!signer || !signature)) {
      return Response.json({ok: false, error: "wallet signer and scoped signature are required"}, {status: 400});
    }

    if (decision === "approved") {
      const intents = await base44.asServiceRole.entities.SpendIntent.filter({id: approval.intent_id});
      const vaults = await base44.asServiceRole.entities.Vault.filter({id: approval.vault_id});
      if (intents.length === 0 || vaults.length === 0) return Response.json({ok: false, error: "approval_context_missing"}, {status: 409});
      const intent = intents[0];
      const vault = vaults[0];
      const domain = {
        name: "Spenda Approval",
        version: "1",
        chainId: Number(vault.chain_id),
        verifyingContract: vault.contract_address as `0x${string}`,
      } as const;
      const types = {
        SpendApproval: [
          {name: "approvalId", type: "bytes32"},
          {name: "intentId", type: "string"},
          {name: "agentId", type: "string"},
          {name: "token", type: "address"},
          {name: "amount", type: "uint256"},
          {name: "recipient", type: "address"},
          {name: "expiresAt", type: "uint256"},
        ],
      } as const;
      const recovered = await recoverTypedDataAddress({
        domain,
        types,
        primaryType: "SpendApproval",
        message: {
          approvalId: approval.approval_nonce as `0x${string}`,
          intentId: approval.intent_id,
          agentId: approval.agent_id,
          token: intent.token as `0x${string}`,
          amount: BigInt(intent.amount),
          recipient: intent.recipient as `0x${string}`,
          expiresAt: BigInt(Math.floor(Date.parse(approval.expires_at) / 1000)),
        },
        signature: signature as `0x${string}`,
      });
      const owner = String(vault.owner_address ?? "").toLowerCase();
      if (recovered.toLowerCase() !== String(signer).toLowerCase() || recovered.toLowerCase() !== owner) {
        return Response.json({ok: false, error: "approval_signature_invalid"}, {status: 403});
      }
    }

    const nextStatus = decision === "approved" ? "approved" : "rejected";
    await base44.asServiceRole.entities.ApprovalRequest.update(approval_id, {
      status: nextStatus,
      signer: signer || "",
      signature: signature || "",
      decision_reason: reason || (decision === "approved" ? "Approved by vault owner" : "Rejected by vault owner"),
    });
    await base44.asServiceRole.entities.SpendIntent.update(approval.intent_id, {status: nextStatus});
    return Response.json({ok: true, approval_id, status: nextStatus});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ok: false, error: message}, {status: 500});
  }
});
