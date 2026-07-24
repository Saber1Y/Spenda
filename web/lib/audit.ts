import {getBase44Client} from "@/lib/base44";

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
    const vaultEntities = await client.asServiceRole.entities.Vault.list("-created_at", 1);
    const vaultId = entry.vaultId ?? vaultEntities?.[0]?.id;
    if (!vaultId) return;

    await client.asServiceRole.entities.AuditLog.create({
      vault_id: vaultId,
      action: entry.action,
      actor: entry.actor,
      actor_type: entry.actorType,
      metadata: entry.metadata ?? {},
      tx_hash: entry.txHash ?? "",
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit log failures should not block the user flow
  }
}
