import { RecoveryCase } from './models/RecoveryCase.js';
import { evaluateCase } from './services/recovery.js';
import { executeRecoveryAttempt } from './services/executor.js';

const POLL_INTERVAL_MS = 60_000;
let timer = null;
let running = false;

/**
 * MongoDB is enough for the hackathon scheduler. A separate queue can replace
 * this loop later without changing case or policy logic.
 */
export function startRecoveryWorker() {
  if (timer) return;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      const dueCases = await RecoveryCase.find({
        state: { $in: ['awaiting_window', 'planned'] },
        nextActionAt: { $lte: new Date() },
      })
        .sort({ nextActionAt: 1 })
        .limit(20);

      for (const recoveryCase of dueCases) {
        try {
          const result = await evaluateCase(recoveryCase);
          if (result.decision?.recommendedAction === 'send_payment_reminder') {
            await executeRecoveryAttempt(recoveryCase._id, recoveryCase.merchantId);
          }
        } catch (error) {
          console.warn(`Worker skipped case ${recoveryCase._id}: ${error.message}`);
        }
      }
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, POLL_INTERVAL_MS);
  tick().catch((error) => console.warn(`Initial recovery worker tick failed: ${error.message}`));
  console.log('Recovery worker started.');
}

export function stopRecoveryWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
