import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS, DEMO, MUSD_DECIMALS} from "../../shared/constants.ts";
import {formatAmount} from "../../shared/chain.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {recipient, amount, action_id, user_op_hash} = await req.json();

    if (!recipient || !amount) {
      return Response.json({ok: false, error: "recipient and amount are required"}, {status: 400});
    }

    const agent = DEMO.agent;
    const vaultAddr = CONTRACTS.vault;

    const existingVaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddr});
    if (existingVaults.length === 0) {
      return Response.json({ok: false, error: "No vault entity found"}, {status: 400});
    }
    const vaultId = existingVaults[0].id;

    const tx = await base44.asServiceRole.entities.Transaction.create({
      vault_id: vaultId,
      agent_address: agent,
      recipient: recipient,
      recipient_label: recipient.toLowerCase() === DEMO.vendor.toLowerCase() ? "AWS" : undefined,
      token: CONTRACTS.mockUSD,
      token_symbol: "mUSD",
      amount: amount.toString(),
      amount_display: formatAmount(BigInt(amount), MUSD_DECIMALS),
      status: "REQUESTED",
      action_id: action_id || undefined,
      user_op_hash: user_op_hash || undefined,
    });

    await base44.asServiceRole.entities.AuditLog.create({
      vault_id: vaultId,
      action: "PAYMENT_REQUESTED",
      actor: agent,
      actor_type: "agent",
      metadata: {
        recipient,
        amount: formatAmount(BigInt(amount), MUSD_DECIMALS),
        token_symbol: "mUSD",
        transaction_id: tx.id,
      },
      timestamp: new Date().toISOString(),
    });

    return Response.json({ok: true, transaction_id: tx.id});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
