import {createClientFromRequest} from "npm:@base44/sdk";

const VALID_ENTITIES = ["Vault", "Transaction", "AuditLog", "Policy", "Agent", "AllowlistEntry"];

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("[queryEntities] received body:", JSON.stringify(body));

    const base44 = createClientFromRequest(req);
    const {entity, filter, sort, limit} = body;

    if (!entity || !VALID_ENTITIES.includes(entity)) {
      console.log("[queryEntities] invalid entity:", entity);
      return Response.json({ok: false, error: `Invalid entity. Must be one of: ${VALID_ENTITIES.join(", ")}`}, {status: 400});
    }

    const entities = base44.asServiceRole.entities[entity as keyof typeof base44.asServiceRole.entities];
    console.log("[queryEntities] entities object:", typeof entities, Object.keys(entities || {}));
    let result: Record<string, unknown>[];

    if (filter && Object.keys(filter).length > 0) {
      result = await (entities as any).filter(filter, sort || "-created_at", limit || 100);
    } else {
      result = await (entities as any).list(sort || "-created_at", limit || 100);
    }

    console.log("[queryEntities] result count:", result.length);
    return Response.json({ok: true, data: result});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[queryEntities] error:", msg);
    return Response.json({ok: false, error: msg}, {status: 500});
  }
});
