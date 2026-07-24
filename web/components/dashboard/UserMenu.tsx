"use client";

import {useAuth} from "@/components/AuthProvider";
import {truncateAddress} from "@/lib/format";

export function UserMenu() {
  const {user, client} = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-body-sm text-fog sm:inline">{user.email}</span>
      <button
        onClick={() => client.auth.logout("/login")}
        className="rounded-pill px-4 py-2 text-body-sm text-aubergine transition hover:bg-bone"
      >
        Sign out
      </button>
    </div>
  );
}
