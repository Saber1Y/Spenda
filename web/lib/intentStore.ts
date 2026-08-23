/**
 * Client-side intent persistence. The intent engine (/api/intent) is
 * stateless, so the browser owns intent records: pending human approvals are
 * queued in localStorage, and execution metadata enriches chain-derived
 * receipts with risk scores and merchant labels.
 */
import type {Intent} from "@/lib/intentTypes";

export const PENDING_KEY = "spenda:pendingApprovals";
export const META_KEY = "spenda:intentMeta";

export function loadPendingApprovals(): Intent[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
}

export function savePendingApproval(intent: Intent): void {
  const list = loadPendingApprovals();
  list.push(intent);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

export function removePendingApproval(intentId: string): Intent[] {
  const remaining = loadPendingApprovals().filter((p) => p.intentId !== intentId);
  localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  return remaining;
}

export interface IntentMeta {
  label: string;
  riskScore: number | null;
  category: string;
}

export function rememberIntentMeta(intent: Intent): void {
  const meta = JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as Record<string, IntentMeta>;
  meta[intent.actionId.toLowerCase()] = {label: intent.label, riskScore: intent.riskScore, category: intent.category};
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function readIntentMeta(): Record<string, IntentMeta> {
  if (typeof window === "undefined") return {};
  return JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as Record<string, IntentMeta>;
}

/** Registry of agents the connected user created, for agent pickers. */
const MY_AGENTS_KEY = "spenda:myAgents";

export interface MyAgent {
  address: string;
  name: string;
  description?: string;
  owner?: string;
}

export function loadMyAgents(): MyAgent[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(MY_AGENTS_KEY) ?? "[]") as MyAgent[];
}

export function rememberMyAgent(agent: MyAgent): void {
  if (typeof window === "undefined") return;
  const list = JSON.parse(localStorage.getItem(MY_AGENTS_KEY) ?? "[]") as MyAgent[];
  if (!list.some((a) => a.address.toLowerCase() === agent.address.toLowerCase())) list.push(agent);
  localStorage.setItem(MY_AGENTS_KEY, JSON.stringify(list));
}
