"use client";

import { useEffect, useState } from "react";

const steps = [
  { n: "01", title: "AI agent", detail: "Wants to pay a vendor", meta: "Holds zero funds" },
  { n: "02", title: "SpendIntent", detail: "Amount · target · expiry", meta: "Single-use request" },
  { n: "03", title: "Policy engine", detail: "Caps · allowlists · risk", meta: "Approve or block" },
  { n: "04", title: "USDT vault", detail: "Executes · emits receipt", meta: "You keep custody" },
];

const narrations = [
  "The agent asks for a payment it cannot execute itself.",
  "The intent binds one amount, one target and one expiry.",
  "Policy checks caps, allowlists and risk before anything moves.",
  "The vault transfers USDT and issues a public receipt.",
];

export function ArchitectureDiagram() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((a) => (a + 1) % steps.length), 2400);
    return () => clearInterval(timer);
  }, []);

  const stateOf = (i: number) => (i === active ? "active" : i < active ? "done" : "idle");

  return (
    <div
      className="rounded-card border border-white/10 bg-white/[0.04] p-5 shadow-[0_32px_90px_rgba(0,0,0,0.4)] sm:p-7"
      aria-label="How a Spenda payment flows"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-paper-white/60">
          How a Spenda payment flows
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-paper-white/80">
          Live policy
        </span>
      </div>

      <ol className="mt-6 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-0">
        {steps.map((s, i) => (
          <li key={s.n} className="contents">
            <div data-state={stateOf(i)} className="diagram-step rounded-2xl border p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span
                  className={`font-heading text-[13px] ${
                    stateOf(i) === "idle" ? "text-paper-white/50" : "text-base-orange"
                  } ${stateOf(i) === "done" ? "opacity-60" : ""}`}
                >
                  {s.n}
                </span>
                {stateOf(i) === "done" ? (
                  <Check />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-paper-white/20" />
                )}
              </div>
              <h3 className="mt-3 font-heading text-[17px] text-paper-white" style={{ fontWeight: 450 }}>
                {s.title}
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-paper-white/75">{s.detail}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-paper-white/50">{s.meta}</p>
            </div>
            {i < steps.length - 1 && <Connector on={active > i} />}
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-obsidian/80 px-4 py-3.5">
        <p key={active} className="narration-enter text-[13px] leading-snug text-paper-white/85 sm:text-body-sm">
          {narrations[active]}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-white/10 pt-4 text-[12px] text-paper-white/70">
        <span>Agents hold zero keys and zero tokens</span>
        <span>Every decision lands on-chain as evidence</span>
      </div>
    </div>
  );
}

function Connector({ on }: { on: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 lg:px-2 lg:py-0" aria-hidden="true">
      <span
        className={`rotate-90 text-lg leading-none transition-colors duration-500 lg:rotate-0 ${
          on ? "text-base-orange" : "text-paper-white/25"
        }`}
      >
        →
      </span>
    </div>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke="#fe6a00"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
