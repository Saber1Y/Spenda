import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id, action, actor, actor_type, metadata, tx_hash} = await req.json();

    if (!vault_id || !action) {
      return Response.json({ok: false, error: "vault_id and action are required"}, {status: 400});
    }

    await base44.asServiceRole.entities.AuditLog.create({
      vault_id,
      action,
      actor: actor || "system",
      actor_type: actor_type || "system",
      metadata: metadata ?? {},
      tx_hash: tx_hash || "",
      timestamp: new Date().toISOString(),
    });

    return Response.json({ok: true});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
