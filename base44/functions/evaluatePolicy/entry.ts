import {createClientFromRequest} from "npm:@base44/sdk";
import {publicClient} from "../../shared/chain.ts";
import {CONTRACTS, DEMO, MUSD_DECIMALS} from "../../shared/constants.ts";
import {vaultAbi, erc20Abi} from "../../shared/abis.ts";
import {formatAmount} from "../../shared/chain.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {recipient, amount} = await req.json();

    if (!recipient || !amount) {
      return Response.json({ok: false, error: "recipient and amount are required"}, {status: 400});
    }

    const agent = DEMO.agent;
    const vaultAddr = CONTRACTS.vault;
    const amountBigInt = BigInt(amount);

    const [policy, targetAllowed, tokenAllowed, remainingDaily, vaultBalance] = await Promise.all([
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "getPolicy", args: [agent]}),
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "allowedTarget", args: [agent, recipient]}),
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "allowedToken", args: [agent, CONTRACTS.mockUSD]}),
      publicClient.readContract({address: vaultAddr, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]}),
      publicClient.readContract({address: CONTRACTS.mockUSD, abi: erc20Abi, functionName: "balanceOf", args: [vaultAddr]}),
    ]);

    const p = policy as {maxPerTx: bigint; dailyCap: bigint; spentToday: bigint; lastResetTime: bigint; expiry: bigint; active: boolean};

    const checks: Array<{name: string; passed: boolean; detail: string}> = [];
    let overallPass = true;

    checks.push({
      name: "active",
      passed: p.active,
      detail: p.active ? "Policy is active" : "Policy is revoked",
    });
    if (!p.active) overallPass = false;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const notExpired = p.expiry === 0n || now <= p.expiry;
    checks.push({
      name: "not_expired",
      passed: notExpired,
      detail: notExpired ? "Policy is not expired" : `Policy expired at ${p.expiry.toString()}`,
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

    const withinPerTx = amountBigInt <= p.maxPerTx;
    checks.push({
      name: "per_tx_cap",
      passed: withinPerTx,
      detail: withinPerTx
        ? `${formatAmount(amountBigInt, MUSD_DECIMALS)} <= ${formatAmount(p.maxPerTx, MUSD_DECIMALS)} per-tx cap`
        : `${formatAmount(amountBigInt, MUSD_DECIMALS)} exceeds ${formatAmount(p.maxPerTx, MUSD_DECIMALS)} per-tx cap`,
    });
    if (!withinPerTx) overallPass = false;

    const withinDaily = amountBigInt <= remainingDaily;
    checks.push({
      name: "daily_cap",
      passed: withinDaily,
      detail: withinDaily
        ? `${formatAmount(amountBigInt, MUSD_DECIMALS)} within ${formatAmount(remainingDaily, MUSD_DECIMALS)} remaining daily`
        : `${formatAmount(amountBigInt, MUSD_DECIMALS)} exceeds ${formatAmount(remainingDaily, MUSD_DECIMALS)} remaining daily`,
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
        max_per_tx: formatAmount(p.maxPerTx, MUSD_DECIMALS),
        daily_cap: formatAmount(p.dailyCap, MUSD_DECIMALS),
        spent_today: formatAmount(p.spentToday, MUSD_DECIMALS),
        remaining_daily: formatAmount(remainingDaily, MUSD_DECIMALS),
        vault_balance: formatAmount(vaultBalance, MUSD_DECIMALS),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
