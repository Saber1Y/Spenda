import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const approvals = await base44.asServiceRole.entities.ApprovalRequest.filter({vault_id, status: "pending"}, "-created_at", 100);
    return Response.json({ok: true, data: approvals});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ok: false, error: message}, {status: 500});
  }
});
