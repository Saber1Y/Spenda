import {createClientFromRequest} from "npm:@base44/sdk";

const LEASE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const {intent_id, outcome, failure} = await req.json();
    if (!intent_id || !["submitted", "failed", "unknown"].includes(outcome)) {
      return Response.json({ok: false, error: "intent_id and valid outcome are required"}, {status: 400});
    }
    const intents = await base44.asServiceRole.entities.SpendIntent.filter({id: intent_id});
    if (intents.length === 0) return Response.json({ok: false, error: "intent_not_found"}, {status: 404});
    const intent = intents[0];
    if (intent.status !== "executing") return Response.json({ok: false, error: "intent_not_executing"}, {status: 409});
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: intent.vault_id});
    const identifiers = [user.id, user.email].filter(Boolean).map(String);
    if (vaults.length === 0 || !identifiers.some((identifier) => [vaults[0].user_id, vaults[0].created_by].filter(Boolean).map(String).includes(identifier))) {
      return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    }
    const leaseExpires = Date.parse(intent.execution_lease_expires_at ?? "");
    if (outcome === "unknown" && Number.isFinite(leaseExpires) && leaseExpires > Date.now()) {
      return Response.json({ok: false, error: "execution_lease_active"}, {status: 409});
    }
    const nextStatus = outcome === "submitted" ? "executing" : outcome === "failed" ? "failed" : "executing";
    await base44.asServiceRole.entities.SpendIntent.update(intent_id, {
      status: nextStatus,
      execution_failure: failure ?? "",
      execution_lease_expires_at: outcome === "unknown" ? new Date(Date.now() + LEASE_MS).toISOString() : intent.execution_lease_expires_at,
    });
    return Response.json({ok: true, intent_id, status: nextStatus});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
