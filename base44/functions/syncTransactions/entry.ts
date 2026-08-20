import {createClientFromRequest} from "npm:@base44/sdk";

const RPC_URL = "https://rpc.bohr.life";

const CONTRACTS = {
  vault: "0xfB88d06289EaDD3aE23ef5C7bEF816baFfbf4000",
  mockUSD: "0xAD6F06ebA7927FC0f114c296C221fCfd6C5eBf58",
};

const DEMO = {
  agent: "0x2649495B56e8c06C6682549438ac9279599A3aD8",
};

const MUSD_DECIMALS = 6;

const APPROVED_TOPIC = "0xe2c249d01fbb6f58e162545478f72a7dd54ec94925b865863739aadd4793d48a";
const BLOCKED_TOPIC = "0x254dbf48d5deac3ab07e5ed11e07ce1370145f2593df0e6c6214f70f8c950d23";

function formatAmount(baseUnits: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = baseUnits / divisor;
  const frac = baseUnits % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

function padAddr(topic: string): string {
  return "0x" + topic.slice(26).toLowerCase();
}

function decodeUint256(data: string, offset: number): bigint {
  return BigInt("0x" + data.slice(2 + offset * 64, 2 + (offset + 1) * 64));
}

function decodeBytes32(data: string, offset: number): string {
  return "0x" + data.slice(2 + offset * 64, 2 + (offset + 1) * 64);
}

function decodeString(data: string, dataOffset: number): string {
  try {
    const relativeOffset = Number(decodeUint256(data, dataOffset));
    const strLen = Number(decodeUint256(data, dataOffset + relativeOffset));
    const hexStr = data.slice(2 + (dataOffset + relativeOffset + 1) * 64, 2 + (dataOffset + relativeOffset + 1) * 64 + strLen * 2);
    return Buffer.from(hexStr, "hex").toString("utf-8");
  } catch {
    return "";
  }
}

let rpcId = 0;
async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method, params}),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const fromBlockArg = body.args?.from_block;

    const agent = body.agentAddress || DEMO.agent;
    const vaultAddr = body.vaultAddress || CONTRACTS.vault;

    const existingVaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddr});
    if (existingVaults.length === 0) {
      return Response.json({ok: false, error: "No vault entity found. Run syncVaultState first."}, {status: 400});
    }
    const vaultId = existingVaults[0].id;

    const startBlock = fromBlockArg ? parseInt(fromBlockArg, 10) : 0;
    const latestHex = await rpc("eth_blockNumber", []);
    const latestBlock = parseInt(latestHex, 16);

    if (startBlock >= latestBlock) {
      return Response.json({ok: true, message: "Already synced", latest_block: latestBlock.toString()});
    }

    const fromHex = "0x" + (startBlock + 1).toString(16);
    const toHex = "0x" + latestBlock.toString(16);

    const [approvedLogs, blockedLogs] = await Promise.all([
      rpc("eth_getLogs", [{address: vaultAddr, topics: [APPROVED_TOPIC, "0x" + agent.slice(2).padStart(64, "0")], fromBlock: fromHex, toBlock: toHex}]),
      rpc("eth_getLogs", [{address: vaultAddr, topics: [BLOCKED_TOPIC, "0x" + agent.slice(2).padStart(64, "0")], fromBlock: fromHex, toBlock: toHex}]),
    ]);

    const now = new Date().toISOString();
    let created = 0;

    for (const log of approvedLogs) {
      const existing = await base44.asServiceRole.entities.Transaction.filter({tx_hash: log.transactionHash});
      if (existing.length > 0) continue;

      const target = padAddr(log.topics[2]);
      const token = padAddr(log.topics[3]);
      const amount = decodeUint256(log.data, 0);
      const actionId = decodeBytes32(log.data, 1);
      const blockNum = parseInt(log.blockNumber, 16);

      await base44.asServiceRole.entities.Transaction.create({
        vault_id: vaultId,
        agent_address: agent,
        recipient: target,
        token: token,
        token_symbol: "mUSD",
        amount: amount.toString(),
        amount_display: formatAmount(amount, MUSD_DECIMALS),
        status: "EXECUTED",
        tx_hash: log.transactionHash,
        block_number: blockNum.toString(),
        action_id: actionId,
      });

      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "PAYMENT_EXECUTED",
        actor: agent,
        actor_type: "agent",
        metadata: {
          recipient: target,
          amount: formatAmount(amount, MUSD_DECIMALS),
          token_symbol: "mUSD",
        },
        tx_hash: log.transactionHash,
        timestamp: now,
      });

      created++;
    }

    for (const log of blockedLogs) {
      const existing = await base44.asServiceRole.entities.Transaction.filter({tx_hash: log.transactionHash});
      if (existing.length > 0) continue;

      const target = padAddr(log.topics[2]);
      const token = padAddr(log.topics[3]);
      const amount = decodeUint256(log.data, 0);
      const reason = decodeString(log.data, 1);
      const blockNum = parseInt(log.blockNumber, 16);

      await base44.asServiceRole.entities.Transaction.create({
        vault_id: vaultId,
        agent_address: agent,
        recipient: target,
        token: token,
        token_symbol: "mUSD",
        amount: amount.toString(),
        amount_display: formatAmount(amount, MUSD_DECIMALS),
        status: "BLOCKED",
        block_reason: reason,
        tx_hash: log.transactionHash,
        block_number: blockNum.toString(),
      });

      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "PAYMENT_BLOCKED",
        actor: agent,
        actor_type: "agent",
        metadata: {
          recipient: target,
          amount: formatAmount(amount, MUSD_DECIMALS),
          reason: reason,
          token_symbol: "mUSD",
        },
        tx_hash: log.transactionHash,
        timestamp: now,
      });

      created++;
    }

    await base44.asServiceRole.entities.Vault.update(vaultId, {
      last_synced_at: now,
    });

    return Response.json({
      ok: true,
      from_block: (startBlock + 1).toString(),
      to_block: latestBlock.toString(),
      approved: approvedLogs.length,
      blocked: blockedLogs.length,
      new_records: created,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 200});
  }
});
