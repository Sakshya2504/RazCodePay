import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from './config.js';
import { RecoveryCase } from './models/RecoveryCase.js';
import { WebhookEvent } from './models/WebhookEvent.js';
import { AuditEvent } from './models/AuditEvent.js';
import { Merchant } from './models/Merchant.js';
import { User } from './models/User.js';
import { RazorpayConnection } from './models/RazorpayConnection.js';

const memory = new Map();
const memoryEvents = new Set();
const memoryAudits = [];
const terminal = new Set(['recovered', 'stopped', 'expired']);
const memoryMode = () => config.demoMode || !config.mongodbUri;
const clone = (value) => structuredClone(value);
const normalize = (value) => {
  if (!value) return null;
  const output = value.toObject ? value.toObject({ versionKey: false }) : value;
  if (output._id) output.id = output._id.toString();
  delete output._id;
  return clone(output);
};

function demoCase(index, overrides = {}) {
  const amountMinor = [249900, 499900, 129900, 799900, 199900, 349900, 899900, 159900][index];
  const state = index === 0 || index === 3 ? 'recovered' : index === 6 ? 'stopped' : 'planned';
  return {
    id: `demo-${String(index + 1).padStart(3, '0')}`, caseKey: `demo:${index}`, merchantId: 'demo-merchant',
    type: ['failed_subscription', 'invoice_overdue', 'checkout_abandonment'][index % 3], state,
    amountMinor, currency: 'INR', customer: { id: `cust_${index + 1}`, name: `Demo Customer ${index + 1}`, email: `customer${index + 1}@demo.local` },
    provider: { entityId: `pay_demo_${index + 1}`, orderId: `order_demo_${index + 1}` },
    failure: { code: ['PAYMENT_FAILED', 'CUSTOMER_ACTION_REQUIRED', 'NETWORK_ERROR', 'GATEWAY_ERROR'][index % 4], description: 'Synthetic payment failure for demonstration.' },
    consent: { email: true, sms: false, whatsapp: false }, attemptCount: index === 0 ? 1 : 0,
    attempts: index === 0 ? [{ action: 'send_payment_reminder', channel: 'email', status: 'sent_test_mode', providerReference: 'demo-message-recovered' }] : [],
    riskScore: [0.72, 0.48, 0.63, 0.81, 0.55, 0.68, 0.91, 0.44][index], recoverabilityScore: [0.84, 0.62, 0.71, 0.89, 0.66, 0.76, 0.21, 0.58][index],
    ai: { source: 'local-model', modelVersion: 'local-recovery-v1', recommendation: state === 'stopped' ? 'create_human_task' : 'send_payment_reminder', confidence: [0.91, 0.86, 0.8, 0.93, 0.78, 0.88, 0.96, 0.82][index], reasonCodes: ['fresh_event', 'recoverable_failure', 'consent_available'], explanation: 'Synthetic model decision for the demo cohort.' },
    nextActionAt: new Date(Date.now() + 30 * 60000), recoveredAmountMinor: state === 'recovered' ? amountMinor : 0,
    recoveredProviderId: state === 'recovered' ? `pay_demo_${index + 1}` : null, openedAt: new Date(Date.now() - (index + 1) * 3600000),
    closedAt: terminal.has(state) ? new Date() : null, stopReason: state === 'stopped' ? 'merchant_demo_stop' : null, ...overrides,
  };
}

export async function initializeStore() {
  if (memoryMode()) return 'memory';
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20, autoIndex: true });
  await Promise.all([Merchant.init(), User.init(), RecoveryCase.init(), WebhookEvent.init(), AuditEvent.init(), RazorpayConnection.init()]);
  return 'mongodb';
}

export async function listCases(merchantId) {
  if (memoryMode()) {
    if (!memory.has(merchantId)) memory.set(merchantId, merchantId === 'demo-merchant' ? Array.from({ length: 8 }, (_, i) => demoCase(i)) : []);
    return clone([...memory.get(merchantId)].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)));
  }
  return (await RecoveryCase.find({ merchantId }).sort({ openedAt: -1 }).limit(200).lean()).map(normalize);
}

export async function getCase(merchantId, caseId) {
  if (memoryMode()) return clone((await listCases(merchantId)).find((item) => item.id === caseId) || null);
  if (!mongoose.Types.ObjectId.isValid(caseId)) return null;
  return normalize(await RecoveryCase.findOne({ _id: caseId, merchantId }));
}

export async function addCase(merchantId, item) {
  if (memoryMode()) {
    const value = { ...clone(item), id: item.id || `case-live-${randomUUID().slice(0, 8)}`, merchantId };
    ensureMemory(merchantId).push(value);
    return clone(value);
  }
  return normalize(await RecoveryCase.create({ ...clone(item), merchantId }));
}
function ensureMemory(merchantId) { if (!memory.has(merchantId)) memory.set(merchantId, merchantId === 'demo-merchant' ? Array.from({ length: 8 }, (_, i) => demoCase(i)) : []); return memory.get(merchantId); }

