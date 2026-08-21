import { LinkButton } from "@/components/ui/Button";
import { explorerAddress } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";

export function CTASection() {
  return (
    <section className="bg-paper-white px-6">
      <div className="mx-auto max-w-[1200px] py-20 text-center sm:py-28">
        <h2
          className="mx-auto max-w-[18ch] font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]"
          style={{ fontWeight: 350 }}
        >
          Agents get autonomy. You keep custody.
        </h2>
        <p className="mx-auto mt-6 max-w-[52ch] text-body text-fog">
          Inspect intents, agent budgets, approvals, risk decisions and chain-derived receipts from the live
          restricted deployment.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Launch dashboard
          </LinkButton>
          <LinkButton href={explorerAddress(CONTRACTS.vault)} external variant="ghost" size="md">
            View the vault on BOTScan
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
