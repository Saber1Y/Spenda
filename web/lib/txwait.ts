import type {Hex} from "viem";
import {publicClient} from "./chain";

/**
 * Wait for a tx via RAW eth_getTransactionReceipt (no viem formatter) — sidesteps BOT's
 * non-standard receipt fields (feePayer/milliTimestamp). Confirmation of the write's EFFECT is the
 * caller's read-back of chain state; this only gates on inclusion + status.
 */
export async function waitForReceiptRaw(
  hash: Hex,
  {tries = 45, intervalMs = 2000}: {tries?: number; intervalMs?: number} = {},
): Promise<"success" | "reverted"> {
  for (let i = 0; i < tries; i++) {
    const r = (await publicClient.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as {status?: Hex} | null;
    if (r?.status === "0x1") return "success";
    if (r?.status === "0x0") return "reverted";
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error("Timed out waiting for the transaction to be mined");
}
