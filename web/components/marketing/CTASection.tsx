import {LinkButton} from "@/components/ui/Button";

export function CTASection() {
  return (
    <section className="bg-paper-white px-6">
      <div className="mx-auto max-w-[1200px] py-20 text-center sm:py-28">
        <h2
          className="mx-auto max-w-[18ch] font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]"
          style={{fontWeight: 350}}
        >
          Agents get autonomy. You keep custody.
        </h2>
        <p className="mx-auto mt-6 max-w-[52ch] text-body text-fog">
          Inspect intents, agent budgets, approvals, risk decisions and chain-derived receipts from the restricted BOT Chain testnet deployment.
        </p>
        <div className="mt-10 flex justify-center">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Open the dashboard
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
