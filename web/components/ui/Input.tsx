"use client";

import type {InputHTMLAttributes, ReactNode} from "react";

export function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption uppercase tracking-[0.06em] text-fog">{label}</span>
      {children}
      {hint ? <span className="text-caption text-fog">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-[16px] border border-ash bg-paper-white px-4 py-2.5 text-body text-obsidian tabular-nums outline-none transition placeholder:text-fog/60 focus:border-periwinkle ${props.className ?? ""}`}
    />
  );
}

/** Pill toggle for a boolean (e.g. policy active). */
export function Toggle({checked, onChange, label}: {checked: boolean; onChange: (v: boolean) => void; label?: string}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2.5 rounded-pill px-1 py-1 transition ${checked ? "bg-mint-signal/20" : "bg-ash"}`}
    >
      <span
        className={`h-6 w-6 rounded-pill transition ${checked ? "translate-x-6 bg-mint-signal" : "translate-x-0 bg-fog"}`}
      />
      {label ? <span className="pr-3 text-body-sm text-aubergine">{label}</span> : null}
    </button>
  );
}
