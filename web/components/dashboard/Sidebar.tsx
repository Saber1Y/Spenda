"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { Dot } from "@/components/ui/Icons";
import { truncateAddress } from "@/lib/format";
import {loginWithGoogle} from "@/lib/auth";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/dashboard/overview", label: "Overview", icon: "grid" },
  { href: "/dashboard/spending", label: "Spending", icon: "credit" },
  { href: "/dashboard/approvals", label: "Approvals", icon: "hand" },
  { href: "/dashboard/receipts", label: "Receipts", icon: "receipt" },
  { href: "/dashboard/commerce", label: "Commerce", icon: "shop" },
  { href: "/dashboard/risk", label: "Risk Policy", icon: "shield" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: "pulse" },
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
    case "hand":
      return <span className={`${cls} flex items-center justify-center text-[13px]`}>!</span>;
    case "receipt":
      return <span className={`${cls} flex items-center justify-center text-[13px]`}>#</span>;
    case "shop":
      return <span className={`${cls} flex items-center justify-center text-[13px]`}>$</span>;
    case "pulse":
      return <span className={`${cls} flex items-center justify-center text-[13px]`}>~</span>;
    default:
      return null;
  }
}

interface SidebarProps {
  user?: {email?: string; name?: string} | null;
}

export function Sidebar({user}: SidebarProps) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-ash/15 bg-obsidian">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-ash/15 px-5">
        <Image
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
      <div className="border-t border-ash/15 px-4 py-4 space-y-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-[15px] text-fog transition hover:bg-white/5 hover:text-paper-white"
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

        {user && (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2.5">
            <Dot width={9} height={9} className="text-mint-signal" />
            <span className="text-[13px] truncate text-paper-white">
              {user.email ?? "Signed in"}
            </span>
          </div>
        )}

        {isConnected && address ? (
          <div className="flex items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2.5">
            <Dot width={9} height={9} className="text-mint-signal" />
            <span className="text-[13px] tabular-nums text-paper-white">
              {truncateAddress(address)}
            </span>
          </div>
        ) : (
          <button
            onClick={() => {
              const mc = connectors[0];
              if (mc) connect({connector: mc});
            }}
            className="flex w-full items-center gap-2.5 rounded-[12px] bg-white/5 px-3 py-2.5 text-[13px] text-fog transition hover:bg-white/10 hover:text-paper-white"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
            Connect Wallet
          </button>
        )}

        {!user && (
          <button
             onClick={() => loginWithGoogle("/dashboard")}
            className="flex w-full items-center gap-2.5 rounded-[12px] bg-base-orange/15 px-3 py-2.5 text-[13px] text-base-orange transition hover:bg-base-orange/25"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  );
}
