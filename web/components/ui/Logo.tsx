/** Spenda logo lockup - "spend gate" mark + wordmark. */
export function Logo({height = 28, className = "", light = false}: {height?: number; className?: string; light?: boolean}) {
  return (
    <span
      className={`inline-flex items-center gap-2 select-none ${className}`}
      style={{height}}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/spenda-mark.svg"
        alt=""
        height={height}
        width={height}
        style={{height, width: height}}
        draggable={false}
      />
      <span
        className={`font-heading ${light ? "text-paper-white" : "text-obsidian"}`}
        style={{
          fontSize: Math.round(height * 0.82),
          fontWeight: 350,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        Spenda
      </span>
    </span>
  );
}
