import { LinkButton } from "@/components/ui/Button";
import { ArrowUpRight } from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-obsidian px-6">
      <div className="mx-auto max-w-[1200px] pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-caption text-paper-white/70">
          <span className="h-2 w-2 rounded-full bg-base-orange" />
          Mainnet-ready architecture · USDT spending · BOT gas
        </div>
        <h1
          className="mx-auto max-w-[17ch] text-balance font-heading text-[44px] leading-[1.05] text-paper-white sm:text-[62px]"
          style={{ fontWeight: 380, letterSpacing: "-0.03em" }}
        >
          Give your agent a USDT budget. Not your wallet.
        </h1>

        <p className="mx-auto mt-6 max-w-[54ch] text-subheading text-paper-white/65">
          Agents request economic actions. Spenda validates intent, budget, risk, approval and policy before the vault moves funds.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Open the dashboard
          </LinkButton>
          <LinkButton
            href="#proof"
            variant="ghost"
            size="md"
            className="text-paper-white hover:bg-white/10"
          >
            See it live
            <ArrowUpRight width={16} height={16} />
          </LinkButton>
        </div>

        <div className="mx-auto mt-12 grid max-w-[900px] overflow-hidden border border-white/10 bg-white/[0.04] text-left md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <HeroNode label="User funds" value="USDT vault" detail="Owner controlled" />
          <FlowArrow />
          <HeroNode label="Agent authority" value="Spend intent" detail="Zero custody" />
          <FlowArrow />
          <HeroNode label="Final boundary" value="Policy engine" detail="Approve · escalate · block" />
        </div>
      </div>
    </section>
  );
}

function HeroNode({label, value, detail}: {label: string; value: string; detail: string}) {
  return <div className="min-w-0 px-5 py-5 sm:px-6"><p className="text-caption text-paper-white/45">{label}</p><p className="mt-1 font-heading text-[20px] text-paper-white" style={{fontWeight: 420}}>{value}</p><p className="mt-1 text-caption text-paper-white/55">{detail}</p></div>;
}

function FlowArrow() {
  return <div className="hidden items-center border-x border-white/10 px-3 text-base-orange md:flex" aria-hidden="true">→</div>;
}
