import type {ReactNode} from "react";

/** A labelled stat — caption label + light-weight value + optional sub/units. */
export function StatTile({
  label,
  value,
  sub,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption uppercase tracking-[0.06em] text-fog">{label}</span>
      <span className={`font-heading text-heading-sm text-obsidian ${valueClassName}`} style={{fontWeight: 350}}>
        {value}
      </span>
      {sub ? <span className="text-body-sm text-fog">{sub}</span> : null}
    </div>
  );
}
