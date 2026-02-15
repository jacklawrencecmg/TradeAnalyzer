/**
 * Rebuild Watchdog
 *
 * Monitors rebuild status and triggers automatic rebuilds when needed.
 *
 * Logic:
 * - If now - last_successful_rebuild > 36 hours → trigger automatic rebuild
 * - If rebuild fails twice consecutively → lock values + alert
 * - Tracks rebuild duration and errors
 */

import { supabase } from '../supabase';

export interface RebuildStatus {
  lastSuccessful: string | null;
  lastAttempt: string;
  status: 'success' | 'failed' | 'in_progress';
  durationMs: number | null;
  errorMessage: string | null;
  isStale: boolean;
  hoursSinceSuccess: number | null;
}

export interface RebuildHealth {
  isHealthy: boolean;
  status: RebuildStatus | null;
  consecutiveFailures: number;
  shouldTriggerRebuild: boolean;
  shouldLockValues: boolean;
  message: string;
}

const STALE_THRESHOLD_HOURS = 36;
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Check rebuild health
 */
export async function checkRebuildHealth(): Promise<RebuildHealth> {
  try {
    // Get latest rebuild status
    const status = await getLatestRebuildStatus();

    if (!status) {
      return {
        isHealthy: false,
        status: null,
        consecutiveFailures: 0,
        shouldTriggerRebuild: true,
        shouldLockValues: false,
        message: 'No rebuild history found - should trigger initial rebuild',
      };
    }

    // Check for consecutive failures
    const consecutiveFailures = await getConsecutiveFailures();

    // Determine actions
    const shouldTriggerRebuild = status.isStale && consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
    const shouldLockValues = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

    let isHealthy = true;
    let message = 'Rebuild system healthy';

    if (shouldLockValues) {
      isHealthy = false;
      message = `${consecutiveFailures} consecutive rebuild failures - values locked`;

      // Trigger safe mode
      await triggerSafeMode('rebuild_failures', {
        consecutiveFailures,
        lastError: status.errorMessage,
      });

      // Create critical alert
      await supabase.from('system_alerts').insert({
        severity: 'critical',
        message: `Rebuild system locked after ${consecutiveFailures} consecutive failures`,
        alert_type: 'rebuild_locked',
        metadata: {
          consecutiveFailures,
          lastError: status.errorMessage,
        },
      });
    } else if (status.isStale) {
      isHealthy = false;
      message = `Rebuild is stale (${status.hoursSinceSuccess?.toFixed(1)} hours old) - should trigger rebuild`;
    } else if (status.status === 'failed') {
      isHealthy = false;
      message = `Last rebuild failed: ${status.errorMessage || 'Unknown error'}`;
    }

    return {
      isHealthy,
      status,
      consecutiveFailures,
      shouldTriggerRebuild,
      shouldLockValues,
      message,
    };
  } catch (error) {
    console.error('Error checking rebuild health:', error);

    return {
      isHealthy: false,
      status: null,
      consecutiveFailures: 0,
      shouldTriggerRebuild: false,
      shouldLockValues: true,
      message: 'Error checking rebuild health',
    };
  }
}

/**
 * Get latest rebuild status
 */
export async function getLatestRebuildStatus(): Promise<RebuildStatus | null> {
  try {
    const { data } = await supabase
      .from('rebuild_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const lastSuccessful = data.last_successful_rebuild;
    const now = new Date();
    const hoursSinceSuccess = lastSuccessful
      ? (now.getTime() - new Date(lastSuccessful).getTime()) / (1000 * 60 * 60)
      : null;

    const isStale = hoursSinceSuccess ? hoursSinceSuccess > STALE_THRESHOLD_HOURS : true;

    return {
      lastSuccessful: data.last_successful_rebuild,
      lastAttempt: data.last_attempt,
      status: data.status,
      durationMs: data.duration_ms,
      errorMessage: data.error_message,
      isStale,
      hoursSinceSuccess,
    };
  } catch (error) {
    console.error('Error getting rebuild status:', error);
    return null;
  }
}

/**
 * Get consecutive failure count
 */
async function getConsecutiveFailures(): Promise<number> {
  try {
    const { data: recentBuilds } = await supabase
      .from('rebuild_status')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentBuilds || recentBuilds.length === 0) return 0;

    let consecutiveFailures = 0;
    for (const build of recentBuilds) {
      if (build.status === 'failed') {
        consecutiveFailures++;
      } else {
        break; // Stop at first non-failure
      }
    }

    return consecutiveFailures;
  } catch (error) {
    console.error('Error getting consecutive failures:', error);
    return 0;
  }
}

/**
 * Record rebuild attempt
 */
