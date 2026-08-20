import {createClientFromRequest} from "npm:@base44/sdk";

const VALID_ENTITIES = [
  "Vault", "Transaction", "AuditLog", "Policy", "Agent", "AllowlistEntry",
  "AgentBudget", "SpendIntent", "RiskAssessment", "ApprovalRequest", "SpendingReceipt",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {entity, filter, sort, limit} = await req.json();

    if (!entity || !VALID_ENTITIES.includes(entity)) {
      return Response.json({ok: false, error: `Invalid entity. Must be one of: ${VALID_ENTITIES.join(", ")}`}, {status: 400});
    }

    const entities = base44.asServiceRole.entities[entity as keyof typeof base44.asServiceRole.entities];
    let result: Record<string, unknown>[];

    if (filter && Object.keys(filter).length > 0) {
      result = await (entities as any).filter(filter, sort || "-created_at", limit || 100);
    } else {
      result = await (entities as any).list(sort || "-created_at", limit || 100);
    }

    return Response.json({ok: true, data: result});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
