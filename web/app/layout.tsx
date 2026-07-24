import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import {Providers} from "@/components/Providers";

const inter = Inter({subsets: ["latin"], variable: "--font-inter", display: "swap"});

const title = "Spenda — a wallet your AI agent can't drain";
const description =
  "Policy-checked, gasless spend vaults for autonomous agents on BOT Chain. The agent holds nothing; a sponsor policy fences it to the vault at the gas layer; the vault enforces caps, allowlists and receipts on-chain.";

export const metadata: Metadata = {
  // absolute URLs for OG/twitter images; set NEXT_PUBLIC_SITE_URL on deploy for live previews
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "Spenda",
  openGraph: {title, description, siteName: "Spenda", type: "website"},
  twitter: {card: "summary_large_image", title, description},
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
