import {Section, Eyebrow} from "./Section";

export function ProblemSection() {
  return (
    <Section tone="bone">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>The problem</Eyebrow>
          <h2
            className="mt-4 font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]"
            style={{fontWeight: 350}}
          >
            Autonomy without custody controls is a drain path.
          </h2>
        </div>
        <div className="space-y-5 text-body text-fog">
          <p>
            Autonomous agents need to pay vendors, buy compute and settle services. An unrestricted wallet turns one
            prompt injection, hallucinated action or runaway loop into direct access to user funds.
          </p>
          <p>
            Spenda keeps USDT in an owner-controlled vault. Restricted agent accounts hold nothing and can request only
            the vault&rsquo;s spend function, where caps, allowlists, expiry and replay protection execute on-chain.
          </p>
        </div>
      </div>
    </Section>
  );
}
