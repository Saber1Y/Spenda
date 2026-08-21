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
    <Card tone="bone" pad="lg" className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-base-orange-light text-base-orange">
          {icon}
        </span>
        <span className="text-caption uppercase tracking-[0.08em] text-fog">{index}</span>
      </div>
      <div>
        <span className="text-caption uppercase tracking-[0.08em] text-base-orange">{kicker}</span>
        <h3 className="mt-1 font-heading text-heading-sm text-obsidian" style={{fontWeight: 350}}>
          {title}
        </h3>
      </div>
      <p className="text-body text-fog">{children}</p>
    </Card>
  );
}

export function TwoFences() {
  return (
    <Section tone="dark" id="security">
      <div className="max-w-[52ch]">
        <Eyebrow>Security model</Eyebrow>
        <h2 className="mt-4 font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
          Authorization fails closed at every layer.
        </h2>
        <p className="mt-5 text-body text-fog">
          The restricted account constrains what an agent can call. The vault independently decides whether value moves.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="marketing-reveal"><FenceCard index="Boundary 1" kicker="Restricted ERC-4337 account" title="It cannot call around the vault" icon={<Bolt />}>
          The account binds to one vault and one paymaster. It rejects direct owner execution, arbitrary targets,
          native value and every selector except the vault&rsquo;s spend request.
        </FenceCard></div>
        <div className="marketing-reveal"><FenceCard index="Boundary 2" kicker="USDT vault policy" title="Every payment is independently checked" icon={<Shield />}>
          The vault checks agent status, expiry, token and target allowlists, per-transaction cap, daily cap and action
          replay before transferring USDT. Blocked requests emit evidence and move nothing.
        </FenceCard></div>
      </div>
    </Section>
  );
}
