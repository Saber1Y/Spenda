import {defineChain, createPublicClient, http} from "viem";

/**
 * BOT Chain testnet 968. viem tolerates BOT's non-standard block/receipt fields
 * (feePayer / milliTimestamp) — extra keys are ignored, required keys are present — so no custom
 * formatter is needed for the reads this app makes (readContract / getLogs / getBalance / getCode).
 * For raw tx-receipt/block data (LiveProof) we still use `publicClient.request()` + manual decode
 * to fully sidestep any formatter, and owner-write confirmations use chain-state READ-BACK rather
 * than a formatted `waitForTransactionReceipt` — the proven backend pattern.
 */
export const botChain = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: {name: "BOT", symbol: "BOT", decimals: 18},
  rpcUrls: {default: {http: ["https://rpc.bohr.life"]}},
  blockExplorers: {default: {name: "BOTScan", url: "https://scan.bohr.life"}},
  testnet: true,
});

export const publicClient = createPublicClient({chain: botChain, transport: http()});

export const explorerTx = (hash: string) => `https://scan.bohr.life/tx/${hash}`;
export const explorerAddress = (addr: string) => `https://scan.bohr.life/address/${addr}`;
