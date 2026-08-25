import "server-only";

import type { PoolClient } from "pg";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";

type AuditEntry = {
  hotelTenantId: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: unknown;
};

export function recordAuditLog(client: PoolClient, entry: AuditEntry) {
  return client.query(
    `INSERT INTO audit_logs (hotel_tenant_id, actor_id, action, entity_type, entity_id, changes)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [entry.hotelTenantId, entry.actorId, entry.action, entry.entityType, entry.entityId ?? null, JSON.stringify(entry.changes ?? null)],
  );
}
