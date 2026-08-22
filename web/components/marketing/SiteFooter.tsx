import { explorerAddress } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";
import { ArrowUpRight } from "@/components/ui/Icons";

const links = [
  { label: "Vault contract", href: explorerAddress(CONTRACTS.vault) },
  { label: "Paymaster", href: explorerAddress(CONTRACTS.paymaster) },
  { label: "BOTScan", href: "https://scan.botchain.ai" },
  { label: "Mainnet USDT", href: "https://scan.botchain.ai/address/0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-obsidian px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-heading text-[22px] tracking-tight text-paper-white" style={{fontWeight: 500}}>
            Spenda<span className="text-base-orange">.</span>
          </span>

          <p className="mt-3 max-w-[40ch] text-caption text-paper-white/50">
            Policy-controlled USDT spending for autonomous agents. BOT pays gas; agents hold nothing.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-body-sm text-paper-white/70 transition hover:text-base-orange"
            >
              {l.label}
              <ArrowUpRight
                width={13}
                height={13}
                className="text-paper-white/40"
              />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
