"use client";

import {useAccount, useConnect, useDisconnect} from "wagmi";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";
import {truncateAddress} from "@/lib/format";

export function OwnerConnectButton() {
  const {address, isConnected} = useAccount();
  const {connect, connectors, isPending} = useConnect();
  const {disconnect} = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="inline-flex items-center gap-2 rounded-pill border border-ash bg-paper-white px-3 py-2 text-body-sm text-aubergine transition hover:bg-bone"
        title="Disconnect"
      >
        <Dot width={9} height={9} className="text-mint-signal" />
        {truncateAddress(address)}
      </button>
    );
  }

  const injected = connectors[0];
  return (
    <Button variant="secondary" size="sm" onClick={() => injected && connect({connector: injected})} disabled={isPending || !injected}>
      {isPending ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}

/** Small inline connection state chip used inside owner-only panels. */
export function ConnectionHint({isOwner, connected}: {isOwner: boolean; connected: boolean}) {
  if (!connected) return <Chip tone="outline">connect the owner wallet to edit</Chip>;
  if (!isOwner) return <Chip tone="blush">connected wallet isn&rsquo;t the vault owner</Chip>;
  return (
    <Chip tone="mint">
      <Dot width={9} height={9} /> owner connected
    </Chip>
  );
}