export async function recordRebuildAttempt(
  status: 'success' | 'failed' | 'in_progress',
  durationMs?: number,
  errorMessage?: string
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('record_rebuild_attempt', {
      p_status: status,
      p_duration_ms: durationMs,
      p_error_message: errorMessage,
    });

    if (error) {
      console.error('Error recording rebuild attempt:', error);
      return null;
    }

    // Check health after recording
    const health = await checkRebuildHealth();

    if (!health.isHealthy) {
      console.warn('Rebuild health check failed:', health.message);
    }

    return 'success';
  } catch (error) {
    console.error('Error recording rebuild attempt:', error);
    return null;
  }
}

/**
 * Check if rebuild is stale
 */
export async function isRebuildStale(thresholdHours: number = STALE_THRESHOLD_HOURS): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_rebuild_stale', {
      p_threshold_hours: thresholdHours,
    });

    if (error) {
      console.error('Error checking if rebuild is stale:', error);
      return true; // Assume stale on error
    }

    return data === true;
  } catch (error) {
    console.error('Error checking if rebuild is stale:', error);
    return true;
  }
}

/**
 * Trigger automatic rebuild
 */
export async function triggerAutomaticRebuild(): Promise<boolean> {
  try {
    const health = await checkRebuildHealth();

    if (health.shouldLockValues) {
      console.error('Cannot trigger rebuild: values are locked due to consecutive failures');
      return false;
    }

    if (!health.shouldTriggerRebuild) {
      console.log('Rebuild not needed:', health.message);
      return false;
    }

    // Record rebuild start
    await recordRebuildAttempt('in_progress');

    console.log('Triggering automatic rebuild...');

    // Create alert
    await supabase.from('system_alerts').insert({
      severity: 'info',
      message: 'Automatic rebuild triggered due to stale data',
      alert_type: 'auto_rebuild_triggered',
      metadata: {
        reason: health.message,
        hoursSinceSuccess: health.status?.hoursSinceSuccess,
      },
    });

    // TODO: Actually trigger rebuild
    // This would call your rebuild logic (buildTop1000, etc.)

    return true;
  } catch (error) {
    console.error('Error triggering automatic rebuild:', error);
    await recordRebuildAttempt('failed', undefined, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Trigger safe mode
 */
async function triggerSafeMode(reason: string, metadata: any) {
  try {
    // Check if safe mode table exists and has data
    const { data: existingMode } = await supabase
      .from('system_safe_mode')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingMode) {
      // Update existing row
      await supabase
        .from('system_safe_mode')
        .update({
          enabled: true,
          reason: `Rebuild failures: ${reason}`,
          critical_issues: metadata,
          enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMode.id);
    } else {
      // Insert new row
      await supabase.from('system_safe_mode').insert({
        enabled: true,
        reason: `Rebuild failures: ${reason}`,
        critical_issues: metadata,
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    console.error('SAFE MODE ACTIVATED:', reason);
  } catch (error) {
    console.error('Error triggering safe mode:', error);
  }
}

/**
 * Get rebuild history
 */
export async function getRebuildHistory(limit: number = 10): Promise<RebuildStatus[]> {
  try {
    const { data } = await supabase
      .from('rebuild_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((d) => {
      const lastSuccessful = d.last_successful_rebuild;
      const now = new Date();
      const hoursSinceSuccess = lastSuccessful
        ? (now.getTime() - new Date(lastSuccessful).getTime()) / (1000 * 60 * 60)
        : null;

      const isStale = hoursSinceSuccess ? hoursSinceSuccess > STALE_THRESHOLD_HOURS : true;

      return {
        lastSuccessful: d.last_successful_rebuild,
        lastAttempt: d.last_attempt,
        status: d.status,
        durationMs: d.duration_ms,
        errorMessage: d.error_message,
        isStale,
        hoursSinceSuccess,
      };
    });
  } catch (error) {
    console.error('Error getting rebuild history:', error);
    return [];
  }
}

/**
 * Get rebuild statistics
 */
export async function getRebuildStatistics(): Promise<{
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  lastSuccess: string | null;
  lastFailure: string | null;
}> {
  try {
    const { data } = await supabase
      .from('rebuild_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!data || data.length === 0) {
      return {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgDuration: 0,
        lastSuccess: null,
        lastFailure: null,
      };
    }

    const successCount = data.filter((d) => d.status === 'success').length;
    const failureCount = data.filter((d) => d.status === 'failed').length;
    const successRate = (successCount / data.length) * 100;

    const durations = data.filter((d) => d.duration_ms).map((d) => d.duration_ms);
    const avgDuration = durations.length > 0
      ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length
      : 0;

    const lastSuccess = data.find((d) => d.status === 'success')?.last_successful_rebuild || null;
    const lastFailure = data.find((d) => d.status === 'failed')?.created_at || null;

    return {
      totalAttempts: data.length,
      successCount,
      failureCount,
      successRate: Math.round(successRate * 10) / 10,
      avgDuration: Math.round(avgDuration),
      lastSuccess,
      lastFailure,
    };
  } catch (error) {
    console.error('Error getting rebuild statistics:', error);
    return {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgDuration: 0,
      lastSuccess: null,
      lastFailure: null,
    };
  }
}