export async function updateCase(merchantId, caseId, patch) {
  if (memoryMode()) {
    const rows = await listCases(merchantId); const target = rows.find((item) => item.id === caseId); if (!target) return null;
    Object.assign(target, clone(patch), { updatedAt: new Date() }); memory.set(merchantId, rows); return clone(target);
  }
  if (!mongoose.Types.ObjectId.isValid(caseId)) return null;
  return normalize(await RecoveryCase.findOneAndUpdate({ _id: caseId, merchantId }, { $set: clone(patch) }, { new: true }));
}

export async function resetDemo(merchantId) {
  const items = Array.from({ length: 60 }, (_, i) => demoCase(i % 8, {
    caseKey: `demo-batch:${i}`,
    state: i % 10 === 0 ? 'recovered' : i % 17 === 0 ? 'stopped' : 'planned',
    amountMinor: [9900, 24900, 49900, 99900, 149900, 249900, 499900, 799900][i % 8],
    riskScore: Number((0.35 + ((i * 13) % 60) / 100).toFixed(2)), recoverabilityScore: Number((0.45 + ((i * 17) % 50) / 100).toFixed(2)),
    recoveredAmountMinor: i % 10 === 0 ? [9900, 24900, 49900][i % 3] : 0, closedAt: i % 10 === 0 || i % 17 === 0 ? new Date() : null,
  }));
  if (memoryMode()) memory.set(merchantId, items); else { await RecoveryCase.deleteMany({ merchantId }); await RecoveryCase.insertMany(items.map((item) => ({ ...item, merchantId, _id: new mongoose.Types.ObjectId() }))); }
  return listCases(merchantId);
}

export async function summarize(merchantId) {
  const cases = await listCases(merchantId); const active = cases.filter((item) => !terminal.has(item.state)); const recovered = cases.filter((item) => item.state === 'recovered');
  return { totalCases: cases.length, activeCases: active.length, recoveredCases: recovered.length, stoppedCases: cases.filter((item) => item.state === 'stopped').length, expiredCases: cases.filter((item) => item.state === 'expired').length, revenueAtRiskMinor: active.reduce((sum, item) => sum + item.amountMinor, 0), recoveredRevenueMinor: cases.reduce((sum, item) => sum + (item.recoveredAmountMinor || 0), 0), recoveryRate: cases.length ? recovered.length / cases.length : 0, attempts: cases.reduce((sum, item) => sum + (item.attemptCount || 0), 0), estimatedHoursSaved: Math.round(cases.length * 0.35 * 10) / 10 };
}

export async function recordEvent(key, value) {
  if (memoryMode()) { if (memoryEvents.has(key)) return false; memoryEvents.add(key); return true; }
  try { await WebhookEvent.create(value); return true; } catch (error) { if (error.code === 11000) return false; throw error; }
}
export async function addAudit(entry) { if (memoryMode()) { memoryAudits.push({ id: randomUUID(), createdAt: new Date(), ...clone(entry) }); return; } await AuditEvent.create(entry); }
export async function listAudits(merchantId) { if (memoryMode()) return clone(memoryAudits.filter((item) => item.merchantId === merchantId).slice(-100).reverse()); return (await AuditEvent.find({ merchantId }).sort({ createdAt: -1 }).limit(100).lean()).map(normalize); }
export async function findUserByEmail(email) { if (memoryMode()) return null; return User.findOne({ email: email.toLowerCase() }).select('+passwordHash'); }
export async function createUser({ name, email, passwordHash, merchantName, slug }) { if (memoryMode()) throw new Error('Registration requires MongoDB and DEMO_MODE=false.'); const merchant = await Merchant.create({ name: merchantName, slug }); const user = await User.create({ name, email: email.toLowerCase(), passwordHash, merchantId: merchant._id }); return { user, merchant }; }
export async function getMerchant(merchantId) { if (memoryMode()) return { id: merchantId, name: 'Demo Merchant', policy: {} }; if (!mongoose.Types.ObjectId.isValid(merchantId)) return null; return Merchant.findById(merchantId).lean(); }
export async function saveRazorpayConnection(merchantId, value) { if (memoryMode()) return value; return RazorpayConnection.findOneAndUpdate({ merchantId }, { $set: value }, { upsert: true, new: true }).lean(); }
export async function getRazorpayConnection(merchantId) { if (memoryMode()) return null; if (!mongoose.Types.ObjectId.isValid(merchantId)) return null; return RazorpayConnection.findOne({ merchantId }); }
export async function clearStore() { memory.clear(); memoryEvents.clear(); memoryAudits.length = 0; }
export const resetStore = clearStore;
