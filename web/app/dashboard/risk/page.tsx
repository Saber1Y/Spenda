"use client";

import {useEffect, useState} from "react";
import {useAccount, useSignMessage} from "wagmi";
import {getBase44Client} from "@/lib/base44";
import {useActiveVaultEntity} from "@/lib/base44-hooks";
import {Button} from "@/components/ui/Button";
import {Field, TextInput} from "@/components/ui/Input";
import {Panel} from "@/components/dashboard/Panel";

const defaults = {auto: "25000000", human: "50000000", medium: "30", high: "60", critical: "80", rwa: "15000", velocity: "3600"};

export default function RiskPage() {
  const vault = useActiveVaultEntity();
  const {address} = useAccount();
  const {signMessageAsync} = useSignMessage();
  const [values, setValues] = useState(defaults);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!vault?.id) return;
    getBase44Client().functions.invoke("getRiskPolicy", {vault_id: vault.id}).then((raw) => {
      const response = raw?.data ?? raw;
      const policy = response?.policy;
      if (policy) setValues({auto: policy.auto_approval_limit, human: policy.human_approval_limit, medium: String(policy.medium_threshold), high: String(policy.high_threshold), critical: String(policy.critical_threshold), rwa: String(policy.rwa_multiplier_bps), velocity: String(policy.velocity_window_seconds)});
    }).catch(() => undefined);
  }, [vault?.id]);
  const save = async () => {
    if (!vault?.id || !address) return setStatus("Connect the vault owner wallet first.");
    setStatus("Signing risk policy...");
    try {
      const message = JSON.stringify({vault_id: vault.id, auto_approval_limit: values.auto, human_approval_limit: values.human, medium_threshold: Number(values.medium), high_threshold: Number(values.high), critical_threshold: Number(values.critical), rwa_multiplier_bps: Number(values.rwa), velocity_window_seconds: Number(values.velocity)});
      const signature = await signMessageAsync({message});
      const raw = await getBase44Client().functions.invoke("updateRiskPolicy", {...JSON.parse(message), signer: address, signature});
      const response = raw?.data ?? raw;
      if (!response?.ok) throw new Error(response?.error ?? "Risk policy update failed");
      setStatus(`Saved ${response.policy.version}. New intents use this policy version.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({...current, [key]: value}));
  return <div className="max-w-[900px] px-8 py-8"><div><h1 className="font-heading text-heading text-aubergine" style={{fontWeight: 350}}>Risk policy</h1><p className="mt-1 text-[15px] text-fog">Deterministic approval thresholds for this vault.</p></div><div className="mt-8"><Panel title="Vault risk policy" subtitle="owner-signed and versioned"><div className="grid gap-4 sm:grid-cols-2"><Field label="Auto-approval limit (base units)"><TextInput value={values.auto} onChange={(event) => set("auto", event.target.value)} /></Field><Field label="Human approval limit (base units)"><TextInput value={values.human} onChange={(event) => set("human", event.target.value)} /></Field><Field label="Medium threshold"><TextInput value={values.medium} onChange={(event) => set("medium", event.target.value)} /></Field><Field label="High threshold"><TextInput value={values.high} onChange={(event) => set("high", event.target.value)} /></Field><Field label="Critical threshold"><TextInput value={values.critical} onChange={(event) => set("critical", event.target.value)} /></Field><Field label="RWA multiplier (basis points)"><TextInput value={values.rwa} onChange={(event) => set("rwa", event.target.value)} /></Field><Field label="Velocity window (seconds)"><TextInput value={values.velocity} onChange={(event) => set("velocity", event.target.value)} /></Field></div><Button className="mt-5" variant="primary" size="sm" onClick={save}>Save risk policy</Button>{status && <p className="mt-4 text-body-sm text-fog">{status}</p>}</Panel></div></div>;
}
