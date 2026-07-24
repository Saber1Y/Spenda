/** Spenda wordmark — pure type (no ghost; Phantom's mascot is their IP). Weight 350, tight tracking. */
export function Wordmark({className = "", tone = "dark"}: {className?: string; tone?: "dark" | "light"}) {
  return (
    <span
      className={`font-heading select-none ${tone === "light" ? "text-paper-white" : "text-aubergine"} ${className}`}
      style={{fontWeight: 350, letterSpacing: "-0.03em"}}
    >
      BOT<span className="text-periwinkle">Spend</span>
    </span>
  );
}
