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
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  mockUSD: "0x981a7E272F309193D846dc585b64E4a2f172aD21",
  vault: "0xbE4e1109d0c8f9558E16A6C59388B6Fb210a2F88",
  paymaster: "0x5431d8538Fc62Da83A02dCFc275616f24b4587c4",
};

const DEMO = {
  agent: "0xCc19a6CD4c18Ea52a0E49DAb62c5C0F22800fa2B",
  agentOwnerEOA: "0x772887b05B19A046c242Fa19eEC6a78496d3b692",
  vendor: "0x7138931Fc8b4924090b08Ed00D74Ce750c52f937",
};

const MUSD_DECIMALS = 6;

const vaultAbi = [
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
  "function owner() view returns (address)",
] as const;

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
] as const;

const entryPointAbi = [
  "function balanceOf(address) view returns (uint256)",
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

    const vaultAddr = CONTRACTS.vault;
    const agent = DEMO.agent;

    const [
      vaultBalance,
      policy,
      remainingDailyCap,
      paymasterDeposit,
      agentCode,
    ] = await Promise.all([
      publicClient.readContract({address: CONTRACTS.mockUSD, abi: erc20Abi, functionName: "balanceOf", args: [vaultAddr]}),
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "getPolicy", args: [agent]}),
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]}),
      publicClient.readContract({address: CONTRACTS.entryPoint, abi: entryPointAbi, functionName: "balanceOf", args: [CONTRACTS.paymaster]}),
      publicClient.getCode({address: agent}),
    ]);

    const p = policy as {maxPerTx: bigint; dailyCap: bigint; spentToday: bigint; lastResetTime: bigint; expiry: bigint; active: boolean};
    const now = new Date().toISOString();

    const existingVaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddr});

    const vaultData = {
      contract_address: vaultAddr,
      chain_id: 968,
      agent_address: agent,
      display_name: "Spenda Demo Vault",
      token_address: CONTRACTS.mockUSD,
      token_symbol: "mUSD",
      token_decimals: MUSD_DECIMALS,
      vault_balance: vaultBalance.toString(),
      total_spent: p.spentToday.toString(),
      paymaster_address: CONTRACTS.paymaster,
      paymaster_deposit: paymasterDeposit.toString(),
      status: "active" as const,
      last_synced_at: now,
    };

    let vaultId: string;
    if (existingVaults.length > 0) {
      const updated = await base44.asServiceRole.entities.Vault.update(existingVaults[0].id, vaultData);
      vaultId = updated.id;
    } else {
      const created = await base44.asServiceRole.entities.Vault.create(vaultData);
      vaultId = created.id;
    }

    const existingPolicies = await base44.asServiceRole.entities.Policy.filter({vault_id: vaultId, agent_address: agent});

    const policyData = {
      vault_id: vaultId,
      agent_address: agent,
      max_per_tx: p.maxPerTx.toString(),
      daily_cap: p.dailyCap.toString(),
      spent_today: p.spentToday.toString(),
      remaining_daily: remainingDailyCap.toString(),
      expiry: p.expiry.toString(),
      active: p.active,
      last_synced_at: now,
    };

    if (existingPolicies.length > 0) {
      await base44.asServiceRole.entities.Policy.update(existingPolicies[0].id, policyData);
    } else {
      await base44.asServiceRole.entities.Policy.create(policyData);
    }

    const existingAgents = await base44.asServiceRole.entities.Agent.filter({vault_id: vaultId, address: agent});

    if (existingAgents.length === 0) {
      await base44.asServiceRole.entities.Agent.create({
        vault_id: vaultId,
        address: agent,
        owner_eoa: DEMO.agentOwnerEOA,
        display_name: "ProcurementBot",
        description: "Demo agent for Spenda hackathon",
        status: p.active ? "active" : "revoked",
        is_deployed: !!agentCode && agentCode !== "0x",
      });
    }

    return Response.json({
      ok: true,
      vault_id: vaultId,
      vault_balance: formatAmount(vaultBalance, MUSD_DECIMALS),
      policy: {
        max_per_tx: formatAmount(p.maxPerTx, MUSD_DECIMALS),
        daily_cap: formatAmount(p.dailyCap, MUSD_DECIMALS),
        spent_today: formatAmount(p.spentToday, MUSD_DECIMALS),
        remaining_daily: formatAmount(remainingDailyCap, MUSD_DECIMALS),
        active: p.active,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
