/**
 * Single place that turns API error codes, RPC errors, and wallet rejections
 * into sentences a human can act on. Every dashboard surface renders through
 * this instead of showing raw codes.
 */

const CODE_MESSAGES: Record<string, string> = {
  // Spend pipeline (/api/spend/*)
  not_configured: "The server is not configured for live spending yet - the owner needs to add the signer keys.",
  account_not_deployed: "This agent's smart account is still deploying - try again in a few seconds.",
  agent_not_active: "This agent's policy is inactive or expired. Reactivate it on the Agents page.",
  exceeds_max_per_tx: "Blocked by policy: the amount exceeds this agent's max per transaction.",
  exceeds_daily_cap: "Blocked by policy: this agent hit its daily cap. It resets tomorrow (UTC).",
  not_allowed: "Blocked by policy: that vendor or token is not allowlisted for this agent.",
  unknown_or_expired_op: "That approval request expired - create the purchase again and re-approve.",
  bad_signature: "Signature rejected: it must come from the wallet that owns this agent.",
  not_sponsorable: "The gas sponsor rejected this operation - the paymaster may be underfunded.",
  bundler_rejected: "The network bundler rejected this operation - try again in a moment.",
  submission_failed: "Submitting to BOT Chain failed - try again in a moment.",
  timeout: "Submitted but not confirmed yet - check BOTScan in a minute before retrying.",

  // Provisioning (/api/provision)
  rate_limited: "Too many attempts from your network - wait an hour and try again.",
  rpc_unreachable: "BOT Chain RPC is unreachable right now - try again shortly.",
  invalid_json: "Malformed request - reload the page and try again.",

  // Intent engine (/api/intent)
  invalid_agent: "Pick a paying agent first.",
  amount_and_vendor_required: "Add an amount (and vendor for custom purchases).",
  invalid_amount: "Enter an amount between 0.01 and 100 USDT.",
};

const FALLBACKS = {
  rejected: "You declined the signature request - nothing was submitted.",
  generic: "Something went wrong - try again.",
};

export function friendlyError(error?: string | null, message?: string | null): string {
  if (error && CODE_MESSAGES[error]) return CODE_MESSAGES[error];
  const text = message ?? error ?? "";
  if (/user rejected|user denied|rejected the request|4001|cancelled|canceled/i.test(text)) {
    return FALLBACKS.rejected;
  }
  // Server messages are already written for humans; pass them through.
  if (text) return text;
  return FALLBACKS.generic;
}

/** Convenience for caught exceptions of any shape. */
export function friendlyErrorFrom(thrown: unknown): string {
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  return friendlyError(null, message);
}
