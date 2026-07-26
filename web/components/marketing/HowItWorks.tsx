import {Section, Eyebrow} from "./Section";

const steps = [
  {
    n: "01",
    title: "The agent holds nothing",
    body: "No BOT, no stablecoin, no gas. The agent is just a smart account whose key can sign - but a signature alone moves nothing and pays for nothing.",
  },
  {
    n: "02",
    title: "The sponsor pays - only for vault calls",
    body: "The agent submits a gasless UserOp. A sponsor policy signs it only if the call targets the vault. Anything off-scope gets no signature, no gas, no inclusion.",
  },
  {
    n: "03",
    title: "The vault enforces, then receipts",
    body: "Inside the vault, the spend is checked against caps, allowlists and dedup. Approved moves value and emits a receipt; blocked emits a record and moves nothing.",
  },
  {
    n: "04",
    title: "The control plane stays live",
    body: "Base44 backend functions read on-chain state and write it into queryable entities - vault balance, policy state, allowlists, transactions, and full audit logs - all synced to the dashboard in real time.",
  },
];

export function HowItWorks() {
  return (
    <Section tone="paper" id="how">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-4 max-w-[24ch] font-heading text-heading leading-tight text-paper-white sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
        Fund the vault. Fence the agent.
      </h2>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="flex flex-col gap-4 rounded-card border border-white/10 bg-white/5 p-6 sm:p-8">
            <span className="font-heading text-heading text-base-orange" style={{fontWeight: 350}}>
              {s.n}
            </span>
            <h3 className="font-heading text-heading-sm text-paper-white" style={{fontWeight: 350}}>
              {s.title}
            </h3>
            <p className="text-body-sm text-paper-white/60">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
