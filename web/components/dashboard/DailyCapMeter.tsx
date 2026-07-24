import {formatMusd} from "@/lib/format";

/** Daily-cap progress — a pill track, filled in periwinkle. Not a generic progress bar. */
export function DailyCapMeter({spent, cap, remaining}: {spent: bigint; cap: bigint; remaining: bigint}) {
  const pct = cap > 0n ? Math.min(100, Number((spent * 10000n) / cap) / 100) : 0;
  const nearCap = pct >= 90;
  return (
    <div>
      <div className="flex items-baseline justify-between text-body-sm">
        <span className="text-fog">Spent today</span>
        <span className="text-aubergine tabular-nums">
          {formatMusd(spent)} / {formatMusd(cap)} mUSD
        </span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-pill bg-ash">
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ${nearCap ? "bg-periwinkle" : "bg-periwinkle"}`}
          style={{width: `${Math.max(pct, spent > 0n ? 4 : 0)}%`}}
        />
      </div>
      <div className="mt-2 text-caption text-fog tabular-nums">{formatMusd(remaining)} mUSD remaining today</div>
    </div>
  );
}
