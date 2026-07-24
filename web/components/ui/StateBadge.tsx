import {Check, Hand} from "./Icons";

/**
 * The fence-outcome badge. Approved = Mint solid. Blocked = Blush TINT + "Held" label + hand icon.
 * NO red — a block is the fence working as designed, not an error.
 */
export function StateBadge({kind, className = ""}: {kind: "approved" | "blocked"; className?: string}) {
  if (kind === "approved") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill bg-mint-signal px-3 py-1 text-[13px] leading-none text-paper-white ${className}`}
      >
        <Check width={13} height={13} />
        Approved
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border border-blush-mist bg-blush-mist/50 px-3 py-1 text-[13px] leading-none text-aubergine ${className}`}
    >
      <Hand width={13} height={13} />
      Held
    </span>
  );
}
