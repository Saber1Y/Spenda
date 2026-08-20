import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id, decision, intent_type, category} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const filter: Record<string, string> = {vault_id};
    if (decision) filter.decision = decision;
    if (intent_type) filter.intent_type = intent_type;
    if (category) filter.category = category;
    const receipts = await base44.asServiceRole.entities.SpendingReceipt.filter(filter, "-created_at", 100);
    return Response.json({ok: true, data: receipts});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ok: false, error: message}, {status: 500});
  }
});
