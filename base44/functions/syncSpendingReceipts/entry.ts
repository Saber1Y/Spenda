import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS, DEPLOY_BLOCK} from "../../shared/constants.ts";

const RPC_URL = "https://rpc.bohr.life";
const DECISION_TOPIC = "0x4240b112948ccb445a4384447f74f0dc34ae2a5ba8b10fccd21be1d706345c41";
let rpcId = 0;

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method, params})});
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

function addressFromTopic(topic: string): string {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function decodeWord(data: string, index: number): string {
  return data.slice(2 + index * 64, 2 + (index + 1) * 64);
}

function decodeString(data: string, offsetWord: number): string {
  const relative = Number(BigInt(`0x${decodeWord(data, offsetWord)}`));
  const lengthOffset = relative / 32;
  const length = Number(BigInt(`0x${decodeWord(data, lengthOffset)}`));
  const hex = data.slice(2 + (lengthOffset + 1) * 64, 2 + (lengthOffset + 1) * 64 + length * 2);
  return new TextDecoder().decode(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16)));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const vaultAddress = body.vaultAddress || CONTRACTS.vault;
    const vaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddress});
    if (vaults.length === 0) return Response.json({ok: false, error: "vault_not_found"}, {status: 404});
    const vault = vaults[0];
    const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
    const from = Number(body.from_block ?? DEPLOY_BLOCK);
    const logs = await rpc("eth_getLogs", [{address: vaultAddress, topics: [DECISION_TOPIC], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${latest.toString(16)}`}]);
    let created = 0;
    for (const log of logs) {
      const actionId = `0x${decodeWord(log.data, 1)}`;
      const existing = await base44.asServiceRole.entities.SpendingReceipt.filter({vault_id: vault.id, action_id: actionId});
      if (existing.length > 0) continue;
      const intents = await base44.asServiceRole.entities.SpendIntent.filter({vault_id: vault.id, action_id: actionId});
      const intent = intents[0];
      if (!intent) continue;
      const risks = await base44.asServiceRole.entities.RiskAssessment.filter({vault_id: vault.id, intent_id: intent.id});
      const approvals = await base44.asServiceRole.entities.ApprovalRequest.filter({vault_id: vault.id, intent_id: intent.id});
      const approved = BigInt(`0x${decodeWord(log.data, 2)}`) !== 0n;
      const reason = decodeString(log.data, 3);
      const block = await rpc("eth_getBlockByNumber", [log.blockNumber, false]);
      const humanApproved = approvals[0]?.status === "approved" || approvals[0]?.status === "consumed";
      const decision = approved ? (humanApproved ? "human_approved" : "approved") : "blocked";
      await base44.asServiceRole.entities.SpendingReceipt.create({
        vault_id: vault.id,
        receipt_number: `SP-${BigInt(log.blockNumber).toString().padStart(8, "0")}-${BigInt(log.logIndex).toString().padStart(3, "0")}`,
        intent_id: intent.id,
        agent_id: intent.agent_id,
        agent_address: addressFromTopic(log.topics[1]),
        amount: BigInt(`0x${decodeWord(log.data, 0)}`).toString(),
        token: addressFromTopic(log.topics[3]),
        recipient: addressFromTopic(log.topics[2]),
        intent_type: intent.intent_type,
        category: intent.category || "",
        risk_assessment_id: risks[0]?.id || "",
        risk_score: risks[0]?.score ?? 0,
        decision,
        decision_reason: reason,
        approval_id: approvals[0]?.id || "",
        action_id: actionId,
        transaction_hash: log.transactionHash,
        block_number: BigInt(log.blockNumber).toString(),
        created_at_chain_time: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(),
      });
      await base44.asServiceRole.entities.SpendIntent.update(intent.id, {status: approved ? "executed" : "blocked"});
      if (humanApproved) await base44.asServiceRole.entities.ApprovalRequest.update(approvals[0].id, {status: "consumed", consumed_at: new Date().toISOString()});
      created++;
    }
    return Response.json({ok: true, scanned: logs.length, created, latest_block: latest});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ok: false, error: message}, {status: 500});
  }
});
