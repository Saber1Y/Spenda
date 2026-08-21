import { Section, Eyebrow } from "./Section";

const rawWallet = [
  "The agent holds the private key",
  "No spend cap, no expiry, no allowlist",
  "One prompt injection can drain the full balance",
  "Funds leave before a human can react",
];

const spendaVault = [
  "The agent holds nothing and signs nothing",
  "Per-tx cap, daily cap and expiry enforced on-chain",
  "Blocked requests emit evidence and move zero funds",
  "Every decision becomes a public receipt",
];

export function ProblemSection() {
  return (
    <Section tone="bone">
      <div className="max-w-[58ch]">
        <Eyebrow>The problem</Eyebrow>
        <h2
          className="mt-4 font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]"
          style={{ fontWeight: 350 }}
        >
          Hand an agent your wallet and one mistake can drain everything.
        </h2>
        <p className="mt-5 text-body text-fog">
          Prompt injection, a hallucinated action or a runaway loop: an unrestricted agent key exposes the entire
          balance, instantly and irreversibly.
        </p>
      </div>

      <div className="marketing-reveal mt-12 grid gap-6 lg:grid-cols-2">
        <CompareCard tone="risk" title="Today: a raw agent wallet" items={rawWallet} />
        <CompareCard tone="safe" title="With Spenda: a policy vault" items={spendaVault} />
      </div>

      <div className="marketing-reveal mt-6 grid gap-px overflow-hidden rounded-card border border-ash bg-ash sm:grid-cols-2">
        <Stat
          value="100%"
          tone="risk"
          label="of the wallet balance is exposed the moment one raw agent key leaks"
        />
        <Stat
          value="$0"
          tone="safe"
          label="held by a Spenda agent. Caps, custody and every decision stay with the vault"
        />
      </div>
    </Section>
  );
}

function CompareCard({
  tone,
  title,
  items,
}: {
  tone: "risk" | "safe";
  title: string;
  items: string[];
}) {
  const risk = tone === "risk";
  return (
    <div
      className={`flex flex-col gap-5 rounded-card border bg-paper-white p-6 sm:p-8 ${
        risk ? "border-blush-mist" : "border-ash"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold ${
            risk ? "bg-blush-mist text-obsidian" : "bg-mint-signal text-paper-white"
          }`}
          aria-hidden="true"
        >
          {risk ? "✕" : "✓"}
        </span>
        <h3 className="font-heading text-heading-sm text-obsidian" style={{ fontWeight: 400 }}>
          {title}
        </h3>
      </div>
      <ul className="space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-body text-fog">
            <span
              className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${
                risk ? "bg-blush-mist" : "bg-mint-signal"
              }`}
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: "risk" | "safe" }) {
  return (
    <div className="bg-paper-white p-6 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2 w-2 rounded-full ${tone === "risk" ? "bg-blush-mist" : "bg-mint-signal"}`}
          aria-hidden="true"
        />
        <span
          className="font-heading text-[34px] leading-none text-obsidian sm:text-[40px]"
          style={{ fontWeight: 380 }}
        >
          {value}
        </span>
      </div>
      <p className="mt-3 max-w-[44ch] text-body-sm text-fog">{label}</p>
    </div>
  );
}
