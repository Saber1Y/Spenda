import type {SVGProps} from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const ArrowUpRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const Copy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="3" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const Shield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
  </svg>
);

export const Hand = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 11V7a2 2 0 0 0-4 0M14 10V5a2 2 0 0 0-4 0v6M10 11V6a2 2 0 0 0-4 0v9a6 6 0 0 0 6 6h1a6 6 0 0 0 6-6v-2a2 2 0 0 0-4 0" />
  </svg>
);

export const Bolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const Dot = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <circle cx="12" cy="12" r="5" />
  </svg>
);
