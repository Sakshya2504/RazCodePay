import { AuditLog } from '../models/AuditLog.js';

/**
 * Audit writes stay in one service so every important side effect is recorded
 * with the same shape. The audit trail is intentionally separate from the
 * mutable recovery case document.
 */
export async function writeAudit({ merchantId, caseId = null, eventName, details = {}, actorType = 'system', actorId = null }) {
  return AuditLog.create({
    merchantId,
    caseId,
    actorType,
    actorId,
    eventName,
    details,
    occurredAt: new Date(),
  });
}
