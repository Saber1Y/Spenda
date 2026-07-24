import {createClientFromRequest} from "npm:@base44/sdk";
import {CONTRACTS, DEMO, MUSD_DECIMALS} from "../../shared/constants.ts";

const RPC_URL = "https://rpc.bohr.life";
let rpcId = 0;

function encodeHex(value: bigint | number | string): string {
  if (typeof value === "bigint") return "0x" + value.toString(16);
  if (typeof value === "number") return "0x" + value.toString(16);
  return value.startsWith("0x") ? value : "0x" + value;
}

function pad32(value: bigint | number | string): string {
  const hex = encodeHex(value).slice(2);
  return hex.padStart(64, "0");
}

function encodeABI(...args: any[]): string {
  return "0x" + args.map(pad32).join("");
}

function decodeUint256(hex: string, wordIndex = 0): bigint {
  const offset = 2 + wordIndex * 64;
  return BigInt("0x" + hex.slice(offset, offset + 64));
}

function decodeBool(hex: string, wordIndex = 0): boolean {
  return decodeUint256(hex, wordIndex) !== 0n;
}

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{to, data}, "latest"]}),
  });
  const json = await res.json();
  return json.result;
}

const GET_POLICY_SEL = "0x3791dc6a";
const REMAINING_DAILY_SEL = "0x29d99a45";
const BALANCE_OF_SEL = "0x70a08231";
const ALLOWED_TARGET_SEL = "0xed8f4e2d";
const ALLOWED_TOKEN_SEL = "0xe02f7f62";

function formatAmount(value: bigint, decimals: number): string {
  const s = value.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals);
  const trimmed = fracPart.replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

Deno.serve(async (req) => {
  try {
    const {agent: agentParam, recipient, amount} = await req.json();
    const agent = agentParam || DEMO.agent;

    if (!recipient || !amount) {
      return Response.json({ok: false, error: "recipient and amount are required"}, {status: 400});
    }

    const vaultAddr = CONTRACTS.vault;
    const amountBigInt = BigInt(amount);

    const [policyResult, remainingResult, vaultBalanceResult, targetAllowedResult, tokenAllowedResult] = await Promise.all([
      ethCall(vaultAddr, encodeABI(GET_POLICY_SEL, agent)),
      ethCall(vaultAddr, encodeABI(REMAINING_DAILY_SEL, agent)),
      ethCall(CONTRACTS.mockUSD, encodeABI(BALANCE_OF_SEL, vaultAddr)),
      ethCall(vaultAddr, encodeABI(ALLOWED_TARGET_SEL, agent, recipient)),
      ethCall(vaultAddr, encodeABI(ALLOWED_TOKEN_SEL, agent, CONTRACTS.mockUSD)),
    ]);

    const maxPerTx = decodeUint256(policyResult, 0);
    const dailyCap = decodeUint256(policyResult, 1);
    const spentToday = decodeUint256(policyResult, 2);
    const lastResetTime = decodeUint256(policyResult, 3);
    const expiry = decodeUint256(policyResult, 4);
    const active = decodeBool(policyResult, 5);
    const remainingDailyCap = decodeUint256(remainingResult);
    const vaultBalance = decodeUint256(vaultBalanceResult);
    const targetAllowed = decodeBool(targetAllowedResult);
    const tokenAllowed = decodeBool(tokenAllowedResult);

    const checks: Array<{name: string; passed: boolean; detail: string}> = [];
    let overallPass = true;

    checks.push({
      name: "active",
      passed: active,
      detail: active ? "Policy is active" : "Policy is revoked",
    });
    if (!active) overallPass = false;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const notExpired = expiry === 0n || now <= expiry;
    checks.push({
      name: "not_expired",
      passed: notExpired,
      detail: notExpired ? "Policy is not expired" : `Policy expired at ${expiry.toString()}`,
    });
    if (!notExpired) overallPass = false;

    checks.push({
      name: "token_allowed",
      passed: tokenAllowed,
      detail: tokenAllowed ? "Token mUSD is on allowlist" : "Token not on allowlist",
    });
    if (!tokenAllowed) overallPass = false;

    checks.push({
      name: "target_allowed",
      passed: targetAllowed,
      detail: targetAllowed ? `Target ${recipient} is on allowlist` : `Target ${recipient} not on allowlist`,
    });
    if (!targetAllowed) overallPass = false;

    const withinPerTx = amountBigInt <= maxPerTx;
    checks.push({
      name: "per_tx_cap",
      passed: withinPerTx,
      detail: withinPerTx
        ? `${formatAmount(amountBigInt, MUSD_DECIMALS)} <= ${formatAmount(maxPerTx, MUSD_DECIMALS)} per-tx cap`
        : `${formatAmount(amountBigInt, MUSD_DECIMALS)} exceeds ${formatAmount(maxPerTx, MUSD_DECIMALS)} per-tx cap`,
    });
    if (!withinPerTx) overallPass = false;

    const withinDaily = amountBigInt <= remainingDailyCap;
    checks.push({
      name: "daily_cap",
      passed: withinDaily,
      detail: withinDaily
        ? `${formatAmount(amountBigInt, MUSD_DECIMALS)} within ${formatAmount(remainingDailyCap, MUSD_DECIMALS)} remaining daily`
        : `${formatAmount(amountBigInt, MUSD_DECIMALS)} exceeds ${formatAmount(remainingDailyCap, MUSD_DECIMALS)} remaining daily`,
    });
    if (!withinDaily) overallPass = false;

    const hasBalance = amountBigInt <= vaultBalance;
    checks.push({
      name: "vault_balance",
      passed: hasBalance,
      detail: hasBalance
        ? `Vault has ${formatAmount(vaultBalance, MUSD_DECIMALS)} mUSD`
        : `Vault only has ${formatAmount(vaultBalance, MUSD_DECIMALS)} mUSD`,
    });
    if (!hasBalance) overallPass = false;

    return Response.json({
      ok: true,
      overall_pass: overallPass,
      checks,
      policy_snapshot: {
        max_per_tx: formatAmount(maxPerTx, MUSD_DECIMALS),
        daily_cap: formatAmount(dailyCap, MUSD_DECIMALS),
        spent_today: formatAmount(spentToday, MUSD_DECIMALS),
        remaining_daily: formatAmount(remainingDailyCap, MUSD_DECIMALS),
        vault_balance: formatAmount(vaultBalance, MUSD_DECIMALS),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
