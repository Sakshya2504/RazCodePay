import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.js';
import { initializeStore } from './store.js';
import { evaluateCase } from './services/recovery.js';
import { executeRecoveryAttempt } from './services/executor.js';

if (!config.redisUrl || config.demoMode) {
  console.log('Recovery worker disabled. Set DEMO_MODE=false and REDIS_URL to enable background jobs.');
  process.exit(0);
}

await initializeStore();
const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
const worker = new Worker('razcodepay-recovery', async (job) => {
  const { merchantId, caseId, operation } = job.data;
  if (!merchantId || !caseId) throw new Error('Recovery job requires merchantId and caseId.');
  if (operation === 'execute') return executeRecoveryAttempt(merchantId, caseId);
  return evaluateCase(merchantId, caseId);
}, { connection, concurrency: 10 });

worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
worker.on('failed', (job, error) => console.error(`[worker] failed ${job?.id}: ${error.message}`));
process.on('SIGTERM', async () => { await worker.close(); await connection.quit(); process.exit(0); });
process.on('SIGINT', async () => { await worker.close(); await connection.quit(); process.exit(0); });
console.log('RazCodePay recovery worker → Redis/BullMQ');
