"use client";

import { useEffect, useState } from "react";
import { Section, Eyebrow } from "./Section";
import { Shield } from "@/components/ui/Icons";

const steps = [
  {
    n: "01",
    title: "Deploy and fund your vault",
    body: "Connect your wallet and become the vault owner. Deposit USDT once; the paymaster holds BOT separately so gas never routes through your agents.",
  },
  {
    n: "02",
    title: "Mint an agent account",
    body: "Each agent gets its own restricted account at a deterministic address. It holds no keys and no tokens, and can only ask the vault to spend.",
  },
  {
    n: "03",
    title: "Write its guardrails",
    body: "A per-transaction cap, daily cap, expiry date and exact vendor and token allowlists, all stored on-chain before the agent ever runs.",
  },
  {
    n: "04",
    title: "Let it work, keep the pen",
    body: "In-policy payments settle automatically. Anything out of policy is blocked with evidence, and sensitive requests wait in your approval queue bound to one action.",
  },
  {
    n: "05",
    title: "Scale to a fleet",
    body: "Run research, procurement or ops agents side by side. Budgets stay isolated per agent, and revoking one never touches the rest of the fleet.",
  },
];

const fleetAgents = [
  { name: "Procurement agent", detail: "Vendor payments · max 50 per tx · 250 per day" },
  { name: "Research agent", detail: "Data APIs · max 10 per tx · 50 per day" },
];

export function ProductFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((a) => (a + 1) % fleetAgents.length), 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <Section tone="bone" id="flow">
      <div className="max-w-[58ch]">
        <Eyebrow>The full flow</Eyebrow>
        <h2
          className="mt-4 font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]"
          style={{ fontWeight: 350 }}
        >
          From first vault to a fleet of agents.
        </h2>
        <p className="mt-5 text-body text-fog">
          Everything happens between your wallet and the chain. Here is the whole journey: creating an agent,
          giving it limits, letting it pay, and growing to many agents without widening your risk.
        </p>
      </div>

      <div className="marketing-reveal mt-12 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-10">
        <FleetPanel active={active} />
        <ol className="relative space-y-8">
          <span className="absolute bottom-3 left-[15px] top-3 w-px bg-ash" aria-hidden="true" />
          {steps.map((s) => (
            <li key={s.n} className="relative flex gap-5">
              <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ash bg-paper-white font-heading text-[13px] text-base-orange">
                {s.n}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="font-heading text-heading-sm text-obsidian" style={{ fontWeight: 400 }}>
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[56ch] text-body-sm text-fog">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function FleetPanel({ active }: { active: number }) {
  return (
    <div className="rounded-card border border-ash bg-paper-white p-6 sm:p-8 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption uppercase tracking-[0.08em] text-fog">One vault · every agent</span>
        <span className="inline-flex items-center gap-2 text-caption text-fog">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-mint-signal opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-signal" />
          </span>
          Owner custody
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-base-orange/40 bg-base-orange-light px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-orange text-paper-white">
          <Shield width={16} height={16} />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[17px] text-obsidian" style={{ fontWeight: 450 }}>
            USDT vault
          </p>
          <p className="text-caption text-fog">Single custody boundary · funded once</p>
        </div>
      </div>

      <div className="ml-4 mt-4 space-y-3 border-l border-dashed border-ash pl-6">
        {fleetAgents.map((a, i) => (
          <div key={a.name} data-state={i === active ? "active" : "idle"} className="fleet-agent relative rounded-2xl border p-4">
            <span
              className={`absolute top-6 h-2.5 w-2.5 rounded-full transition-colors duration-500 ${
                i === active ? "bg-base-orange" : "bg-ash"
              }`}
              style={{ left: "-31px" }}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="font-heading text-[15px] text-obsidian" style={{ fontWeight: 450 }}>
                {a.name}
              </span>
              <span className="rounded-pill border border-ash px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] text-fog">
                restricted
              </span>
            </div>
            <p className="mt-1.5 text-caption text-fog">{a.detail}</p>
          </div>
        ))}

        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ash p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bone font-heading text-[16px] text-fog" aria-hidden="true">
            +
          </span>
          <div className="min-w-0">
            <p className="text-body-sm text-obsidian">Mint another agent</p>
            <p className="text-caption text-fog">New address · fresh budget · same vault</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-ash pt-4 text-caption text-fog">
        <span>Revoking one agent freezes only its budget</span>
        <span>Approvals and receipts per agent</span>
      </div>
    </div>
  );
}
