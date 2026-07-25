import {decodeEventLog, getAbiItem, type Hex} from "viem";
import {publicClient} from "./chain";
import {vaultAbi, PROOF_TX, getActiveContracts} from "./contracts";

export interface ProofResult {
  kind: "approved" | "blocked";
  amount: bigint;
  reason?: string;
  txHash: Hex;
  live: boolean; // true = fetched on-chain, false = static snapshot fallback
}

/** Known real values (from the backend run) — the honest fallback if the live read fails. */
const SNAPSHOT: Record<"approved" | "blocked", ProofResult> = {
  approved: {kind: "approved", amount: 4_000_000n, txHash: PROOF_TX.approved as Hex, live: false},
  blocked: {kind: "blocked", amount: 6_000_000n, reason: "exceeds maxPerTx", txHash: PROOF_TX.blocked as Hex, live: false},
};

const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

/** Live-fetch a proof tx's vault event via raw receipt (no viem formatter), decode the amount/reason. */
export async function fetchProof(kind: "approved" | "blocked"): Promise<ProofResult> {
  const txHash = (kind === "approved" ? PROOF_TX.approved : PROOF_TX.blocked) as Hex;
  const evt = kind === "approved" ? approvedEvent : blockedEvent;
  try {
    const receipt = (await publicClient.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as {logs?: {address: string; data: Hex; topics: [Hex, ...Hex[]]}[]} | null;
    if (!receipt?.logs) return SNAPSHOT[kind];
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== getActiveContracts().vault.toLowerCase()) continue;
      try {
        const dec = decodeEventLog({abi: [evt], data: log.data, topics: log.topics});
        if (dec.eventName === evt.name) {
          const args = dec.args as {amount: bigint; reason?: string};
          return {kind, amount: args.amount, reason: args.reason, txHash, live: true};
        }
      } catch {
        /* not this event — keep scanning */
      }
    }
    return SNAPSHOT[kind];
  } catch {
    return SNAPSHOT[kind];
  }
}
