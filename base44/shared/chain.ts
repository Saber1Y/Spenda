import {createPublicClient, http} from "npm:viem";
import {RPC_URL, CHAIN_ID} from "./constants.ts";

const botChain = {
  id: CHAIN_ID,
  name: "BOT Chain Testnet",
  network: "bot-testnet",
  nativeCurrency: {name: "BOT", symbol: "BOT", decimals: 18},
  rpcUrls: {default: {http: [RPC_URL]}, public: {http: [RPC_URL]}},
  blockExplorers: {default: {name: "BOTScan", url: "https://scan.bohr.life"}},
} as const;

export const publicClient = createPublicClient({
  chain: botChain,
  transport: http(RPC_URL),
});

export function formatAmount(baseUnits: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = baseUnits / divisor;
  const frac = baseUnits % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}
