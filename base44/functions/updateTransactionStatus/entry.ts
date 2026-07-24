import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS, DEMO, MUSD_DECIMALS} from "../../shared/constants.ts";
import {formatAmount} from "../../shared/chain.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {transaction_id, status, tx_hash, block_number, block_reason} = await req.json();

    if (!transaction_id || !status) {
      return Response.json({ok: false, error: "transaction_id and status are required"}, {status: 400});
    }

    const validStatuses = ["APPROVED", "EXECUTED", "BLOCKED", "FAILED"];
    if (!validStatuses.includes(status)) {
      return Response.json({ok: false, error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`}, {status: 400});
    }

    const existing = await base44.asServiceRole.entities.Transaction.get(transaction_id);
    if (!existing) {
      return Response.json({ok: false, error: "Transaction not found"}, {status: 404});
    }

    const updateData: Record<string, unknown> = {status};
    if (tx_hash) updateData.tx_hash = tx_hash;
    if (block_number) updateData.block_number = block_number;
    if (block_reason) updateData.block_reason = block_reason;

    await base44.asServiceRole.entities.Transaction.update(transaction_id, updateData);

    const vaultId = existing.vault_id;
    const actionMap: Record<string, string> = {
      APPROVED: "PAYMENT_APPROVED",
      EXECUTED: "PAYMENT_EXECUTED",
      BLOCKED: "PAYMENT_BLOCKED",
      FAILED: "PAYMENT_FAILED",
    };

    await base44.asServiceRole.entities.AuditLog.create({
      vault_id: vaultId,
      action: actionMap[status] as "PAYMENT_APPROVED" | "PAYMENT_EXECUTED" | "PAYMENT_BLOCKED" | "PAYMENT_FAILED",
      actor: existing.agent_address,
      actor_type: "agent",
      metadata: {
        recipient: existing.recipient,
        amount: existing.amount_display || formatAmount(BigInt(existing.amount), MUSD_DECIMALS),
        token_symbol: existing.token_symbol || "mUSD",
        transaction_id,
        ...(block_reason ? {reason: block_reason} : {}),
      },
      tx_hash: tx_hash || existing.tx_hash,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ok: true, transaction_id, new_status: status});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
