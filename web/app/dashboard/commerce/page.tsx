"use client";

import {useEffect, useState} from "react";
import {getActiveContracts} from "@/lib/contracts";
import {useActiveVaultEntity} from "@/lib/base44-hooks";
import {getBase44Client} from "@/lib/base44";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Panel} from "@/components/dashboard/Panel";
import {executeIntent} from "@/lib/intent-execution";

const DEMO_MERCHANTS = [
  {merchant_id: "spotify-premium", display_name: "Spotify Premium renewal", category: "saas", description: "Renew a subscription under the agent's budget", price: "11990000"},
  {merchant_id: "ai-api-credits", display_name: "AI API credits", category: "ai", description: "Top up API credits before service interruption", price: "20000000"},
  {merchant_id: "gpu-compute", display_name: "GPU compute", category: "compute", description: "Purchase a short compute reservation", price: "12000000"},
  {merchant_id: "market-data-agent", display_name: "Market data agent", category: "agent", description: "Pay a registered agent for research data", price: "5000000"},
  {merchant_id: "tokenized-invoice", display_name: "Tokenized invoice", category: "rwa", description: "Purchase an RWA-category sandbox asset", price: "100000000"},
];

export default function CommercePage() {
  const active = getActiveContracts();
  const vault = useActiveVaultEntity();
  const [merchants, setMerchants] = useState<Record<string, any>[]>(DEMO_MERCHANTS);
  const [agents, setAgents] = useState<Record<string, any>[]>([]);
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!vault?.id) return;
    const load = async () => {
      const client = getBase44Client();
      const [merchantResult, agentResult] = await Promise.all([
        client.functions.invoke("listMerchants", {vault_id: vault.id}),
        client.functions.invoke("listAgents", {vault_id: vault.id}),
      ]);
      const merchantData = merchantResult?.data ?? merchantResult;
      const agentData = agentResult?.data ?? agentResult;
      if (merchantData?.ok && merchantData.data.length > 0) setMerchants(merchantData.data);
      if (agentData?.ok && agentData.data.length > 0) {
        const activeAgents = agentData.data.filter((agent: Record<string, any>) => agent.status === "active");
        setAgents(activeAgents);
        setAgentId((current) => current || activeAgents[0]?.id || "");
      }
    };
    void load();
  }, [vault?.id]);

  const requestPurchase = async (merchant: Record<string, any>) => {
    if (!vault?.id) return setStatus("Sync the active vault before creating an intent.");
    setStatus(`Creating ${merchant.display_name} intent...`);
    try {
      const client = getBase44Client();
      const result = await client.functions.invoke("createSpendIntent", {
        vault_id: vault.id,
        agent_id: agentId,
        intent_type: merchant.category === "agent" ? "agent_payment" : merchant.category === "rwa" ? "rwa_purchase" : "purchase",
        description: merchant.description,
        token: active.mockUSD,
        amount: merchant.price,
        recipient: merchant.payment_address ?? active.vendor,
        category: merchant.category,
        ...(merchant.payment_address ? {merchant_id: merchant.merchant_id} : {}),
        metadata: {sandbox: true, fulfillment: "simulated"},
        expires_at: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
      });
      const response = result?.data ?? result;
      if (!response?.ok) throw new Error(response?.error ?? "Intent failed");
      if (response.decision === "approved") {
        setStatus(`Approved: ${response.decision_reason}. Submitting restricted UserOperation...`);
        const execution = await executeIntent(response.intent.id);
        setStatus(`${execution.outcome.kind}: ${execution.outcome.reason ?? "vault executed the payment"}`);
      } else {
        setStatus(`${response.decision}: ${response.decision_reason}. No funds moved.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  return <div className="max-w-[1100px] px-8 py-8"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Spenda Commerce</h1><p className="mt-1 text-[15px] text-fog">Real BOT Chain payment authorization with simulated merchant fulfillment.</p></div><div className="mt-5 flex flex-wrap items-center gap-3"><Chip tone="outline">Merchant Sandbox</Chip><label className="flex items-center gap-2 text-body-sm text-fog">Paying agent<select className="rounded-[10px] border border-ash bg-bone px-3 py-2 text-obsidian" value={agentId} onChange={(event) => setAgentId(event.target.value)}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name ?? agent.address}</option>)}</select></label></div>{status && <p className="mt-4 rounded-[12px] border border-ash bg-bone px-4 py-3 text-body-sm text-fog">{status}</p>}{agents.length === 0 && <p className="mt-4 rounded-[12px] border border-blush-mist bg-blush-mist/20 px-4 py-3 text-body-sm text-aubergine">Register an active restricted agent before creating a commerce intent.</p>}<div className="mt-8 grid gap-4 md:grid-cols-2">{merchants.map((merchant) => <Panel key={merchant.merchant_id} title={merchant.display_name} subtitle={merchant.category}><p className="text-body-sm text-fog">{merchant.description}</p><div className="mt-4 flex items-center justify-between"><span className="text-[15px] tabular-nums text-aubergine">{(Number(merchant.price ?? "0") / 1_000_000).toFixed(2)} USDT</span><Button variant="primary" size="sm" onClick={() => requestPurchase(merchant)} disabled={!agentId}>Create intent</Button></div></Panel>)}</div></div>;
}
