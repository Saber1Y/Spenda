import {Section, Eyebrow} from "./Section";
import {Card} from "@/components/ui/Card";
import {Bolt, Shield} from "@/components/ui/Icons";
import type {ReactNode} from "react";

function FenceCard({
  index,
  icon,
  title,
  kicker,
  children,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <Card tone="paper" pad="lg" className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-ghost-lavender text-aubergine">
          {icon}
        </span>
        <span className="text-caption uppercase tracking-[0.08em] text-fog">{index}</span>
      </div>
      <div>
        <span className="text-caption uppercase tracking-[0.08em] text-periwinkle">{kicker}</span>
        <h3 className="mt-1 font-heading text-heading-sm text-aubergine" style={{fontWeight: 350}}>
          {title}
        </h3>
      </div>
      <p className="text-body text-obsidian/75">{children}</p>
    </Card>
  );
}

export function TwoFences() {
  return (
    <Section tone="dark" id="fences">
      <div className="max-w-[52ch]">
        <Eyebrow onDark>The architecture</Eyebrow>
        <h2 className="mt-4 font-heading text-heading leading-tight sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
          Two independent fences.
        </h2>
        <p className="mt-5 text-body text-paper-white/70">
          Neither substitutes the other. One stops off-policy actions from ever broadcasting; the other polices
          every spend that does.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <FenceCard index="Fence 1" kicker="Gas layer · BOT Chain native" title="It can&rsquo;t even broadcast" icon={<Bolt />}>
          The agent&rsquo;s account holds zero BOT. Every action is a sponsored UserOp, and the paymaster&rsquo;s
          off-chain signer only signs calls into the vault. An off-policy action is never sponsored — with no gas,
          it never enters a bundle.
        </FenceCard>
        <FenceCard index="Fence 2" kicker="Contract layer · the vault" title="It only moves inside policy" icon={<Shield />}>
          For any call that does get sponsored, the vault checks the full policy — active, not expired, token
          allowed, target allowed, per-tx cap, daily cap, dedup — before moving a cent. Blocked actions emit an
          on-chain record and move nothing.
        </FenceCard>
      </div>
    </Section>
  );
}
