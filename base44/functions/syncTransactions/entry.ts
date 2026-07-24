import {createClientFromRequest} from "npm:@base44/sdk";
import {createPublicClient, http, getAbiItem} from "npm:viem";

const RPC_URL = "https://rpc.bohr.life";
const CHAIN_ID = 968;

const botChain = {
  id: CHAIN_ID,
  name: "BOT Chain Testnet",
  network: "bot-testnet",
  nativeCurrency: {name: "BOT", symbol: "BOT", decimals: 18},
  rpcUrls: {default: {http: [RPC_URL]}, public: {http: [RPC_URL]}},
  blockExplorers: {default: {name: "BOTScan", url: "https://scan.bohr.life"}},
} as const;

const publicClient = createPublicClient({
  chain: botChain,
  transport: http(RPC_URL),
});

const CONTRACTS = {
  vault: "0xbE4e1109d0c8f9558E16A6C59388B6Fb210a2F88",
  mockUSD: "0x981a7E272F309193D846dc585b64E4a2f172aD21",
};

const DEMO = {
  agent: "0xCc19a6CD4c18Ea52a0E49DAb62c5C0F22800fa2B",
};

const MUSD_DECIMALS = 6;

const vaultAbi = [
  "event AgentActionApproved(address indexed agent,address indexed target,address indexed token,uint256 amount,bytes32 actionId)",
  "event AgentActionBlocked(address indexed agent,address indexed target,address indexed token,uint256 amount,string reason)",
] as const;

function formatAmount(baseUnits: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = baseUnits / divisor;
  const frac = baseUnits % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const fromBlockArg = body.args?.from_block;

    const agent = DEMO.agent;
    const vaultAddr = CONTRACTS.vault;

    const existingVaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddr});
    if (existingVaults.length === 0) {
      return Response.json({ok: false, error: "No vault entity found. Run syncVaultState first."}, {status: 400});
    }
    const vaultId = existingVaults[0].id;

    const startBlock = fromBlockArg ? BigInt(fromBlockArg) : 0n;
    const latestBlock = await publicClient.getBlockNumber();

    if (startBlock >= latestBlock) {
      return Response.json({ok: true, message: "Already synced", latest_block: latestBlock.toString()});
    }

    const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
    const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

    const [approvedLogs, blockedLogs] = await Promise.all([
      publicClient.getLogs({address: vaultAddr, event: approvedEvent, args: {agent}, fromBlock: startBlock + 1n, toBlock: latestBlock}),
      publicClient.getLogs({address: vaultAddr, event: blockedEvent, args: {agent}, fromBlock: startBlock + 1n, toBlock: latestBlock}),
    ]);

    const now = new Date().toISOString();
    let created = 0;

    for (const log of approvedLogs) {
      const existing = await base44.asServiceRole.entities.Transaction.filter({tx_hash: log.transactionHash!});
      if (existing.length > 0) continue;

      await base44.asServiceRole.entities.Transaction.create({
        vault_id: vaultId,
        agent_address: log.args.agent!,
        recipient: log.args.target!,
        token: log.args.token!,
        token_symbol: "mUSD",
        amount: log.args.amount!.toString(),
        amount_display: formatAmount(log.args.amount!, MUSD_DECIMALS),
        status: "EXECUTED",
        tx_hash: log.transactionHash!,
        block_number: log.blockNumber!.toString(),
        action_id: log.args.actionId,
      });

      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "PAYMENT_EXECUTED",
        actor: log.args.agent!,
        actor_type: "agent",
        metadata: {
          recipient: log.args.target!,
          amount: formatAmount(log.args.amount!, MUSD_DECIMALS),
          token_symbol: "mUSD",
        },
        tx_hash: log.transactionHash!,
        timestamp: now,
      });

      created++;
    }

    for (const log of blockedLogs) {
      const existing = await base44.asServiceRole.entities.Transaction.filter({tx_hash: log.transactionHash!});
      if (existing.length > 0) continue;

      await base44.asServiceRole.entities.Transaction.create({
        vault_id: vaultId,
        agent_address: log.args.agent!,
        recipient: log.args.target!,
        token: log.args.token!,
        token_symbol: "mUSD",
        amount: log.args.amount!.toString(),
        amount_display: formatAmount(log.args.amount!, MUSD_DECIMALS),
        status: "BLOCKED",
        block_reason: log.args.reason,
        tx_hash: log.transactionHash!,
        block_number: log.blockNumber!.toString(),
      });

      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "PAYMENT_BLOCKED",
        actor: log.args.agent!,
        actor_type: "agent",
        metadata: {
          recipient: log.args.target!,
          amount: formatAmount(log.args.amount!, MUSD_DECIMALS),
          reason: log.args.reason,
          token_symbol: "mUSD",
        },
        tx_hash: log.transactionHash!,
        timestamp: now,
      });

      created++;
    }

    await base44.asServiceRole.entities.Vault.update(vaultId, {
      last_synced_at: now,
    });

    return Response.json({
      ok: true,
      from_block: (startBlock + 1n).toString(),
      to_block: latestBlock.toString(),
      approved: approvedLogs.length,
      blocked: blockedLogs.length,
      new_records: created,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
