import Link from "next/link";
import {Logo} from "@/components/ui/Logo";
import {OwnerConnectButton} from "./OwnerConnectButton";

export function DashboardNav() {
  return (
    <div className="sticky top-4 z-50 px-4">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 rounded-pill border border-ash bg-paper-white/85 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <Link href="/" className="flex items-center px-2">
          <Logo height={26} />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden rounded-pill px-4 py-2 text-body-sm text-aubergine transition hover:bg-bone sm:inline">
            ← Home
          </Link>
          <OwnerConnectButton />
        </div>
      </nav>
    </div>
  );
}
