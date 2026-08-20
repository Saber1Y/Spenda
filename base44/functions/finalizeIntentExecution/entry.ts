import {createClientFromRequest} from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const {intent_id, user_op_hash} = await req.json();
    if (!intent_id || !user_op_hash) return Response.json({ok: false, error: "intent_id and user_op_hash are required"}, {status: 400});
    const intents = await base44.asServiceRole.entities.SpendIntent.filter({id: intent_id});
    if (intents.length === 0) return Response.json({ok: false, error: "intent_not_found"}, {status: 404});
    if (intents[0].status !== "executing") return Response.json({ok: false, error: "intent_not_executing"}, {status: 409});
    await base44.asServiceRole.entities.SpendIntent.update(intent_id, {status: "executing", user_op_hash});
    return Response.json({ok: true, intent_id, user_op_hash});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
