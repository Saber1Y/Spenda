import type {Hex} from "viem";
import {friendlyError} from "@/lib/errorMessages";

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
  actionId?: string,
): Promise<UserSpendOutcome> {
  const prepRes = await fetch("/api/spend/prepare", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({sender, amountBaseUnits, vendor, actionId}),
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
  return friendlyError(outcome.error, outcome.message);
}
