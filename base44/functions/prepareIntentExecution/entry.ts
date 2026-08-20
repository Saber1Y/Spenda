import {createClientFromRequest} from "npm:@base44/sdk";

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const {intent_id} = await req.json();
    if (!intent_id) return Response.json({ok: false, error: "intent_id is required"}, {status: 400});

    const intents = await base44.asServiceRole.entities.SpendIntent.filter({id: intent_id});
    if (intents.length === 0) return Response.json({ok: false, error: "intent_not_found"}, {status: 404});
    const intent = intents[0];
    if (!["approved"].includes(intent.status)) return Response.json({ok: false, error: "intent_not_approved"}, {status: 409});
    if (Date.parse(intent.expires_at) <= Date.now()) {
      await base44.asServiceRole.entities.SpendIntent.update(intent.id, {status: "expired"});
      return Response.json({ok: false, error: "intent_expired"}, {status: 409});
    }
    if (!HEX32.test(intent.action_id)) return Response.json({ok: false, error: "intent_action_id_invalid"}, {status: 409});

    const vaults = await base44.asServiceRole.entities.Vault.filter({id: intent.vault_id});
    const agents = await base44.asServiceRole.entities.Agent.filter({id: intent.agent_id, vault_id: intent.vault_id});
    if (vaults.length === 0 || agents.length === 0 || agents[0].status !== "active") {
      return Response.json({ok: false, error: "intent_context_invalid"}, {status: 409});
    }
    const vault = vaults[0];
    const userIdentifiers = [user.id, user.email].filter(Boolean).map(String);
    const ownsVault = userIdentifiers.some((identifier) =>
      [vault.user_id, vault.created_by].filter(Boolean).map(String).includes(identifier),
    );
    if (!ownsVault) return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    const risks = await base44.asServiceRole.entities.RiskAssessment.filter({intent_id: intent.id, vault_id: intent.vault_id});
    if (risks.length === 0 || risks[0].recommendation === "block") return Response.json({ok: false, error: "risk_does_not_permit_execution"}, {status: 409});
    if (["human_approval", "policy_dependent"].includes(risks[0].recommendation)) {
      const approvals = await base44.asServiceRole.entities.ApprovalRequest.filter({intent_id: intent.id, vault_id: intent.vault_id});
      if (approvals.length === 0 || approvals[0].status !== "approved") return Response.json({ok: false, error: "human_approval_required"}, {status: 409});
    }

    await base44.asServiceRole.entities.SpendIntent.update(intent.id, {
      status: "executing",
      execution_started_at: new Date().toISOString(),
      execution_started_by: user.id ?? user.email ?? "user",
    });
    return Response.json({
      ok: true,
      intent_id: intent.id,
      vault: vault.contract_address,
      agent: agents[0].address,
      token: intent.token,
      recipient: intent.recipient,
      amount: intent.amount,
      action_id: intent.action_id,
      expires_at: intent.expires_at,
    });
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
