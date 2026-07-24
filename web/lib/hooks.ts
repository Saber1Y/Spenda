"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {Address} from "viem";
import {DEPLOY_BLOCK} from "./contracts";
import {readVaultState, readActions, latestBlock, sortNewestFirst, type VaultState, type AgentAction} from "./reads";

export type AsyncState<T> = {
  data: T | undefined; // last-good is kept on error
  loading: boolean;
  error: Error | undefined;
};

/** Batched vault-state read. Refetches on window focus + manual + post-action only (no interval). */
export function useVaultState(agent: Address) {
  const [state, setState] = useState<AsyncState<VaultState>>({data: undefined, loading: true, error: undefined});

  const refetch = useCallback(async () => {
    setState((s) => ({...s, loading: true}));
    try {
      const data = await readVaultState(agent);
      setState({data, loading: false, error: undefined});
    } catch (e) {
      setState((s) => ({data: s.data, loading: false, error: e as Error})); // keep last-good
    }
  }, [agent]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  return {...state, refetch};
}

/** Incremental action history: cache logs, query only new blocks since last-seen on refetch. */
export function useActionHistory(agent: Address) {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const lastSeen = useRef<bigint>(DEPLOY_BLOCK - 1n);
  const seenKeys = useRef<Set<string>>(new Set());
  const agentRef = useRef<Address>(agent);

  // reset the cache if the agent changes (multi-agent later)
  if (agentRef.current !== agent) {
    agentRef.current = agent;
    lastSeen.current = DEPLOY_BLOCK - 1n;
    seenKeys.current = new Set();
  }

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const to = await latestBlock();
      const from = lastSeen.current + 1n;
      if (to >= from) {
        const fresh = await readActions(agent, from, to);
        const added: AgentAction[] = [];
        for (const a of fresh) {
          const key = `${a.txHash}:${a.logIndex}`;
          if (!seenKeys.current.has(key)) {
            seenKeys.current.add(key);
            added.push(a);
          }
        }
        if (added.length) setActions((prev) => [...prev, ...added].sort(sortNewestFirst));
        lastSeen.current = to;
      }
      setError(undefined);
    } catch (e) {
      setError(e as Error); // keep last-good actions
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  return {actions, loading, error, refetch};
}
