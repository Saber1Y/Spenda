import type {ReactNode} from "react";

type Tone = "paper" | "bone" | "dark";

const toneCls: Record<Tone, string> = {
  paper: "bg-obsidian text-paper-white",
  bone: "bg-bone text-obsidian",
  dark: "bg-paper-white text-obsidian",
};

/** Full-bleed section with the 1200px content cap and the 64px+ section rhythm. */
export function Section({
  tone = "paper",
  id,
  className = "",
  children,
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${toneCls[tone]} px-6`}>
      <div className={`mx-auto max-w-[1200px] py-16 sm:py-20 lg:py-24 ${className}`}>{children}</div>
    </section>
  );
}

/** Section eyebrow — a small caption label above headings. */
export function Eyebrow({children, onDark = false}: {children: ReactNode; onDark?: boolean}) {
  return (
    <span className={`text-caption uppercase tracking-[0.08em] ${onDark ? "text-fog" : "text-periwinkle"}`}>
      {children}
    </span>
  );
}
