import {Logo} from "@/components/ui/Logo";
import {explorerAddress} from "@/lib/chain";
import {CONTRACTS} from "@/lib/contracts";
import {ArrowUpRight} from "@/components/ui/Icons";

const links = [
  {label: "Vault contract", href: explorerAddress(CONTRACTS.vault)},
  {label: "Paymaster", href: explorerAddress(CONTRACTS.paymaster)},
  {label: "BOTScan", href: "https://scan.bohr.life"},
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ash bg-paper-white px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo height={30} />

          <p className="mt-3 max-w-[40ch] text-caption text-fog">
            Policy-checked, gasless spend vaults for autonomous agents. BOT Chain Builder Challenge · AI Agent
            track · testnet 968.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-body-sm text-aubergine transition hover:text-periwinkle"
            >
              {l.label}
              <ArrowUpRight width={13} height={13} className="text-fog" />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
