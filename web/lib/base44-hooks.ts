"use client";

import {useCallback, useEffect, useState} from "react";
import {getBase44Client} from "@/lib/base44";

interface EntityState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

function useEntityList<T>(fetcher: () => Promise<T[]>, deps: unknown[]): EntityState<T[]> & {refetch: () => void} {
  const [state, setState] = useState<EntityState<T[]>>({data: undefined, loading: true, error: undefined});

  const refetch = useCallback(async () => {
    setState((s) => ({...s, loading: true}));
    try {
      const data = await fetcher();
      setState({data, loading: false, error: undefined});
    } catch (e) {
      setState((s) => ({data: s.data, loading: false, error: e as Error}));
    }
  }, deps);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {...state, refetch};
}

/** Fetch all Vault entities from Base44. */
export function useVaultEntities() {
  return useEntityList(
    () => getBase44Client().asServiceRole.entities.Vault.list("-created_at", 50) as Promise<Record<string, any>[]>,
    [],
  );
}

/** Fetch all Agent entities from Base44. */
export function useAgentEntities() {
  return useEntityList(
    () => getBase44Client().asServiceRole.entities.Agent.list("-created_at", 50) as Promise<Record<string, any>[]>,
    [],
  );
}

/** Fetch transactions for a specific vault from Base44. */
export function useTransactionEntities(vaultId?: string) {
  return useEntityList(
    () =>
      vaultId
        ? (getBase44Client().asServiceRole.entities.Transaction.filter({vault_id: vaultId}, "-block_number", 100) as Promise<Record<string, any>[]>)
        : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch audit logs for a specific vault from Base44. */
export function useAuditLogEntities(vaultId?: string) {
  return useEntityList(
    () =>
      vaultId
        ? (getBase44Client().asServiceRole.entities.AuditLog.filter({vault_id: vaultId}, "-timestamp", 100) as Promise<Record<string, any>[]>)
        : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch policy entities for a specific vault from Base44. */
export function usePolicyEntities(vaultId?: string) {
  return useEntityList(
    () =>
      vaultId
        ? (getBase44Client().asServiceRole.entities.Policy.filter({vault_id: vaultId}, "-created_at", 10) as Promise<Record<string, any>[]>)
        : Promise.resolve([]),
    [vaultId],
  );
}
