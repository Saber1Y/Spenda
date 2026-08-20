import {createClientFromRequest} from "npm:@base44/sdk";

const RPC_URL = "https://rpc.bohr.life";

const CONTRACTS = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  mockUSD: "0x981a7E272F309193D846dc585b64E4a2f172aD21",
  vault: "0xf23147df55089ea6ba87bf24bb4eee6f7cea182b",
  paymaster: "0xde609e52d9164c227d4f174d6260289bc3e62ec2",
};

const DEMO = {
  agent: "0xfdfa27c2ecc43e7b76a098409e95d125e0089598",
  agentOwnerEOA: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
  vendor: "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84",
};

const MUSD_DECIMALS = 6;

let rpcId = 0;
async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{to, data}, "latest"]}),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

function encodeABI(sig: string, ...args: string[]): string {
  const sel = sig.slice(0, 10);
  return sel + args.map(a => a.slice(2).padStart(64, "0")).join("");
}

function decodeUint256(result: string, offset = 0): bigint {
  return BigInt("0x" + result.slice(2 + offset * 64, 2 + (offset + 1) * 64));
}

function decodeBool(result: string, offset = 0): boolean {
  return decodeUint256(result, offset) !== 0n;
}

function decodeAddress(result: string, offset = 0): string {
  return "0x" + result.slice(2 + (offset + 1) * 24, 2 + (offset + 1) * 24 + 40).toLowerCase();
}

