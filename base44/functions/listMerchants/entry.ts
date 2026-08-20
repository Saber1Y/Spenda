import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const merchants = await base44.asServiceRole.entities.Merchant.filter({vault_id, status: "active"}, "display_name", 100);
    return Response.json({ok: true, data: merchants});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
