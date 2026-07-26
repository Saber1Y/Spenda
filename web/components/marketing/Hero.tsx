import {LinkButton} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Dot, ArrowUpRight} from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="bg-obsidian px-6">
      <div className="mx-auto max-w-[1200px] pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
        <div className="mb-8 flex justify-center">
          <Chip tone="lavender">
            <Dot width={10} height={10} className="text-mint-signal" />
            Live on BOT Chain testnet 968
          </Chip>
        </div>

        <h1
          className="mx-auto max-w-[16ch] font-heading text-[44px] leading-[1.05] text-paper-white sm:text-[64px]"
          style={{fontWeight: 350, letterSpacing: "-0.03em"}}
        >
          Give your AI agent a wallet it can&rsquo;t drain.
        </h1>

        <p className="mx-auto mt-7 max-w-[60ch] text-subheading text-paper-white/60">
          Spenda doesn&rsquo;t make agents smarter. It makes them safe to fund - the agent holds nothing, a
          sponsor policy fences it to the vault at the gas layer, and the vault enforces caps, allowlists and
          receipts on-chain. The Base44 control plane syncs every on-chain state change into queryable entities
          so the dashboard, audit logs, and analytics are always live.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Open the dashboard
          </LinkButton>
          <LinkButton href="#proof" variant="ghost" size="md" className="text-paper-white hover:bg-white/10">
            See it live
            <ArrowUpRight width={16} height={16} />
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
