import {createPublicClient, http, decodeEventLog, getAbiItem, rpcSchema, type Hex} from "viem";
import {vaultAbi, getActiveContracts} from "./contracts";
import type {BundlerRpcSchema, UserOpReceiptRaw} from "./bundlerSchema";

const BUNDLER = "https://bundler.bohr.life/rpc";
const bundler = createPublicClient({transport: http(BUNDLER), rpcSchema: rpcSchema<BundlerRpcSchema>()});

const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

export interface RunOutcome {
  kind: "approved" | "blocked";
  reason?: string;
  amount: bigint;
  txHash?: Hex;
}

/** Bounded poll of the public bundler — a poll failure is a READ failure, never a re-submit. */
export async function pollUserOpReceipt(
  userOpHash: Hex,
  {tries = 40, intervalMs = 3000}: {tries?: number; intervalMs?: number} = {},
): Promise<UserOpReceiptRaw> {
  for (let i = 0; i < tries; i++) {
    const r = await bundler.request({method: "eth_getUserOperationReceipt", params: [userOpHash]});
    if (r) return r;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return null;
}

/** Resolve the ACTUAL on-chain outcome from the vault event — never from the requested amount. */
export function resolveOutcome(receipt: UserOpReceiptRaw): RunOutcome | null {
  if (!receipt) return null;
  const txHash = receipt.receipt?.transactionHash;
  const logs = [...(receipt.logs ?? []), ...(receipt.receipt?.logs ?? [])];
  for (const log of logs) {
    if (log.address?.toLowerCase() !== getActiveContracts().vault.toLowerCase()) continue;
    for (const evt of [approvedEvent, blockedEvent]) {
      try {
        const dec = decodeEventLog({abi: [evt], data: log.data, topics: log.topics});
        if (dec.eventName === evt.name) {
          const args = dec.args as {amount: bigint; reason?: string};
          return {kind: evt.name === "AgentActionApproved" ? "approved" : "blocked", reason: args.reason, amount: args.amount, txHash};
        }
      } catch {
        /* not this event */
      }
    }
  }
  return null;
}
