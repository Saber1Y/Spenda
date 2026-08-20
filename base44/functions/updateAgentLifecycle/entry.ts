import {createClientFromRequest} from "npm:@base44/sdk";

const RPC_URL = "https://rpc.bohr.life";
let rpcId = 0;

function word(value: string): string { return value.slice(2).padStart(64, "0"); }
function decode(result: string, index: number): bigint { return BigInt(`0x${result.slice(2 + index * 64, 2 + (index + 1) * 64)}`); }
async function ethCall(to: string, data: string): Promise<string> {
  const response = await fetch(RPC_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{to, data}, "latest"]})});
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const {agent_id, status} = await req.json();
    if (!agent_id || !["active", "paused", "revoked"].includes(status)) return Response.json({ok: false, error: "agent_id and valid status are required"}, {status: 400});
    const agents = await base44.asServiceRole.entities.Agent.filter({id: agent_id});
    if (agents.length === 0) return Response.json({ok: false, error: "agent_not_found"}, {status: 404});
    const agent = agents[0];
    if (agent.status === "revoked" && status !== "revoked") return Response.json({ok: false, error: "revoked_agent_cannot_be_reactivated"}, {status: 409});
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: agent.vault_id});
    const identifiers = [user.id, user.email].filter(Boolean).map(String);
    if (vaults.length === 0 || !identifiers.some((id) => [vaults[0].user_id, vaults[0].created_by].filter(Boolean).map(String).includes(id))) return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    const policy = await ethCall(vaults[0].contract_address, `0x3791dc6a${word(agent.address)}`);
    const active = decode(policy, 5) !== 0n;
    if ((status === "active") !== active) return Response.json({ok: false, error: "onchain_policy_state_mismatch"}, {status: 409});
    const saved = await base44.asServiceRole.entities.Agent.update(agent_id, {status});
    const budgets = await base44.asServiceRole.entities.AgentBudget.filter({vault_id: agent.vault_id, agent_address: agent.address});
    const budgetData = {daily_cap: decode(policy, 1).toString(), max_per_transaction: decode(policy, 0).toString(), spent_today: decode(policy, 2).toString(), remaining_daily: (decode(policy, 1) > decode(policy, 2) ? decode(policy, 1) - decode(policy, 2) : 0n).toString(), active, last_synced_at: new Date().toISOString()};
    if (budgets.length > 0) await base44.asServiceRole.entities.AgentBudget.update(budgets[0].id, budgetData);
    return Response.json({ok: true, agent: saved, budget: budgetData});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
