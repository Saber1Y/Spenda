/** Spenda logo lockup - SVG text mark. */
export function Logo({height = 28, className = "", light = false}: {height?: number; className?: string; light?: boolean}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? "/spenda-logo-light.svg" : "/spenda-logo.svg"}
      alt="Spenda"
      height={height}
      style={{height, width: "auto"}}
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}
