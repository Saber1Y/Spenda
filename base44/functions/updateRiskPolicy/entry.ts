import {createClientFromRequest} from "npm:@base44/sdk";
import {recoverMessageAddress} from "npm:viem";

function integer(value: unknown, min: number, max: number): value is number { return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const body = await req.json();
    const {vault_id, signer, signature, auto_approval_limit, human_approval_limit, medium_threshold, high_threshold, critical_threshold, rwa_multiplier_bps, velocity_window_seconds} = body;
    if (!vault_id || !/^[1-9][0-9]*$/.test(String(auto_approval_limit)) || !/^[1-9][0-9]*$/.test(String(human_approval_limit)) || !integer(medium_threshold, 0, 100) || !integer(high_threshold, 0, 100) || !integer(critical_threshold, 0, 100) || !integer(rwa_multiplier_bps, 10000, 50000) || !integer(velocity_window_seconds, 60, 604800)) return Response.json({ok: false, error: "invalid_risk_policy"}, {status: 400});
    if (!(medium_threshold < high_threshold && high_threshold < critical_threshold)) return Response.json({ok: false, error: "risk_thresholds_must_increase"}, {status: 400});
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: vault_id});
    const identifiers = [user.id, user.email].filter(Boolean).map(String);
    if (vaults.length === 0 || !identifiers.some((id) => [vaults[0].user_id, vaults[0].created_by].filter(Boolean).map(String).includes(id))) return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    if (!/^0x[0-9a-fA-F]{40}$/.test(signer ?? "") || !/^0x[0-9a-fA-F]+$/.test(signature ?? "")) return Response.json({ok: false, error: "owner_signature_required"}, {status: 400});
    const message = JSON.stringify({vault_id, auto_approval_limit: String(auto_approval_limit), human_approval_limit: String(human_approval_limit), medium_threshold, high_threshold, critical_threshold, rwa_multiplier_bps, velocity_window_seconds});
    const recovered = await recoverMessageAddress({message, signature});
    if (recovered.toLowerCase() !== String(vaults[0].owner_address ?? "").toLowerCase() || recovered.toLowerCase() !== signer.toLowerCase()) return Response.json({ok: false, error: "owner_signature_invalid"}, {status: 403});
    const existing = await base44.asServiceRole.entities.RiskPolicy.filter({vault_id, active: true});
    if (existing.length > 0) await base44.asServiceRole.entities.RiskPolicy.update(existing[0].id, {active: false});
    const version = `v${Date.now()}`;
    const policy = await base44.asServiceRole.entities.RiskPolicy.create({vault_id, version, auto_approval_limit: String(auto_approval_limit), human_approval_limit: String(human_approval_limit), medium_threshold, high_threshold, critical_threshold, rwa_multiplier_bps, velocity_window_seconds, active: true, updated_by: user.id ?? user.email ?? "user", updated_at: new Date().toISOString()});
    return Response.json({ok: true, policy});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
