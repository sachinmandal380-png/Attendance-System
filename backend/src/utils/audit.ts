import { db } from "../db";
import { auditLogs } from "../db/schema";

interface AuditParams {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  performedBy?: string | null;
  details?: Record<string, unknown>;
}

export async function writeAuditLog(params: AuditParams) {
  await db.insert(auditLogs).values({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId != null ? String(params.entityId) : null,
    performedBy: params.performedBy ?? null,
    details: params.details ?? null,
  });
}
