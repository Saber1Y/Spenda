import {pollUserOpReceipt, resolveOutcome, type RunOutcome} from "./bundler";

export interface IntentExecutionResult {
  userOpHash: `0x${string}`;
  outcome: RunOutcome;
}

function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("base44_access_token") ?? localStorage.getItem("token");
}

export async function executeIntent(intentId: string): Promise<IntentExecutionResult> {
  const token = accessToken();
  if (!token) throw new Error("Sign in before executing an approved intent.");
  const response = await fetch("/api/sponsor", {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
    body: JSON.stringify({intentId}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? "Intent execution failed");
  const userOpHash = payload.userOpHash as `0x${string}`;
  const receipt = await pollUserOpReceipt(userOpHash);
  if (!receipt) throw new Error("Execution was submitted but receipt polling timed out.");
  const outcome = resolveOutcome(receipt);
  if (!outcome) throw new Error("Execution landed without a Spenda decision event.");
  return {userOpHash, outcome};
}
