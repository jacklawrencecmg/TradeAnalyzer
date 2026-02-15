/**
 * Background Jobs Framework
 *
 * Move heavy work off-request to background jobs.
 * Requests should only read data, not compute it.
 *
 * Jobs:
 * - Advice generation
 * - Alert computation
 * - History snapshots
 * - Market sync
 * - Learning evaluation
 * - Cache warmup
 *
 * Rule: NO expensive work in API requests!
 */

interface Job {
  name: string;
  fn: () => Promise<void>;
  schedule?: string; // cron-style (not implemented here, use external scheduler)
  priority?: number;
}

const jobQueue: Array<{ job: Job; addedAt: number }> = [];
let isProcessing = false;

/**
 * Register background job
 */
export function registerJob(job: Job): void {
  console.log(`📋 Registered job: ${job.name}`);
  jobQueue.push({ job, addedAt: Date.now() });

  // Start processing if not already running
  if (!isProcessing) {
    processJobs();
  }
}

/**
 * Process job queue
 */
async function processJobs(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (jobQueue.length > 0) {
    const { job, addedAt } = jobQueue.shift()!;
    const waitTime = Date.now() - addedAt;

    console.log(`⚙️ Processing job: ${job.name} (waited ${waitTime}ms)`);

    const startTime = Date.now();

    try {
      await job.fn();
      const elapsed = Date.now() - startTime;
      console.log(`✅ Job completed: ${job.name} (${elapsed}ms)`);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Job failed: ${job.name} (${elapsed}ms)`, error);
    }
  }

  isProcessing = false;
}

/**
 * Background job definitions
 */

/**
 * Generate daily advice (background)
 */
export async function generateAdviceJob(): Promise<void> {
  // Import and run advice generation
  const { generateDailyAdvice } = await import('../advice/generateDailyAdvice');
  await generateDailyAdvice();
}

/**
 * Compute alerts (background)
 */
export async function computeAlertsJob(): Promise<void> {
  const { computeAlerts } = await import('../alerts/computeAlerts');
  await computeAlerts();
}

/**
 * Create value history snapshot (background)
 */
export async function snapshotValuesJob(): Promise<void> {
  const { recordValueHistorySnapshot } = await import('../versioning/recordValueHistory');
  await recordValueHistorySnapshot();
}

/**
 * Sync market data (background)
 */
export async function syncMarketJob(): Promise<void> {
  const { syncMarketConsensus } = await import('../market/syncMarketConsensus');
  await syncMarketConsensus();
}

/**
 * Evaluate learning outcomes (background)
 */
export async function evaluateLearningJob(): Promise<void> {
  const { syncWeeklyResults } = await import('../learning/syncWeeklyResults');
  await syncWeeklyResults();
}

/**
 * Warmup cache (background)
 */
export async function warmupCacheJob(format: 'dynasty' | 'redraft'): Promise<void> {
  const { warmupCache } = await import('./epochCache');
  await warmupCache(format);
}

/**
 * Cleanup expired data (background)
 */
export async function cleanupJob(): Promise<void> {
  const { cleanupExpiredCache } = await import('./epochCache');
  const cleaned = cleanupExpiredCache();
  console.log(`Cleaned ${cleaned} cache entries`);

  // Cleanup other expired data
  const { data } = await import('../supabase');
  // Add cleanup logic for snapshots, logs, etc.
}

/**
 * Run health checks (background)
 */
export async function healthCheckJob(): Promise<void> {
  const { runHealthChecks } = await import('../health/runHealthChecks');
  await runHealthChecks();
}

/**
 * Schedule recurring jobs
 *
 * In production, use a proper job scheduler (cron, node-cron, bull, etc.)
 */
export function scheduleRecurringJobs(): void {
  // Every 5 minutes: Compute alerts
  setInterval(
    () => {
      registerJob({
        name: 'compute-alerts',
        fn: computeAlertsJob,
        priority: 1,
      });
    },
    5 * 60 * 1000
  );

  // Every 15 minutes: Generate advice
  setInterval(
    () => {
      registerJob({
        name: 'generate-advice',
        fn: generateAdviceJob,
        priority: 2,
      });
    },
    15 * 60 * 1000
  );

  // Every hour: Sync market data
  setInterval(
    () => {
      registerJob({
        name: 'sync-market',
        fn: syncMarketJob,
        priority: 3,
      });
    },
    60 * 60 * 1000
  );

  // Every 6 hours: Health check
  setInterval(
    () => {
      registerJob({
        name: 'health-check',
        fn: healthCheckJob,
        priority: 1,
      });
    },
    6 * 60 * 60 * 1000
  );

  // Daily at 3 AM: Cleanup
  setInterval(
    () => {
      const now = new Date();
      if (now.getHours() === 3) {
        registerJob({
          name: 'cleanup',
          fn: cleanupJob,
          priority: 3,
        });
      }
    },
    60 * 60 * 1000
  ); // Check every hour

  console.log('✅ Recurring jobs scheduled');
}

/**
 * Manual job triggers (for admin dashboard)
 */
export function triggerAdviceGeneration(): void {
  registerJob({
    name: 'manual-advice-generation',
    fn: generateAdviceJob,
    priority: 1,
  });
}

export function triggerAlertComputation(): void {
  registerJob({
    name: 'manual-alert-computation',
    fn: computeAlertsJob,
    priority: 1,
  });
}

export function triggerMarketSync(): void {
  registerJob({
    name: 'manual-market-sync',
    fn: syncMarketJob,
    priority: 1,
  });
}

export function triggerCacheWarmup(format: 'dynasty' | 'redraft'): void {
  registerJob({
    name: `manual-cache-warmup-${format}`,
    fn: () => warmupCacheJob(format),
    priority: 2,
  });
}

/**
 * Get job queue status
 */
export function getJobQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
  pendingJobs: string[];
} {
  return {
    queueLength: jobQueue.length,
    isProcessing,
    pendingJobs: jobQueue.map((j) => j.job.name),
  };
}

/**
 * Clear job queue (emergency)
 */
export function clearJobQueue(): void {
  jobQueue.length = 0;
  console.warn('⚠️ Job queue cleared');
}

/**
 * Initialize background jobs system
 */
export function initBackgroundJobs(): void {
  console.log('🚀 Initializing background jobs system...');

  // Schedule recurring jobs
  scheduleRecurringJobs();

  // Initial warmup
  registerJob({
    name: 'initial-warmup-dynasty',
    fn: () => warmupCacheJob('dynasty'),
    priority: 1,
  });

  registerJob({
    name: 'initial-warmup-redraft',
    fn: () => warmupCacheJob('redraft'),
    priority: 1,
  });

  console.log('✅ Background jobs system initialized');
}
