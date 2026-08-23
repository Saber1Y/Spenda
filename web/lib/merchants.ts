/**
 * Spenda Commerce sandbox catalog.
 * Merchant fulfillment is SIMULATED; payment authorization is real on BOT Chain.
 * Every sandbox purchase pays the canonical allowlisted vendor so it works with
 * any provisioned agent without extra allowlist writes.
 *
 * Pricing is tuned to the self-serve provisioning ceilings (max 10 USDT/tx,
 * 25 USDT/day) so a freshly created agent with default caps (5/10) can reach
 * every decision path: auto-approval, human escalation (RWA invoice), and a
 * fence block (over-cap bundle).
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
  {merchantId: "domain-renewal", name: "Domain renewal", category: "saas", description: "Keep a production domain registered", priceBaseUnits: "4500000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "spotify-premium", name: "Spotify Premium renewal", category: "saas", description: "Renew a music subscription under the agent's budget", priceBaseUnits: "4990000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "ai-api-credits", name: "AI API credits", category: "ai", description: "Top up inference credits before service interruption", priceBaseUnits: "4000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "gpu-compute", name: "GPU compute", category: "compute", description: "Purchase a short training reservation at market rate", priceBaseUnits: "3750000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "cloud-hosting", name: "Cloud hosting top-up", category: "marketplace", description: "Prevent service interruption on a running deployment", priceBaseUnits: "4500000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "market-data-agent", name: "Market data agent", category: "agent", description: "Pay another agent for research data (agent-to-agent)", priceBaseUnits: "5000000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "tokenized-invoice", name: "Tokenized invoice (RWA)", category: "rwa", description: "Real-world-asset exposure - always escalated to a human", priceBaseUnits: "4950000", paymentAddress: SANDBOX_VENDOR},
  {merchantId: "rwa-bundle", name: "Enterprise RWA bundle", category: "rwa", description: "Deliberately exceeds typical per-tx caps to show the fence blocking", priceBaseUnits: "24000000", paymentAddress: SANDBOX_VENDOR},
];

export const findMerchant = (id: string): Merchant | undefined => MERCHANTS.find((m) => m.merchantId === id);