function formatAmount(baseUnits: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = baseUnits / divisor;
  const frac = baseUnits % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

const GET_POLICY_SEL = "0x3791dc6a";
const REMAINING_DAILY_SEL = "0x29d99a45";
const BALANCE_OF_SEL = "0x70a08231";
const OWNER_SEL = "0x8da5cb5b";
const ALLOWED_TARGET_SEL = "0xed8f4e2d";
const ALLOWED_TOKEN_SEL = "0xe02f7f62";

const GET_CODE_METHOD = "eth_getCode";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const vaultAddr = body.vaultAddress || CONTRACTS.vault;
    const agent = body.agentAddress || DEMO.agent;

    const [
      vaultBalanceResult,
      policyResult,
      remainingResult,
      paymasterDepositResult,
      ownerResult,
      codeResult,
    ] = await Promise.all([
      ethCall(CONTRACTS.mockUSD, encodeABI(BALANCE_OF_SEL, vaultAddr)),
      ethCall(vaultAddr, encodeABI(GET_POLICY_SEL, agent)),
      ethCall(vaultAddr, encodeABI(REMAINING_DAILY_SEL, agent)),
      ethCall(CONTRACTS.entryPoint, encodeABI(BALANCE_OF_SEL, CONTRACTS.paymaster)),
      ethCall(vaultAddr, OWNER_SEL),
      (async () => {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: GET_CODE_METHOD, params: [agent, "latest"]}),
        });
        const json = await res.json();
        return json.result;
      })(),
    ]);

    const vaultBalance = decodeUint256(vaultBalanceResult);
    const policyData = policyResult;
    const maxPerTx = decodeUint256(policyData, 0);
    const dailyCap = decodeUint256(policyData, 1);
    const spentToday = decodeUint256(policyData, 2);
    const lastResetTime = decodeUint256(policyData, 3);
    const expiry = decodeUint256(policyData, 4);
    const active = decodeBool(policyData, 5);
    const remainingDailyCap = decodeUint256(remainingResult);
    const paymasterDeposit = decodeUint256(paymasterDepositResult);
    const ownerAddress = decodeAddress(ownerResult);
    const isDeployed = !!codeResult && codeResult !== "0x";

    const now = new Date().toISOString();

    const existingVaults = await base44.asServiceRole.entities.Vault.filter({contract_address: vaultAddr});

    const vaultData = {
      contract_address: vaultAddr,
      owner_address: ownerAddress,
      chain_id: 968,
      agent_address: agent,
      display_name: "Spenda Demo Vault",
      token_address: CONTRACTS.mockUSD,
      token_symbol: "mUSD",
      token_decimals: MUSD_DECIMALS,
      vault_balance: vaultBalance.toString(),
      total_spent: spentToday.toString(),
      paymaster_address: CONTRACTS.paymaster,
      paymaster_deposit: paymasterDeposit.toString(),
      status: "active" as const,
      last_synced_at: now,
    };

    let vaultId: string;
    let vaultWasCreated = false;
    if (existingVaults.length > 0) {
      const updated = await base44.asServiceRole.entities.Vault.update(existingVaults[0].id, vaultData);
      vaultId = updated.id;
    } else {
      const created = await base44.asServiceRole.entities.Vault.create(vaultData);
      vaultId = created.id;
      vaultWasCreated = true;
    }

    const existingPolicies = await base44.asServiceRole.entities.Policy.filter({vault_id: vaultId, agent_address: agent});

    const policyEntityData = {
      vault_id: vaultId,
      agent_address: agent,
      max_per_tx: maxPerTx.toString(),
      daily_cap: dailyCap.toString(),
      spent_today: spentToday.toString(),
      remaining_daily: remainingDailyCap.toString(),
      expiry: expiry.toString(),
      active: active,
      last_synced_at: now,
    };

    let policyWasCreated = false;
    if (existingPolicies.length > 0) {
      await base44.asServiceRole.entities.Policy.update(existingPolicies[0].id, policyEntityData);
    } else {
      await base44.asServiceRole.entities.Policy.create(policyEntityData);
      policyWasCreated = true;
    }

    const existingAgents = await base44.asServiceRole.entities.Agent.filter({vault_id: vaultId, address: agent});

    let agentWasCreated = false;
    if (existingAgents.length === 0) {
      await base44.asServiceRole.entities.Agent.create({
        vault_id: vaultId,
        address: agent,
        owner_eoa: DEMO.agentOwnerEOA,
        display_name: "ProcurementBot",
        description: "Demo agent for Spenda",
        status: active ? "active" : "revoked",
        is_deployed: isDeployed,
      });
      agentWasCreated = true;
    }

    if (vaultWasCreated) {
      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "VAULT_CREATED",
        actor: "system",
        actor_type: "system",
        metadata: {contract_address: vaultAddr, chain_id: 968},
        timestamp: now,
      });
    }

    if (policyWasCreated) {
      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "POLICY_CREATED",
        actor: "system",
        actor_type: "system",
        metadata: {
          agent_address: agent,
          max_per_tx: formatAmount(maxPerTx, MUSD_DECIMALS),
          daily_cap: formatAmount(dailyCap, MUSD_DECIMALS),
          active,
        },
        timestamp: now,
      });
    } else {
      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "POLICY_UPDATED",
        actor: "system",
        actor_type: "system",
        metadata: {
          agent_address: agent,
          max_per_tx: formatAmount(maxPerTx, MUSD_DECIMALS),
          daily_cap: formatAmount(dailyCap, MUSD_DECIMALS),
          spent_today: formatAmount(spentToday, MUSD_DECIMALS),
          active,
        },
        timestamp: now,
      });
    }

    if (agentWasCreated) {
      await base44.asServiceRole.entities.AuditLog.create({
        vault_id: vaultId,
        action: "AGENT_REGISTERED",
        actor: "system",
        actor_type: "system",
        metadata: {
          agent_address: agent,
          owner_eoa: DEMO.agentOwnerEOA,
          display_name: "ProcurementBot",
          is_deployed: isDeployed,
        },
        timestamp: now,
      });
    }

    const [targetAllowedResult, tokenAllowedResult] = await Promise.all([
      ethCall(vaultAddr, encodeABI(ALLOWED_TARGET_SEL, agent, DEMO.vendor)),
      ethCall(vaultAddr, encodeABI(ALLOWED_TOKEN_SEL, agent, CONTRACTS.mockUSD)),
    ]);
    const targetAllowed = decodeBool(targetAllowedResult);
    const tokenAllowed = decodeBool(tokenAllowedResult);

    const allowlistEntries = [
      {address: DEMO.vendor, kind: "target" as const, label: "Demo Vendor", allowed: targetAllowed},
      {address: CONTRACTS.mockUSD, kind: "token" as const, label: "mUSD", allowed: tokenAllowed},
    ];

    for (const entry of allowlistEntries) {
      const existing = await base44.asServiceRole.entities.AllowlistEntry.filter({vault_id: vaultId, address: entry.address});
      const data = {
        vault_id: vaultId,
        policy_id: existingPolicies[0]?.id ?? "",
        address: entry.address,
        kind: entry.kind,
        label: entry.label,
        status: entry.allowed ? "active" : "removed",
      };
      if (existing.length > 0) {
        await base44.asServiceRole.entities.AllowlistEntry.update(existing[0].id, data);
      } else {
        await base44.asServiceRole.entities.AllowlistEntry.create(data);
      }
    }

    return Response.json({
      ok: true,
      vault_id: vaultId,
      vault_balance: formatAmount(vaultBalance, MUSD_DECIMALS),
      policy: {
        max_per_tx: formatAmount(maxPerTx, MUSD_DECIMALS),
        daily_cap: formatAmount(dailyCap, MUSD_DECIMALS),
        spent_today: formatAmount(spentToday, MUSD_DECIMALS),
        remaining_daily: formatAmount(remainingDailyCap, MUSD_DECIMALS),
        active: active,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 200});
  }
});
