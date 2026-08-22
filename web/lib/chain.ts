import {defineChain, createPublicClient, http} from "viem";

/**
 * BOT Chain mainnet 677. viem tolerates BOT's non-standard block/receipt fields
 * (feePayer / milliTimestamp) — extra keys are ignored, required keys are present — so no custom
 * formatter is needed for the reads this app makes (readContract / getLogs / getBalance / getCode).
 * For raw tx-receipt/block data (LiveProof) we still use `publicClient.request()` + manual decode
 * to fully sidestep any formatter, and owner-write confirmations use chain-state READ-BACK rather
 * than a formatted `waitForTransactionReceipt` — the proven backend pattern.
 */
export const botChain = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: {name: "BOT", symbol: "BOT", decimals: 18},
  rpcUrls: {default: {http: ["https://rpc.botchain.ai"]}},
  blockExplorers: {default: {name: "BOTScan", url: "https://scan.botchain.ai"}},
});

export const publicClient = createPublicClient({chain: botChain, transport: http()});

export const explorerTx = (hash: string) => `https://scan.botchain.ai/tx/${hash}`;
export const explorerAddress = (addr: string) => `https://scan.botchain.ai/address/${addr}`;
