"use client";

import {useState} from "react";
import {useWriteContract} from "wagmi";
import type {Abi} from "viem";
import {botChain} from "./chain";
import {waitForReceiptRaw} from "./txwait";

export type WriteArgs = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};

export type WriteStatus = {pending: boolean; error?: string; okKey?: number; lastHash?: `0x${string}`};

/**
 * Owner write with the backend confirmation pattern: submit → wait for raw receipt → READ BACK
 * (caller's refetch) to confirm the effect. Never uses a formatted waitForTransactionReceipt.
 */
export function useOwnerWrite(refetch: () => void) {
  const {writeContractAsync} = useWriteContract();
  const [status, setStatus] = useState<WriteStatus>({pending: false});

  const run = async (args: WriteArgs) => {
    setStatus({pending: true});
    try {
      const hash = await writeContractAsync({...args, chainId: botChain.id, ...(args.value ? {value: args.value} : {})});
      const result = await waitForReceiptRaw(hash);
      if (result === "reverted") {
        setStatus({pending: false, error: "Transaction reverted on-chain"});
        return;
      }
      refetch(); // read-back the resulting state
      setStatus({pending: false, okKey: Date.now(), lastHash: hash});
    } catch (e) {
      const err = e as {shortMessage?: string; message?: string};
      setStatus({pending: false, error: err.shortMessage ?? err.message ?? "Transaction failed"});
    }
  };

  return {run, ...status};
}
