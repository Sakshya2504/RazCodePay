import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.js';

export function queueEnabled() {
  return Boolean(config.redisUrl) && !config.demoMode;
}

let connection;
let recoveryQueue;

export function getRecoveryQueue() {
  if (!queueEnabled()) return null;
  if (!connection) connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
  if (!recoveryQueue) recoveryQueue = new Queue('razcodepay-recovery', { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 } });
  return recoveryQueue;
}

export async function enqueueRecoveryJob(data, options = {}) {
  const queue = getRecoveryQueue();
  if (!queue) return { queued: false, reason: 'queue_disabled' };
  const job = await queue.add(data.type || 'recovery', data, { jobId: options.jobId, delay: options.delayMs || 0 });
  return { queued: true, jobId: job.id };
}
