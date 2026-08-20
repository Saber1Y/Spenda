import {createClientFromRequest} from "npm:@base44/sdk";

const RPC = "https://rpc.bohr.life";
const ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const BALANCE_OF = "0x70a08231";
const POLICY = "0x3791dc6a";
const REMAINING = "0x29d99a45";
const LOW_PAYMASTER = 100000000000000000n;
const LOW_VAULT = 10000000n;

let id = 0;
function word(value: string): string { return value.slice(2).padStart(64, "0"); }
function call(selector: string, value: string): string { return selector + word(value); }
function decode(result: string, index = 0): bigint { return BigInt(`0x${result.slice(2 + index * 64, 2 + (index + 1) * 64)}`); }
async function rpc(method: string, params: unknown[]) { const response = await fetch(RPC, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: ++id, method, params})}); const json = await response.json(); if (json.error) throw new Error(json.error.message); return json.result; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {vault_id} = await req.json();
    if (!vault_id) return Response.json({ok: false, error: "vault_id is required"}, {status: 400});
    const vaults = await base44.asServiceRole.entities.Vault.filter({id: vault_id});
    if (vaults.length === 0) return Response.json({ok: false, error: "vault_not_found"}, {status: 404});
    const vault = vaults[0];
    const latestHex = await rpc("eth_blockNumber", []);
    const latest = Number(BigInt(latestHex));
    const block = await rpc("eth_getBlockByNumber", [latestHex, false]);
    const agents = await base44.asServiceRole.entities.Agent.filter({vault_id});
    const [vaultBalance, paymasterDeposit, executions] = await Promise.all([
      rpc("eth_call", [{to: vault.token_address, data: call(BALANCE_OF, vault.contract_address)}, "latest"]),
      rpc("eth_call", [{to: ENTRYPOINT, data: call(BALANCE_OF, vault.paymaster_address)}, "latest"]),
      base44.asServiceRole.entities.SpendIntent.filter({vault_id, status: "executing"}),
    ]);
    let custodyViolations = 0;
    const alerts = [];
    for (const agent of agents) {
      const [native, deposit] = await Promise.all([rpc("eth_getBalance", [agent.address, "latest"]), rpc("eth_call", [{to: ENTRYPOINT, data: call(BALANCE_OF, agent.address)}, "latest"])]);
      if (BigInt(native) > 0n || decode(deposit) > 0n) custodyViolations++;
    }
    const vaultUnits = decode(vaultBalance);
    const paymasterUnits = decode(paymasterDeposit);
    if (paymasterUnits < LOW_PAYMASTER) alerts.push({code: "LOW_PAYMASTER", severity: paymasterUnits === 0n ? "critical" : "warning", message: "Paymaster deposit is low; gasless execution may stop", evidence: {deposit: paymasterUnits.toString()}});
    if (vaultUnits < LOW_VAULT) alerts.push({code: "LOW_VAULT_BALANCE", severity: vaultUnits === 0n ? "critical" : "warning", message: "Vault balance is low", evidence: {balance: vaultUnits.toString()}});
    if (custodyViolations > 0) alerts.push({code: "AGENT_CUSTODY_VIOLATION", severity: "critical", message: "An agent account holds native funds or EntryPoint deposit", evidence: {count: custodyViolations}});
    if (executions.length > 0) alerts.push({code: "STUCK_EXECUTION", severity: "warning", message: "Intent execution requires reconciliation", evidence: {count: executions.length}});
    const status = alerts.some((alert) => alert.severity === "critical") ? "critical" : alerts.length > 0 ? "degraded" : "healthy";
    const snapshot = await base44.asServiceRole.entities.OperationsSnapshot.create({vault_id, chain_id: 968, block_number: String(latest), block_timestamp: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(), vault_balance: vaultUnits.toString(), paymaster_deposit: paymasterUnits.toString(), agent_count: agents.length, custody_violations: custodyViolations, stuck_executions: executions.length, indexer_lag_blocks: Math.max(0, latest - Number(vault.last_synced_block ?? latest)), rpc_healthy: true, status, created_at_chain_time: new Date().toISOString()});
    for (const alert of alerts) await base44.asServiceRole.entities.OperationsAlert.create({vault_id, ...alert, status: "open", observed_at: new Date().toISOString()});
    return Response.json({ok: true, snapshot, alerts});
  } catch (error) { return Response.json({ok: false, error: error instanceof Error ? error.message : String(error)}, {status: 500}); }
});
