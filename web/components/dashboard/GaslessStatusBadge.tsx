import {Chip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";

/** Gasless/sponsor status: sponsor funded + agent holds nothing → gasless active. */
export function GaslessStatusBadge({
  paymasterDeposit,
  agentNative,
  agentDeposit,
  loading,
}: {
  paymasterDeposit?: bigint;
  agentNative?: bigint;
  agentDeposit?: bigint;
  loading: boolean;
}) {
  if (loading || paymasterDeposit === undefined) {
    return <Chip tone="outline">checking sponsor…</Chip>;
  }
  const funded = paymasterDeposit > 0n;
  const holdsNothing = (agentNative ?? 0n) === 0n && (agentDeposit ?? 0n) === 0n;
  const active = funded && holdsNothing;

  return (
    <Chip tone={active ? "mint" : "blush"}>
      <Dot width={9} height={9} />
      {active ? "Gasless active" : funded ? "Agent not empty" : "Sponsor unfunded"}
    </Chip>
  );
}
