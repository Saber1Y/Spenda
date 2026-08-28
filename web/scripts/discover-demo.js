#!/usr/bin/env node
/**
 * Spenda Agent Discovery Demo
 *
 * This simulates a real AI agent discovering a spending need and posting it
 * to Spenda's webhook. In production, this would be:
 * - An email parser detecting "Your Spotify subscription renews tomorrow"
 * - A calendar integration noticing "AWS bill due Sept 5"
 * - An API monitor seeing "OpenAI credits below threshold"
 *
 * Usage: node scripts/discover-demo.js
 */

const PROD_URL = "https://spenda-delta.vercel.app";
const DEMO_AGENT = "0x055b36a6db61cbadf1832fe946be0cfe19b33b59";
const VENDOR = "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84";

const scenarios = [
  {
    label: "Spotify Premium renewal",
    category: "saas",
    amount: "4990000", // $4.99
    source: "email",
    reason: "Spotify emailed: Your Premium subscription renews on Sept 3 for $4.99",
  },
  {
    label: "OpenAI API credits top-up",
    category: "ai",
    amount: "4000000", // $4.00
    source: "api",
    reason: "API monitor: OpenAI credits below $5 threshold. Auto-top-up required.",
  },
  {
    label: "GPU compute reservation",
    category: "compute",
    amount: "3750000", // $3.75
    source: "calendar",
    reason: "Calendar event: Training job scheduled for tomorrow. Reserve GPU now.",
  },
  {
    label: "Domain renewal",
    category: "saas",
    amount: "4500000", // $4.50
    source: "email",
    reason: "Namecheap emailed: Domain spenda.ai expires in 7 days. Renew now.",
  },
];

async function discover(scenario) {
  const res = await fetch(`${PROD_URL}/api/discover`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      agent: DEMO_AGENT,
      vendor: VENDOR,
      amount: scenario.amount,
      label: scenario.label,
      category: scenario.category,
      source: scenario.source,
      reason: scenario.reason,
    }),
  });

  const data = await res.json();
  if (data.error) {
    console.log(`❌ ${scenario.label}: ${data.error}`);
    return;
  }

  const intent = data.intent;
  const status = intent.decision === "approved" ? "✅ AUTO-APPROVED" : intent.decision === "human_approval" ? "⏳ NEEDS APPROVAL" : "🚫 BLOCKED";
  console.log(`${status} | ${scenario.label} ($${(Number(scenario.amount)/1e6).toFixed(2)}) from ${scenario.source}`);
  console.log(`   Reason: ${scenario.reason}`);
  console.log(`   Risk: ${intent.riskScore}/100 (${intent.riskLevel})`);
  console.log("");
}

async function main() {
  console.log("🤖 Spenda Agent Discovery Demo");
  console.log("Simulating real AI agents discovering spending needs...\n");

  for (const scenario of scenarios) {
    await discover(scenario);
  }

  console.log("📋 Fetching discovered tasks...");
  const listRes = await fetch(`${PROD_URL}/api/discover`);
  const list = await listRes.json();
  console.log(`Found ${list.items?.length ?? 0} pending tasks\n`);

  if (list.items?.length) {
    console.log("Auto-approved tasks (ready to pay):");
    list.items.filter(i => i.decision === "approved").forEach(i => {
      console.log(`  • ${i.label} - $${(Number(i.amount)/1e6).toFixed(2)} (from ${i.source})`);
    });

    console.log("\nTasks needing human approval:");
    list.items.filter(i => i.decision === "human_approval").forEach(i => {
      console.log(`  • ${i.label} - $${(Number(i.amount)/1e6).toFixed(2)} (risk ${i.riskScore}/100)`);
    });
  }
}

main().catch(console.error);
