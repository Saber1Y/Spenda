import {createClientFromRequest} from "npm:@base44/sdk";

const RPC_URL = "https://rpc.bohr.life";
let rpcId = 0;
const selectors = {
  accountVault: "0xfbfa77cf",
  accountPaymaster: "0x16e4cbf9",
  accountOwner: "0x8da5cb5b",
  accountCode: "eth_getCode",
  vaultOwner: "0x8da5cb5b",
  policy: "0x3791dc6a",
};

function address(value: unknown): value is string { return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value); }
function word(value: string): string { return value.slice(2).padStart(64, "0"); }
function call(selector: string, ...args: string[]): string { return selector + args.map(word).join(""); }
function decodeAddress(result: string): string { return `0x${result.slice(-40)}`.toLowerCase(); }
function decodeWord(result: string, index = 0): bigint { return BigInt(`0x${result.slice(2 + index * 64, 2 + (index + 1) * 64)}`); }

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method, params})});
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ok: false, error: "authentication_required"}, {status: 401});
    const body = await req.json();
    const {vault_id, agent_address, owner_eoa, factory_address, vault_address, paymaster_address, salt = "0", display_name, description, capabilities = []} = body;
    if (![agent_address, owner_eoa, factory_address, vault_address, paymaster_address].every(address)) return Response.json({ok: false, error: "invalid_address"}, {status: 400});
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: vault_id});
    if (vaults.length === 0) return Response.json({ok: false, error: "vault_not_found"}, {status: 404});
    const vault = vaults[0];
    const ids = [user.id, user.email].filter(Boolean).map(String);
    if (!ids.some((id) => [vault.user_id, vault.created_by].filter(Boolean).map(String).includes(id))) return Response.json({ok: false, error: "vault_access_denied"}, {status: 403});
    const configuredOwner = decodeAddress(await rpc("eth_call", [{to: vault_address, data: selectors.vaultOwner}, "latest"]));
    if (configuredOwner !== String(vault.owner_address ?? "").toLowerCase()) return Response.json({ok: false, error: "vault_owner_mismatch"}, {status: 409});
    const code = await rpc("eth_getCode", [agent_address, "latest"]);
    if (!code || code === "0x") return Response.json({ok: false, error: "agent_not_deployed"}, {status: 409});
    const [accountVault, accountPaymaster, accountOwner, policy] = await Promise.all([
      rpc("eth_call", [{to: agent_address, data: selectors.accountVault}, "latest"]),
      rpc("eth_call", [{to: agent_address, data: selectors.accountPaymaster}, "latest"]),
      rpc("eth_call", [{to: agent_address, data: selectors.accountOwner}, "latest"]),
      rpc("eth_call", [{to: vault_address, data: call(selectors.policy, agent_address)}, "latest"]),
    ]);
    if (decodeAddress(accountVault) !== vault_address.toLowerCase() || decodeAddress(accountPaymaster) !== paymaster_address.toLowerCase() || decodeAddress(accountOwner) !== owner_eoa.toLowerCase()) return Response.json({ok: false, error: "agent_binding_mismatch"}, {status: 409});
    if (decodeWord(policy, 5) === 0n) return Response.json({ok: false, error: "agent_policy_inactive"}, {status: 409});
    const existing = await base44.asServiceRole.entities.Agent.filter({vault_id, address: agent_address});
    const data = {vault_id, address: agent_address, owner_eoa, display_name: display_name || "Agent", description: description || "Autonomous spending agent", status: "active", is_deployed: true, factory_address, vault_address, paymaster_address, salt: String(salt), capabilities, payment_address: agent_address};
    const saved = existing.length > 0 ? await base44.asServiceRole.entities.Agent.update(existing[0].id, data) : await base44.asServiceRole.entities.Agent.create(data);
    const budgetData = {vault_id, agent_id: saved.id, agent_address, daily_cap: decodeWord(policy, 1).toString(), max_per_transaction: decodeWord(policy, 0).toString(), spent_today: decodeWord(policy, 2).toString(), remaining_daily: (decodeWord(policy, 1) - decodeWord(policy, 2)).toString(), active: true, last_synced_at: new Date().toISOString()};
    const budgets = await base44.asServiceRole.entities.AgentBudget.filter({vault_id, agent_address});
    if (budgets.length > 0) await base44.asServiceRole.entities.AgentBudget.update(budgets[0].id, budgetData);
    else await base44.asServiceRole.entities.AgentBudget.create(budgetData);
    return Response.json({ok: true, agent: saved, policy: {max_per_transaction: decodeWord(policy, 0).toString(), daily_cap: decodeWord(policy, 1).toString(), spent_today: decodeWord(policy, 2).toString(), active: true}});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
