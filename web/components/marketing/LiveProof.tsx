"use client";

import {useEffect, useState} from "react";
import {Eyebrow} from "./Section";
import {Card} from "@/components/ui/Card";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip, Chip} from "@/components/ui/Chip";
import {Skeleton} from "@/components/ui/Row";
import {fetchProof, type ProofResult} from "@/lib/proof";
import {formatMusd, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";

function ProofColumn({data}: {data: ProofResult | undefined}) {
  const approved = data?.kind === "approved";
  return (
    <Card tone="paper" pad="lg" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {data ? <StateBadge kind={data.kind} /> : <Skeleton className="h-6 w-24" />}
        {data ? (
          <Chip tone="outline">{data.live ? "live read" : "snapshot"}</Chip>
        ) : (
          <Skeleton className="h-6 w-16" />
        )}
      </div>

      <div>
        <span className="text-caption uppercase tracking-[0.08em] text-fog">executeSpend</span>
        {data ? (
          <div className="mt-1 font-heading text-heading-lg leading-none text-obsidian" style={{fontWeight: 350}}>
             {formatMusd(data.amount)} <span className="text-heading-sm text-fog">test mUSD</span>
          </div>
        ) : (
          <Skeleton className="mt-2 h-12 w-40" />
        )}
      </div>

      <div className="space-y-3 border-t border-ash pt-5 text-body-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-fog">Event</span>
          {data ? (
            <span className="text-right text-obsidian">
              {approved ? "AgentActionApproved" : "AgentActionBlocked"}
              {!approved && data.reason ? <span className="text-fog"> - &ldquo;{data.reason}&rdquo;</span> : null}
            </span>
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fog">Result</span>
          <span className="text-obsidian">
             {approved ? `vendor received ${data ? formatMusd(data.amount) : "-"} test mUSD` : "nothing moved"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fog">Transaction</span>
          {data ? (
            <TxChip href={explorerTx(data.txHash)} label={truncateHash(data.txHash)} />
          ) : (
            <Skeleton className="h-6 w-32" />
          )}
        </div>
      </div>
    </Card>
  );
}

export function LiveProof() {
  const [approved, setApproved] = useState<ProofResult>();
  const [blocked, setBlocked] = useState<ProofResult>();

  useEffect(() => {
    let alive = true;
    fetchProof("approved").then((r) => alive && setApproved(r));
    fetchProof("blocked").then((r) => alive && setBlocked(r));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="proof" className="bg-bone px-6">
      <div className="mx-auto max-w-[1200px] py-16 sm:py-20 lg:py-24">
        <div className="max-w-[56ch]">
          <Eyebrow>Live proof · on-chain</Eyebrow>
          <h2 className="mt-4 font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 350}}>
             Policy outcomes you can inspect.
          </h2>
          <p className="mt-5 text-body text-fog">
             Real BOT Chain testnet acceptance transactions show an approved restricted-account payment and a blocked
             policy request. Both use valueless test mUSD; mainnet settlement is configured for official USDT.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <ProofColumn data={approved} />
          <div className="flex items-center justify-center">
            <span className="rounded-pill border border-ash bg-paper-white px-4 py-2 text-caption uppercase tracking-[0.08em] text-fog">
              vs
            </span>
          </div>
          <ProofColumn data={blocked} />
        </div>
      </div>
    </section>
  );
}
