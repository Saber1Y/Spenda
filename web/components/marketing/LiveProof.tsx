"use client";

import {useEffect, useState} from "react";
import {Eyebrow} from "./Section";
import {Card} from "@/components/ui/Card";
import {Check, Hand} from "@/components/ui/Icons";
import {TxChip, Chip} from "@/components/ui/Chip";
import {Skeleton} from "@/components/ui/Row";
import {fetchProof, fetchRecentActivity, type ProofResult, type ActivityFeedResult} from "@/lib/proof";
import {formatMusd, truncateHash, truncateAddress} from "@/lib/format";
import {explorerTx, explorerAddress} from "@/lib/chain";

function LandingBadge({kind}: {kind: "approved" | "blocked"}) {
  if (kind === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-obsidian px-3 py-1 text-[13px] leading-none text-paper-white">
        <Check width={13} height={13} />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-base-orange px-3 py-1 text-[13px] leading-none text-base-orange">
      <Hand width={13} height={13} />
      Held
    </span>
  );
}

function ProofColumn({data}: {data: ProofResult | undefined}) {
  const approved = data?.kind === "approved";
  return (
    <Card tone="paper" pad="lg" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {data ? <LandingBadge kind={data.kind} /> : <Skeleton className="h-6 w-24" />}
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

        <ActivityFeed />
        <AgentSpotlight />
      </div>
    </section>
  );
}

const SPOTLIGHT_AGENTS = [
  {
    name: "Procurement agent",
    address: "0x2649495B56e8c06C6682549438ac9279599A3aD8",
    policy: "Max 50 test mUSD per tx · 250 per day",
  },
  {
    name: "Research agent",
    address: "0x02B56f3Bd6fb799AE3acF9053A69FA99EE3899b5",
    policy: "Max 10 test mUSD per tx · 50 per day",
  },
];

function ActivityFeed() {
  const [feed, setFeed] = useState<ActivityFeedResult>();

  useEffect(() => {
    let alive = true;
    fetchRecentActivity().then((r) => alive && setFeed(r));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mt-12 overflow-hidden rounded-card border border-ash bg-paper-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ash px-6 py-4">
        <span className="text-caption uppercase tracking-[0.08em] text-fog">Recent vault decisions</span>
        <span className="text-caption text-fog">
          {feed ? (feed.live ? "reading BOT Chain" : "snapshot") : "connecting"}
        </span>
      </div>
      {feed === undefined ? (
        <div className="space-y-3 px-6 py-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : feed.entries.length === 0 ? (
        <p className="px-6 py-5 text-body-sm text-fog">No decisions recorded yet.</p>
      ) : (
        <ul className="divide-y divide-ash">
          {feed.entries.map((e) => (
            <li key={`${e.txHash}-${e.logIndex}`} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4">
              <LandingBadge kind={e.kind} />
              <span className="font-mono text-[13px] text-obsidian">{truncateAddress(e.agent)}</span>
              <span className="text-body-sm text-obsidian">{formatMusd(e.amount)} test mUSD</span>
              {e.reason ? <span className="text-caption text-fog">{e.reason}</span> : null}
              <span className="ml-auto">
                <TxChip href={explorerTx(e.txHash)} label={truncateHash(e.txHash)} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentSpotlight() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      {SPOTLIGHT_AGENTS.map((a) => (
        <Card key={a.address} tone="paper" pad="lg" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-caption uppercase tracking-[0.08em] text-fog">{a.name}</span>
            <Chip tone="outline">restricted</Chip>
          </div>
          <TxChip href={explorerAddress(a.address)} label={truncateAddress(a.address)} />
          <p className="text-body-sm text-fog">{a.policy}</p>
          <p className="mt-auto inline-flex items-center gap-2 text-caption text-obsidian">
            <span className="h-1.5 w-1.5 rounded-full bg-base-orange" />
            0 unauthorized spends
          </p>
        </Card>
      ))}
      <Card tone="paper" pad="lg" className="flex flex-col justify-between gap-4">
        <span className="text-caption uppercase tracking-[0.08em] text-fog">Track record</span>
        <p className="font-heading text-heading text-obsidian" style={{ fontWeight: 350 }}>
          0 unauthorized moves
        </p>
        <p className="text-body-sm text-fog">
          Across every deployed agent since the restricted stack went live. Blocked requests moved nothing.
        </p>
      </Card>
    </div>
  );
}
