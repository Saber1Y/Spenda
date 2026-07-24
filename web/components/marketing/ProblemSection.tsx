import {Section, Eyebrow} from "./Section";

export function ProblemSection() {
  return (
    <Section tone="bone">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>The problem</Eyebrow>
          <h2
            className="mt-4 font-heading text-heading leading-tight text-aubergine sm:text-heading-lg sm:leading-[1.1]"
            style={{fontWeight: 350}}
          >
            One bad loop and the wallet is empty.
          </h2>
        </div>
        <div className="space-y-5 text-body text-obsidian/80">
          <p>
            Autonomous agents need to move money to act — pay a vendor, settle a task, swap on a DEX. Hand one an
            unrestricted key and a single prompt injection, hallucinated action, or runaway loop can drain it.
          </p>
          <p>
            Humans need <span className="text-aubergine">caps, allowlists, dedup and receipts</span> — enforced
            on-chain, not by app-layer goodwill. Spenda gives the agent a wallet that holds nothing and can only
            ever move value inside policy.
          </p>
        </div>
      </div>
    </Section>
  );
}
