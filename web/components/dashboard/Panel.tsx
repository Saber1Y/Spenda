import type {ReactNode} from "react";
import {Card} from "@/components/ui/Card";

/** Standard dashboard panel — a Card with a title row + optional action, inheriting marketing DNA. */
export function Panel({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card tone="paper" pad="md" className={`flex flex-col gap-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-heading-sm text-aubergine" style={{fontWeight: 350}}>
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-body-sm text-fog">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}

/** Small empty/failure inline note within the soft geometry. */
export function PanelNote({tone = "muted", children}: {tone?: "muted" | "error"; children: ReactNode}) {
  return (
    <div
      className={`rounded-card border px-4 py-6 text-center text-body-sm ${
        tone === "error" ? "border-blush-mist bg-blush-mist/30 text-aubergine" : "border-ash bg-bone text-fog"
      }`}
    >
      {children}
    </div>
  );
}
