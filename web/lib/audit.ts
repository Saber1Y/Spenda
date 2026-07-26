import {getBase44Client} from "@/lib/base44";
import {getActiveContracts} from "@/lib/contracts";

interface AuditEntry {
  vaultId?: string;
  action: string;
  actor: string;
  actorType: "user" | "agent" | "system";
  metadata?: Record<string, any>;
  txHash?: string;
}

export async function recordAuditLog(entry: AuditEntry) {
  try {
    const client = getBase44Client();
    let vaultId = entry.vaultId;
    if (!vaultId) {
      const active = getActiveContracts();
      const raw = await client.functions.invoke("queryEntities", {
        body: {entity: "Vault", filter: {}, sort: "-created_at", limit: 50},
      });
      const res = raw?.data ?? raw;
      const vaults = res?.data ?? [];
      const match = vaults.find(
        (v: Record<string, any>) => v.contract_address?.toLowerCase() === active.vault.toLowerCase(),
      );
      vaultId = match?.id;
    }
    if (!vaultId) return;

    await client.functions.invoke("recordAuditLogBE", {
      body: {
        vault_id: vaultId,
        action: entry.action,
        actor: entry.actor,
        actor_type: entry.actorType,
        metadata: entry.metadata ?? {},
        tx_hash: entry.txHash ?? "",
      },
    });
  } catch {
    // Audit log failures should not block the user flow
  }
}
