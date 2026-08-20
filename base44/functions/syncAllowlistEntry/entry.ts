import {createClientFromRequest} from "npm:@base44/sdk";

const RPC_URL = "https://rpc.bohr.life";
let rpcId = 0;
const SELECTORS = {target: "0xed8f4e2d", token: "0xe02f7f62"};

function isAddress(value: unknown): value is string { return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value); }
function word(value: string): string { return value.slice(2).padStart(64, "0"); }
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
    const {agent_id, kind, address, label, category} = await req.json();
    if (!agent_id || !["target", "token"].includes(kind) || !isAddress(address)) return Response.json({ok: false, error: "agent_id, kind, and valid address are required"}, {status: 400});
    const agents = await base44.asServiceRole.entities.Agent.filter({id: agent_id});
    if (agents.length === 0) return Response.json({ok: false, error: "agent_not_found"}, {status: 404});
    const agent = agents[0];
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: agent.vault_id});
    const identifiers = [user.id, user.email].filter(Boolean).map(String);
    if (vaults.length === 0 || !identifiers.some((id) => [vaults[0].user_id, vaults[0].created_by].filter(Boolean).map(String).includes(id))) return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    const result = await ethCall(vaults[0].contract_address, `${SELECTORS[kind as "target" | "token"]}${word(agent.address)}${word(address)}`);
    const allowed = BigInt(result) !== 0n;
    const normalized = address.toLowerCase();
    const existing = await base44.asServiceRole.entities.AllowlistEntry.filter({vault_id: agent.vault_id, agent_address: agent.address, kind, address: normalized});
    const data = {vault_id: agent.vault_id, agent_id, agent_address: agent.address, policy_id: "", address: normalized, kind, label: label || normalized, category: category || "", status: allowed ? "active" : "removed"};
    const saved = existing.length > 0 ? await base44.asServiceRole.entities.AllowlistEntry.update(existing[0].id, data) : await base44.asServiceRole.entities.AllowlistEntry.create(data);
    return Response.json({ok: true, entry: saved, allowed});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
