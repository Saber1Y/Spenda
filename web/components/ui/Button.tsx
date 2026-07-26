import type {ButtonHTMLAttributes, ReactNode} from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "accent" | "onDark" | "ghost";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary: "bg-base-orange text-paper-white shadow-glow hover:brightness-[0.95]",
  secondary: "bg-ash text-obsidian hover:brightness-[0.97]",
  accent: "bg-base-orange text-paper-white hover:brightness-[0.95]",
  onDark: "bg-paper-white text-obsidian hover:brightness-[0.97]",
  ghost: "bg-transparent text-obsidian hover:bg-ash/60",
};

const sizeClass: Record<Size, string> = {
  sm: "px-5 py-2.5 text-[15px]",
  md: "px-8 py-3.5 text-[16px]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-body transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap";

type CommonProps = {variant?: Variant; size?: Size; className?: string; children: ReactNode};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
  children,
}: CommonProps & {href: string; external?: boolean}) {
  const cls = `${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
