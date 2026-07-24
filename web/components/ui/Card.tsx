import type {ReactNode} from "react";

type Tone = "paper" | "bone" | "lavender" | "dark";
type Pad = "sm" | "md" | "lg";

const toneClass: Record<Tone, string> = {
  paper: "bg-paper-white border-ash text-obsidian",
  bone: "bg-bone border-ash text-obsidian",
  lavender: "bg-ghost-lavender border-ghost-lavender text-aubergine",
  dark: "bg-aubergine border-white/12 text-paper-white",
};

const padClass: Record<Pad, string> = {
  sm: "p-5",
  md: "p-6 sm:p-8",
  lg: "p-6 sm:p-10 lg:p-12", // up to 48px (card padding)
};

/** The Card Surface — 24px radius, flat (border, no shadow), generous padding. */
export function Card({
  tone = "paper",
  pad = "md",
  className = "",
  children,
}: {
  tone?: Tone;
  pad?: Pad;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-card border ${toneClass[tone]} ${padClass[pad]} ${className}`}>{children}</div>
  );
}
