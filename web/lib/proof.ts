import {decodeEventLog, encodeEventTopics, getAbiItem, toHex, type Hex} from "viem";
import {publicClient} from "./chain";
import {vaultAbi, PROOF_TX, DEPLOY_BLOCK, DEMO, getActiveContracts} from "./contracts";

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

export interface ActivityEntry {
  kind: "approved" | "blocked";
  agent: string;
  amount: bigint;
  reason?: string;
  txHash: Hex;
  logIndex: number;
}

export interface ActivityFeedResult {
  live: boolean;
  entries: ActivityEntry[];
}

const approvedTopic = encodeEventTopics({abi: [approvedEvent], eventName: "AgentActionApproved"})[0];
const blockedTopic = encodeEventTopics({abi: [blockedEvent], eventName: "AgentActionBlocked"})[0];

/** Honest fallback when the RPC log query fails or returns nothing. */
const SNAPSHOT_FEED: ActivityFeedResult = {
  live: false,
  entries: [
    {kind: "approved", agent: DEMO.agent, amount: 4_000_000n, txHash: PROOF_TX.approved as Hex, logIndex: 0},
    {
      kind: "blocked",
      agent: DEMO.agent,
      amount: 6_000_000n,
      reason: "exceeds maxPerTx",
      txHash: PROOF_TX.blocked as Hex,
      logIndex: 1,
    },
  ],
};

interface RawLog {
  blockNumber: Hex;
  logIndex: Hex;
  transactionHash: Hex;
  address: string;
  data: Hex;
  topics: [Hex, ...Hex[]];
}

/** Recent vault decisions via raw eth_getLogs (no viem formatter), newest first, capped at 4. */
export async function fetchRecentActivity(): Promise<ActivityFeedResult> {
  try {
    const logs = (await publicClient.request({
      method: "eth_getLogs",
      params: [
        {
          address: getActiveContracts().vault,
          fromBlock: toHex(DEPLOY_BLOCK),
          toBlock: "latest",
          topics: [[approvedTopic, blockedTopic]],
        },
      ],
    })) as RawLog[];
    const vault = getActiveContracts().vault.toLowerCase();
    const decoded: (ActivityEntry & {blockNumber: number})[] = [];
    for (const log of logs) {
      if (log.address.toLowerCase() !== vault) continue;
      try {
        const dec = decodeEventLog({abi: vaultAbi, data: log.data, topics: log.topics});
        if (dec.eventName !== "AgentActionApproved" && dec.eventName !== "AgentActionBlocked") continue;
        const args = dec.args as {agent: string; amount: bigint; reason?: string};
        decoded.push({
          kind: dec.eventName === "AgentActionApproved" ? "approved" : "blocked",
          agent: args.agent,
          amount: args.amount,
          reason: args.reason,
          txHash: log.transactionHash,
          logIndex: parseInt(log.logIndex, 16),
          blockNumber: parseInt(log.blockNumber, 16),
        });
      } catch {}
    }
    if (decoded.length === 0) return SNAPSHOT_FEED;
    decoded.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
    return {
      live: true,
      entries: decoded.slice(0, 4).map((e) => ({
        kind: e.kind,
        agent: e.agent,
        amount: e.amount,
        reason: e.reason,
        txHash: e.txHash,
        logIndex: e.logIndex,
      })),
    };
  } catch {
    return SNAPSHOT_FEED;
  }
}
