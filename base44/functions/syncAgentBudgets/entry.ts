import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS} from "../../shared/constants.ts";

const RPC_URL = "https://rpc.bohr.life";
let rpcId = 0;

async function ethCall(to: string, data: string): Promise<string> {
  const response = await fetch(RPC_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{to, data}, "latest"]})});
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const selector = (signature: string) => `0x${signature}`;
const word = (address: string) => address.slice(2).padStart(64, "0");
const call = (sig: string, address: string) => selector(sig) + word(address);
const decode = (data: string, index: number) => BigInt(`0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id, vault_address, token_decimals = 6} = await req.json();
    if (!vault_id || !vault_address) return Response.json({ok: false, error: "vault_id and vault_address are required"}, {status: 400});
    const agents = await base44.asServiceRole.entities.Agent.filter({vault_id}, "-created_at", 100);
    const results = [];
    for (const agent of agents) {
      const [policy, remaining] = await Promise.all([
        ethCall(vault_address, call("3791dc6a", agent.address)),
        ethCall(vault_address, call("29d99a45", agent.address)),
      ]);
      const budget = {
        vault_id,
        agent_id: agent.id,
        agent_address: agent.address,
        daily_cap: decode(policy, 1).toString(),
        max_per_transaction: decode(policy, 0).toString(),
        spent_today: decode(policy, 2).toString(),
        remaining_daily: decode(remaining, 0).toString(),
        active: decode(policy, 5) !== 0n,
        last_synced_at: new Date().toISOString(),
      };
      const existing = await base44.asServiceRole.entities.AgentBudget.filter({vault_id, agent_address: agent.address});
      const saved = existing.length > 0
        ? await base44.asServiceRole.entities.AgentBudget.update(existing[0].id, budget)
        : await base44.asServiceRole.entities.AgentBudget.create(budget);
      results.push(saved);
    }
    return Response.json({ok: true, data: results, token_decimals, vault: vault_address});
  } catch (error) {
    return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500});
  }
});
