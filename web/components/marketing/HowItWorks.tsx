import {Section, Eyebrow} from "./Section";

const steps = [
  {
    n: "01",
    title: "Agent expresses intent",
    body: "Purchase compute, renew a service, pay another agent or request an RWA transaction with a fixed amount and expiry.",
  },
  {
    n: "02",
    title: "Spenda decides",
    body: "Independent budget, allowlists and deterministic risk produce approved, blocked or requires-approval outcomes.",
  },
  {
    n: "03",
    title: "Human signs when needed",
    body: "High-risk requests bind the owner signature to one agent, token, recipient, amount, nonce and expiry. No blanket permission.",
  },
  {
    n: "04",
    title: "Vault executes and receipts",
    body: "The restricted UserOperation reaches the vault. USDT moves only if on-chain policy passes, then chain events produce the receipt.",
  },
];

export function HowItWorks() {
  return (
    <Section tone="paper" id="how">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-4 max-w-[24ch] font-heading text-heading leading-tight text-paper-white sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
        From economic intent to verifiable receipt.
      </h2>

      <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="flex flex-col gap-4 bg-obsidian p-6 sm:p-7">
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
