import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";

const links = [
  { label: "Security model", href: "#security" },
  { label: "Product flow", href: "#flow" },
  { label: "How it works", href: "#how" },
  { label: "Mainnet", href: "#mainnet" },
  { label: "Live proof", href: "#proof" },
];

export function SiteNav() {
  return (
    <div className="sticky top-4 z-50 px-4">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 rounded-pill border border-ash bg-paper-white/85 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <Link href="/" className="flex items-center px-2">
          <span className="font-heading text-[22px] tracking-tight text-obsidian" style={{fontWeight: 500}}>
            Spenda<span className="text-base-orange">.</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-pill px-4 py-2 text-body-sm text-aubergine transition hover:bg-bone"
            >
              {l.label}
            </a>
          ))}
        </div>
        <LinkButton href="/dashboard" variant="primary" size="sm">
          Launch dashboard
        </LinkButton>
      </nav>
    </div>
  );
}
