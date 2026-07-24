import type {ReactNode} from "react";

/** A list row — used for action history. Soft, spacious, hover; no table chrome. */
export function Row({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card px-4 py-4 transition hover:bg-bone ${className}`}
    >
      {children}
    </div>
  );
}

/** Simple skeleton bar for loading states, within the pill/soft geometry. */
export function Skeleton({className = ""}: {className?: string}) {
  return <div className={`animate-pulse rounded-pill bg-ash ${className}`} />;
}
