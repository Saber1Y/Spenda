import {LinkButton} from "@/components/ui/Button";

export function CTASection() {
  return (
    <section className="bg-aubergine px-6">
      <div className="mx-auto max-w-[1200px] py-20 text-center sm:py-28">
        <h2
          className="mx-auto max-w-[18ch] font-heading text-heading leading-tight text-paper-white sm:text-heading-lg sm:leading-[1.1]"
          style={{fontWeight: 350}}
        >
          A wallet your agent can&rsquo;t drain.
        </h2>
        <p className="mx-auto mt-6 max-w-[52ch] text-body text-paper-white/70">
          The Base44 control plane syncs vault state, policy, allowlists, transactions and audit logs from
          on-chain into queryable entities. Watch everything live from the deployed contracts on BOT Chain 968.
        </p>
        <div className="mt-10 flex justify-center">
          <LinkButton href="/dashboard" variant="onDark" size="md">
            Open the dashboard
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
