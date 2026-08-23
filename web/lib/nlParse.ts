/**
 * Tiny deterministic natural-language parser for the Commerce bar.
 * Turns "renew my spotify" or "buy gpu credits for $4" into an intent request.
 * No LLM - same words always produce the same intent, so demos are repeatable.
 */
import {MERCHANTS} from "@/lib/merchants";

export interface ParsedCommand {
  /** Matched catalog item - use merchantId flow. */
  merchantId?: string;
  /** Custom amount flow - requires vendor at the call site. */
  amountBaseUnits?: string;
  category?: string;
  label?: string;
}

const KEYWORDS: Record<string, string[]> = {
  "domain-renewal": ["domain", "dns", "registrar"],
  "spotify-premium": ["spotify", "music", "premium"],
  "ai-api-credits": ["ai", "api", "credits", "inference", "llm", "gpt", "tokens"],
  "gpu-compute": ["gpu", "compute", "training", "cuda", "render"],
  "cloud-hosting": ["cloud", "hosting", "server", "vps", "deploy", "uptime"],
  "market-data-agent": ["market data", "market-data", "data agent", "research data", "agent-to-agent", "another agent", "oracle"],
  "tokenized-invoice": ["invoice", "rwa", "tokenized", "real world"],
  "rwa-bundle": ["bundle", "enterprise"],
};

/** Extract the first explicit money amount: "$12", "12 usdt", "3.5 usd", or a bare number. */
function extractAmountUsdt(text: string): number | null {
  const patterns = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/,
    /\b(\d+(?:[.,]\d{1,2})?)\s*(?:usdt|usd|dollars?)\b/,
    /\b(\d+(?:[.,]\d{1,2})?)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export function parseSpendCommand(rawText: string): ParsedCommand | null {
  const text = rawText.toLowerCase().trim();
  if (!text) return null;

  let bestId: string | undefined;
  let bestScore = 0;
  for (const [merchantId, keywords] of Object.entries(KEYWORDS)) {
    const score = keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = merchantId;
    }
  }

  const amount = extractAmountUsdt(text);

  // Merchant named with no explicit (or a matching) amount -> catalog price.
  if (bestId && (!amount || Math.abs(amount - Number(MERCHANTS.find((m) => m.merchantId === bestId)!.priceBaseUnits) / 1e6) < 0.01)) {
    return {merchantId: bestId};
  }

  // Otherwise treat it as a custom purchase; carry category from the matched
  // merchant when there is one so scoring stays sensible.
  if (amount) {
    const merchant = bestId ? MERCHANTS.find((m) => m.merchantId === bestId) : undefined;
    const label = rawText.trim().replace(/\s+/g, " ").slice(0, 60);
    return {
      amountBaseUnits: BigInt(Math.round(amount * 1_000_000)).toString(),
      category: merchant?.category ?? "marketplace",
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  }

  return null;
}
