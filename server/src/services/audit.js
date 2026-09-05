import { addAudit } from '../store.js';

export async function writeAudit({ merchantId, caseId = null, eventName, details = {} }) {
  addAudit({ merchantId, caseId: caseId?.toString?.() ?? caseId, eventName, details });
}
