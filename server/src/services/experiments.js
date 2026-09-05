import crypto from 'node:crypto';
import { createExperiment, listExperiments, updateExperiment, getExperimentMetrics } from '../store.js';

export function pickArm(caseId, experiment) {
  if (!experiment?.arms?.length || experiment.status !== 'running') return null;
  const bucket = parseInt(crypto.createHash('sha256').update(String(caseId)).digest('hex').slice(0, 8), 16) / 0xffffffff;
  let cursor = 0;
  for (const arm of experiment.arms) {
    cursor += arm.allocation;
    if (bucket <= cursor) return arm;
  }
  return experiment.arms[experiment.arms.length - 1];
}

export async function listActiveExperiment(merchantId) {
  const items = await listExperiments(merchantId);
  return items.find((item) => item.status === 'running') || null;
}

export async function createRecoveryExperiment(merchantId, input) {
  const total = (input.arms || []).reduce((sum, arm) => sum + Number(arm.allocation || 0), 0);
  if (Math.abs(total - 1) > 0.001) throw new Error('Experiment arm allocations must sum to 1.');
  return createExperiment(merchantId, { ...input, status: 'draft' });
}

export async function startExperiment(merchantId, experimentId) {
  return updateExperiment(merchantId, experimentId, { status: 'running', startedAt: new Date() });
}

export async function stopExperiment(merchantId, experimentId) {
  return updateExperiment(merchantId, experimentId, { status: 'completed', endedAt: new Date() });
}

export async function metrics(merchantId) {
  return getExperimentMetrics(merchantId);
}
