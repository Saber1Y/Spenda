import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { ArrowUpRight, Shield } from "@/components/ui/Icons";
import { explorerAddress } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

const DOCS_URL = "https://github.com/Saber1Y/Spenda";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-obsidian px-6">
      <div className="relative mx-auto grid max-w-[1200px] gap-12 pb-20 pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
        <div>
          <h1
            className="mt-6 max-w-[17ch] text-balance font-heading text-[44px] leading-[1.05] text-paper-white sm:text-[62px]"
            style={{ fontWeight: 380, letterSpacing: "-0.03em" }}
          >
            Give your agent a USDT budget. Not your wallet.
          </h1>

          <p className="mt-6 max-w-[54ch] text-subheading text-paper-white/65">
            Agents request economic actions. Spenda checks budget, risk,
            approval and policy on-chain before a single dollar moves.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <LinkButton href="#proof" variant="primary" size="md">
              See a demo transaction
            </LinkButton>
            <LinkButton href="/dashboard" external variant="onDark" size="md">
              Launch dashboard
            </LinkButton>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-caption text-paper-white/60">
            <a
              href={explorerAddress(CONTRACTS.vault)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition hover:text-paper-white"
            >
              <Shield width={14} height={14} className="text-base-orange" />
              Contracts verified on BOTScan
            </a>
            <span className="inline-flex items-center gap-2">
              <Shield width={14} height={14} className="text-base-orange" />
              Live on BOT Chain testnet
            </span>
            <a href="#proof" className="transition hover:text-paper-white">
              Real approved + blocked transactions
            </a>
          </div>
        </div>

        <div className="hero-visual-enter">
          <ArchitectureDiagram />
        </div>
      </div>
    </section>
  );
}
