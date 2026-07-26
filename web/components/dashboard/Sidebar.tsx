"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { Dot } from "@/components/ui/Icons";
import { truncateAddress } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Overview", icon: "grid" },
  { href: "/dashboard/spending", label: "Spending", icon: "credit" },
  { href: "/dashboard/policies", label: "Policies", icon: "shield" },
  { href: "/dashboard/agents", label: "Agents", icon: "bot" },
  { href: "/dashboard/allowlist", label: "Allowlist", icon: "list" },
  { href: "/dashboard/gas", label: "Gas Sponsorship", icon: "zap" },
  { href: "/dashboard/audit", label: "Audit Log", icon: "clock" },
] as const;

function NavIcon({ icon }: { icon: string }) {
  const cls = "w-4 h-4";
  switch (icon) {
    case "grid":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "credit":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="4" width="22" height="16" rx="3" />
          <path d="M1 10h22" />
        </svg>
      );
    case "shield":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
        </svg>
      );
    case "bot":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8V4H8l4 4 4-4h-4Z" />
          <rect x="4" y="12" width="16" height="9" rx="3" />
          <circle cx="9" cy="16" r="1" fill="currentColor" />
          <circle cx="15" cy="16" r="1" fill="currentColor" />
          <path d="M9 21v2M15 21v2" />
        </svg>
      );
    case "list":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "zap":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      );
    case "clock":
      return (
        <svg
          className={cls}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-ash/15 bg-obsidian">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-ash/15 px-5">
        <img
          src="/spenda-logo.png"
          alt="Spenda"
          height={50}
          width={150}
          className="rounded-[8px] select-none"
          draggable={false}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] transition ${
                    active
                      ? "bg-base-orange/15 text-base-orange font-medium"
                      : "text-fog hover:bg-white/5 hover:text-paper-white"
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-ash/15 px-4 py-4">
        <Link
          href="/"
          className="mb-3 flex items-center gap-2 rounded-[12px] px-3 py-2 text-[15px] text-fog transition hover:bg-white/5 hover:text-paper-white"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
          Home
        </Link>

        {isConnected && address ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2.5">
            <Dot width={9} height={9} className="text-mint-signal" />
            <span className="text-[13px] tabular-nums text-paper-white">
              {truncateAddress(address)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2.5">
            <Dot width={9} height={9} className="text-fog" />
            <span className="text-[13px] text-fog">Not connected</span>
          </div>
        )}
      </div>
    </aside>
  );
}
