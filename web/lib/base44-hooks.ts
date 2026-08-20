"use client";

import {useCallback, useEffect, useState} from "react";
import {getBase44Client} from "@/lib/base44";
import {getActiveContracts} from "@/lib/contracts";

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

async function queryEntities(
  entity: string,
  filter?: Record<string, unknown>,
  sort?: string,
  limit?: number,
): Promise<Record<string, any>[]> {
  const client = getBase44Client();
  const raw = await client.functions.invoke("queryEntities", {
    entity, filter: filter ?? {}, sort: sort ?? "-created_at", limit: limit ?? 100,
  });
  const res = raw?.data ?? raw;
  if (!res?.ok) throw new Error(res?.error ?? "queryEntities failed");
  return res.data ?? [];
}

/** Fetch all Vault entities from Base44. */
export function useVaultEntities() {
  return useEntityList(
    () => queryEntities("Vault", {}, "-created_at", 50),
    [],
  );
}

/** Find the vault entity matching the active contract address, or fall back to first vault. */
export function useActiveVaultEntity(): Record<string, any> | undefined {
  const {data: vaultEntities} = useVaultEntities();
  if (!vaultEntities || vaultEntities.length === 0) return undefined;
  const active = getActiveContracts();
  const match = vaultEntities.find(
    (v) => v.contract_address?.toLowerCase() === active.vault.toLowerCase(),
  );
  return match ?? vaultEntities[0];
}

/** Fetch all Agent entities from Base44. */
export function useAgentEntities() {
  return useEntityList(
    () => queryEntities("Agent", {}, "-created_at", 50),
    [],
  );
}

export function useVaultAgentEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId ? queryEntities("Agent", {vault_id: vaultId}, "-created_at", 100) : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch transactions for a specific vault from Base44. If no vaultId, fetches all. */
export function useTransactionEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId
      ? queryEntities("Transaction", {vault_id: vaultId}, "-block_number", 100)
      : queryEntities("Transaction", {}, "-block_number", 100),
    [vaultId],
  );
}

/** Fetch audit logs for a specific vault from Base44. If no vaultId, fetches all. */
export function useAuditLogEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId
      ? queryEntities("AuditLog", {vault_id: vaultId}, "-timestamp", 100)
      : queryEntities("AuditLog", {}, "-timestamp", 100),
    [vaultId],
  );
}

/** Fetch policy entities for a specific vault from Base44. */
export function usePolicyEntities(vaultId?: string) {
  return useEntityList(
    () =>
      vaultId
        ? queryEntities("Policy", {vault_id: vaultId}, "-created_at", 10)
        : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch pending human approvals for a vault. */
export function useApprovalEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId ? queryEntities("ApprovalRequest", {vault_id: vaultId, status: "pending"}, "-created_at", 100) : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch searchable spending receipts for a vault. */
export function useReceiptEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId ? queryEntities("SpendingReceipt", {vault_id: vaultId}, "-created_at", 100) : Promise.resolve([]),
    [vaultId],
  );
}

/** Fetch application budget projections for a vault. */
export function useBudgetEntities(vaultId?: string) {
  return useEntityList(
    () => vaultId ? queryEntities("AgentBudget", {vault_id: vaultId}, "-created_at", 100) : Promise.resolve([]),
    [vaultId],
  );
}
