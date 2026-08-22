import type {Hex} from "viem";

export interface UserSpendOutcome {
  ok?: boolean;
  status?: string;
  success?: boolean;
  reason?: string | null;
  txHash?: string | null;
  error?: string;
  message?: string;
}

/**
 * Client half of the user-signed sponsored spend:
 * 1. /api/spend/prepare builds everything server-side and returns the userOpHash.
 * 2. The connected wallet (the agent's owner) signs that hash.
 * 3. /api/spend/send verifies ownership and submits through the paymaster.
 */
export async function runUserSpend(
  signMessage: (args: {message: {raw: Hex}}) => Promise<Hex>,
  sender: string,
  amountBaseUnits: string,
  vendor?: string,
): Promise<UserSpendOutcome> {
  const prepRes = await fetch("/api/spend/prepare", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({sender, amountBaseUnits, vendor}),
  });
  const prep = await prepRes.json();
  if (!prepRes.ok) {
    return {ok: false, error: prep?.error ?? "prepare_failed", message: prep?.message ?? prep?.error};
  }
  const signature = await signMessage({message: {raw: prep.userOpHash as Hex}});
  const sendRes = await fetch("/api/spend/send", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({userOpHash: prep.userOpHash, signature}),
  });
  const sent = await sendRes.json();
  return {...sent, ok: sendRes.ok};
}

export function describeSpendError(outcome: UserSpendOutcome): string {
  const messages: Record<string, string> = {
    rate_limited: "Too many runs - slow down and retry.",
    exceeds_max_per_tx: "Blocked on-chain policy check: exceeds this agent's max per transaction.",
    exceeds_daily_cap: "Blocked on-chain policy check: daily cap would be exceeded.",
    agent_not_active: "This agent's policy is inactive or expired.",
    account_not_deployed: "Account not deployed yet - retry in a moment.",
    not_allowed: "Vendor or token is not allowlisted for this agent.",
    not_sponsorable: "The gas sponsor rejected this operation.",
    bad_signature: "Wallet signature rejected - it must come from the agent owner.",
    unknown_or_expired_op: "Prepared request expired - start again.",
    bundler_rejected: "Bundler rejected the operation.",
    submission_failed: "Submission failed - try again.",
  };
  if (outcome.error && messages[outcome.error]) return messages[outcome.error];
  return outcome.message ?? outcome.error ?? "Something went wrong.";
}
