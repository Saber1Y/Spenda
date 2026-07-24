"use client";

import {useState, type ReactNode} from "react";
import {Copy, Check, ArrowUpRight} from "./Icons";

type ChipTone = "neutral" | "lavender" | "mint" | "blush" | "outline";

const toneClass: Record<ChipTone, string> = {
  neutral: "bg-ash text-obsidian",
  lavender: "bg-ghost-lavender text-aubergine",
  mint: "bg-mint-signal text-paper-white",
  blush: "bg-blush-mist/60 text-aubergine border border-blush-mist",
  outline: "bg-transparent text-aubergine border border-ash",
};

export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Copyable value chip — mono-ish truncated text, click to copy the full value. */
export function CopyChip({value, label, tone = "outline"}: {value: string; label?: string; tone?: ChipTone}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  return (
    <button
      onClick={onCopy}
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] leading-none transition hover:brightness-95 ${toneClass[tone]}`}
      title="Copy"
    >
      <span className="tabular-nums tracking-tight">{label ?? value}</span>
      {copied ? <Check width={13} height={13} className="text-mint-signal" /> : <Copy width={13} height={13} className="text-fog" />}
    </button>
  );
}

/** Explorer link chip → scan.bohr.life. */
export function TxChip({href, label, tone = "outline"}: {href: string; label: string; tone?: ChipTone}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] leading-none transition hover:brightness-95 ${toneClass[tone]}`}
    >
      <span className="tabular-nums tracking-tight">{label}</span>
      <ArrowUpRight width={13} height={13} className="text-fog" />
    </a>
  );
}
