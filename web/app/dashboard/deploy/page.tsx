"use client";

import {useState} from "react";
import {useAccount, useWalletClient, usePublicClient} from "wagmi";
import {parseUnits, type Address} from "viem";
import {Panel, PanelNote} from "@/components/dashboard/Panel";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Chip} from "@/components/ui/Chip";
import {Dot, ArrowUpRight} from "@/components/ui/Icons";
import {CONTRACTS, DEMO, MUSD_DECIMALS} from "@/lib/contracts";
import {deployFullStack, type DeployResult} from "@/lib/deployVault";
import {saveActiveVault} from "@/lib/activeVault";
import {useRouter} from "next/navigation";

type Phase = "idle" | "deploying" | "done" | "error";

export default function DeployPage() {
  const router = useRouter();
  const {address, isConnected} = useAccount();
  const {data: walletClient} = useWalletClient();
  const publicClient = usePublicClient();

  const [vendor, setVendor] = useState<string>(DEMO.vendor);
  const [maxPerTx, setMaxPerTx] = useState("5");
  const [dailyCap, setDailyCap] = useState("20");
  const [expiryDays, setExpiryDays] = useState("30");
  const [fundAmount, setFundAmount] = useState("1000");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState("");

  const deploy = async () => {
    if (!walletClient || !publicClient || !address) {
      setError("Wallet client not ready. Make sure MetaMask is connected and on BOT Chain mainnet.");
      setPhase("error");
      return;
    }
    setPhase("deploying");
    setError(null);
    try {
      const res = await deployFullStack(walletClient, publicClient, {
        ownerAddress: address,
        vendorAddress: vendor as Address,
        maxPerTx: parseUnits(maxPerTx, MUSD_DECIMALS),
        dailyCap: parseUnits(dailyCap, MUSD_DECIMALS),
        expiryDays: Number(expiryDays),
        fundAmount: parseUnits(fundAmount, MUSD_DECIMALS),
      });
      saveActiveVault({
        vaultAddress: res.vaultAddress,
        paymasterAddress: res.paymasterAddress,
        agentAddress: res.agentAddress,
        agentOwnerEOA: address,
        vendorAddress: vendor as Address,
        mockUSDAddress: CONTRACTS.mockUSD,
        deployBlock: 0n,
      });
      setResult(res);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-paper-white pb-24">
        <div className="mx-auto max-w-[600px] px-6 pt-10">
          <Panel title="Deploy a vault" subtitle="connect your wallet first">
            <PanelNote>Connect your MetaMask wallet to BOT Chain mainnet 677 to deploy a vault you own.</PanelNote>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-white pb-24">
      <div className="mx-auto max-w-[600px] px-6 pt-10">
        <Panel
          title="Deploy a vault"
          subtitle="full stack - vault + paymaster + agent + policy + allowlists"
        >
          {phase === "done" && result ? (
            <div className="flex flex-col gap-4">
              <Chip tone="mint">
                <Dot width={10} height={10} className="text-mint-signal" />
                Deployed successfully
              </Chip>
              <div className="space-y-2 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-fog">Vault</span>
                  <span className="font-mono text-aubergine">{result.vaultAddress.slice(0, 10)}...{result.vaultAddress.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fog">Paymaster</span>
                  <span className="font-mono text-aubergine">{result.paymasterAddress.slice(0, 10)}...{result.paymasterAddress.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fog">Agent</span>
                  <span className="font-mono text-aubergine">{result.agentAddress.slice(0, 10)}...{result.agentAddress.slice(-6)}</span>
                </div>
              </div>
              <p className="text-body-sm text-fog">
                {result.txHashes.length} transactions submitted. Your vault is ready.
              </p>
              <Button variant="primary" size="md" onClick={() => router.push("/dashboard")}>
                Go to dashboard
                <ArrowUpRight width={16} height={16} />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-body-sm text-fog">
                This deploys a new BOTSpendVault with your wallet as owner, a paymaster bound to it,
                creates an agent account, sets policy + allowlists, funds the vault with mockUSD, and
                tops up the paymaster deposit. 9 transactions total.
              </p>

              <Field label="Vendor address (allowlisted target)">
                <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="0x..." />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Max per tx (mUSD)">
                  <TextInput value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} type="number" />
                </Field>
                <Field label="Daily cap (mUSD)">
                  <TextInput value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} type="number" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry (days)">
                  <TextInput value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} type="number" />
                </Field>
                <Field label="Fund vault (mUSD)">
                  <TextInput value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} type="number" />
                </Field>
              </div>

              {error && <PanelNote tone="error">{error}</PanelNote>}

              <Button
                variant="primary"
                size="md"
                onClick={deploy}
                disabled={phase === "deploying" || !walletClient}
              >
                {!walletClient ? "Connecting wallet..." : phase === "deploying" ? "Deploying..." : "Deploy vault"}
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
