/**
 * Spenda Commerce sandbox catalog.
 * Merchant fulfillment is SIMULATED; payment authorization is real on BOT Chain.
 * Every sandbox purchase pays the canonical allowlisted vendor so it works with
 * any provisioned agent without extra allowlist writes.
 */
import {DEMO} from "@/lib/contracts";

export interface Merchant {
  merchantId: string;
  name: string;
  category: "saas" | "ai" | "compute" | "agent" | "rwa" | "marketplace";
  description: string;
  priceBaseUnits: string;
  paymentAddress: string;
}

const SANDBOX_VENDOR = DEMO.vendor;

export const MERCHANTS: Merchant[] = [
  {merchantId: "spotify-premium", name: "Spotify Premium renewal", category: "saas", description: "Renew a music subscription under the agent's budget", priceBaseUnits: "11990000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "ai-api-credits", name: "AI API credits", category: "ai", description: "Top up inference credits before service interruption", priceBaseUnits: "20000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "gpu-compute", name: "GPU compute", category: "compute", description: "Purchase a short training reservation at market rate", priceBaseUnits: "12000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "domain-renewal", name: "Domain renewal", category: "saas", description: "Keep a production domain registered", priceBaseUnits: "12000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "cloud-hosting", name: "Cloud hosting top-up", category: "compute", description: "Prevent service interruption on a running deployment", priceBaseUnits: "25000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "market-data-agent", name: "Market data agent", category: "agent", description: "Pay another agent for research data (agent-to-agent)", priceBaseUnits: "5000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "tokenized-invoice", name: "Tokenized invoice (RWA)", category: "rwa", description: "Purchase a real-world-asset category sandbox asset", priceBaseUnits: "100000000", paymentAddress: SANDBOX_VENDOR},
];

export const findMerchant = (id: string): Merchant | undefined => MERCHANTS.find((m) => m.merchantId === id);
