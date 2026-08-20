import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const agents = await base44.asServiceRole.entities.Agent.filter({vault_id}, "-created_at", 100);
    return Response.json({ok: true, data: agents});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
