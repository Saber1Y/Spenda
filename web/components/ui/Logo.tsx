/** Spenda logo lockup — AVIF (16 KB) with a PNG fallback via <picture>. */
export function Logo({height = 28, className = ""}: {height?: number; className?: string}) {
  return (
    <picture>
      <source srcSet="/botspend-logo.avif" type="image/avif" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/botspend-logo.png"
        alt="Spenda"
        height={height}
        style={{height, width: "auto"}}
        className={`select-none ${className}`}
        draggable={false}
      />
    </picture>
  );
}
