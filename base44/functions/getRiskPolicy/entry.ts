import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const policies = await base44.asServiceRole.entities.RiskPolicy.filter({vault_id, active: true}, "-created_at", 1);
    return Response.json({ok: true, policy: policies[0] ?? null});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
