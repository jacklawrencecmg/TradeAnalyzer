/**
 * Automatic Rollback System
 *
 * Automatically rolls back to last known good state when:
 * - Error rate > 5%
 * - Value mismatch detected
 * - Rebuild fails twice
 *
 * Actions:
 * - Enable maintenance mode
 * - Restore last snapshot
 * - Alert admins
 */

import { supabase } from '../supabase';
import { enableSafeMode } from './safeMode';
import { logAdminAction, alertCriticalEvent } from '../security/auditLog';
import { rollbackSnapshot } from '../versioning/rollbackSnapshot';

export interface RollbackTrigger {
  type: 'error_rate' | 'value_mismatch' | 'rebuild_failure' | 'manual';
  threshold: number;
  actual: number;
  message: string;
}

export interface RollbackResult {
  triggered: boolean;
  reason?: string;
  snapshotRestored?: string;
  timestamp: string;
}

/**
 * Check if error rate exceeds threshold
 */
async function checkErrorRate(): Promise<RollbackTrigger | null> {
  try {
    // Get recent requests (last 5 minutes)
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: logs } = await supabase
      .from('admin_audit_log')
      .select('success')
      .gte('created_at', since);

    if (!logs || logs.length === 0) {
      return null;
    }

    const total = logs.length;
    const errors = logs.filter((l) => !l.success).length;
    const errorRate = (errors / total) * 100;

    if (errorRate > 5) {
      return {
        type: 'error_rate',
        threshold: 5,
        actual: errorRate,
        message: `Error rate ${errorRate.toFixed(1)}% exceeds 5% threshold (${errors}/${total} requests)`,
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking error rate:', error);
    return null;
  }
}

/**
 * Check for value mismatch
 */
async function checkValueMismatch(): Promise<RollbackTrigger | null> {
  try {
    const { data: healthChecks } = await supabase
      .from('system_health_checks')
      .select('*')
      .eq('check_type', 'value_integrity')
      .eq('status', 'critical')
      .gte('checked_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1);

    if (healthChecks && healthChecks.length > 0) {
      return {
        type: 'value_mismatch',
        threshold: 0,
        actual: 1,
        message: 'Critical value integrity check failed',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking value mismatch:', error);
    return null;
  }
}

/**
 * Check for rebuild failures
 */
async function checkRebuildFailures(): Promise<RollbackTrigger | null> {
  try {
    const { data: failures } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'rebuild_failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(2);

    if (failures && failures.length >= 2) {
      return {
        type: 'rebuild_failure',
        threshold: 2,
        actual: failures.length,
        message: `${failures.length} rebuild failures in last hour`,
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking rebuild failures:', error);
    return null;
  }
}

/**
 * Check all rollback triggers
 */
export async function checkRollbackTriggers(): Promise<RollbackTrigger | null> {
  // Check each trigger
  const errorRate = await checkErrorRate();
  if (errorRate) return errorRate;

  const valueMismatch = await checkValueMismatch();
  if (valueMismatch) return valueMismatch;

  const rebuildFailures = await checkRebuildFailures();
  if (rebuildFailures) return rebuildFailures;

  return null;
}

/**
 * Execute automatic rollback
 */
export async function executeAutomaticRollback(
  trigger: RollbackTrigger
): Promise<RollbackResult> {
  const startTime = Date.now();

  try {
    console.log('🚨 AUTOMATIC ROLLBACK TRIGGERED');
    console.log(`   Reason: ${trigger.message}`);

    // 1. Enable safe mode
    await enableSafeMode(`Automatic rollback: ${trigger.message}`);

    // 2. Alert admins
    await alertCriticalEvent('Automatic rollback triggered', {
      trigger: trigger.type,
      threshold: trigger.threshold,
      actual: trigger.actual,
      message: trigger.message,
    });

    // 3. Get last good snapshot
    const { data: lastSnapshot } = await supabase
      .from('system_snapshots')
      .select('*')
      .eq('status', 'healthy')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSnapshot) {
      console.error('❌ No healthy snapshot found for rollback');

      await logAdminAction({
        action: 'rollback',
        actor: 'system',
        success: false,
        errorMessage: 'No healthy snapshot found',
        metadata: { trigger },
      });

      return {
        triggered: true,
        reason: trigger.message,
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Restore snapshot
    console.log(`   Restoring snapshot: ${lastSnapshot.id}`);

    await rollbackSnapshot(lastSnapshot.id);

    // 5. Log success
    const duration = Date.now() - startTime;

    await logAdminAction({
      action: 'rollback',
      actor: 'system',
      success: true,
      metadata: {
        trigger,
        snapshot_id: lastSnapshot.id,
        duration_ms: duration,
      },
    });

    console.log(`✅ Automatic rollback completed in ${duration}ms`);

    return {
      triggered: true,
      reason: trigger.message,
      snapshotRestored: lastSnapshot.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Automatic rollback failed:', error);

    await logAdminAction({
      action: 'rollback',
      actor: 'system',
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: { trigger },
    });

    return {
      triggered: true,
      reason: trigger.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Monitor and auto-rollback (run periodically)
 */
export async function monitorAndRollback(): Promise<void> {
  const trigger = await checkRollbackTriggers();

  if (trigger) {
    console.log('🚨 Rollback trigger detected:', trigger.message);
    await executeAutomaticRollback(trigger);
  }
}

/**
 * Get rollback history
 */
export async function getRollbackHistory(limit: number = 20): Promise<
  Array<{
    id: string;
    trigger: string;
    snapshotRestored: string | null;
    timestamp: string;
    success: boolean;
  }>
> {
  try {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'rollback')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((log) => ({
      id: log.id,
      trigger: log.metadata?.trigger?.message || 'Unknown',
      snapshotRestored: log.metadata?.snapshot_id || null,
      timestamp: log.created_at,
      success: log.success,
    }));
  } catch (error) {
    console.error('Error getting rollback history:', error);
    return [];
  }
}

/**
 * Manual rollback (admin triggered)
 */
export async function manualRollback(
  reason: string,
  snapshotId?: string
): Promise<RollbackResult> {
  const trigger: RollbackTrigger = {
    type: 'manual',
    threshold: 0,
    actual: 0,
    message: `Manual rollback: ${reason}`,
  };

  // If snapshot ID provided, use it; otherwise use last healthy
  if (snapshotId) {
    await enableSafeMode(trigger.message);

    await rollbackSnapshot(snapshotId);

    await logAdminAction({
      action: 'rollback',
      actor: 'admin',
      success: true,
      metadata: {
        trigger,
        snapshot_id: snapshotId,
        manual: true,
      },
    });

    return {
      triggered: true,
      reason: trigger.message,
      snapshotRestored: snapshotId,
      timestamp: new Date().toISOString(),
    };
  }

  return executeAutomaticRollback(trigger);
}

/**
 * Check if system needs rollback
 */
export async function needsRollback(): Promise<{
  needed: boolean;
  trigger?: RollbackTrigger;
}> {
  const trigger = await checkRollbackTriggers();

  return {
    needed: trigger !== null,
    trigger: trigger || undefined,
  };
}

/**
 * Get rollback status
 */
export async function getRollbackStatus(): Promise<{
  lastRollback: string | null;
  rollbackCount24h: number;
  currentlyInSafeMode: boolean;
}> {
  try {
    // Get last rollback
    const { data: lastRollback } = await supabase
      .from('admin_audit_log')
      .select('created_at')
      .eq('action', 'rollback')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count rollbacks in last 24h
    const { data: recentRollbacks } = await supabase
      .from('admin_audit_log')
      .select('id')
      .eq('action', 'rollback')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check safe mode status
    const { data: safeMode } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'system_mode')
      .maybeSingle();

    return {
      lastRollback: lastRollback?.created_at || null,
      rollbackCount24h: recentRollbacks?.length || 0,
      currentlyInSafeMode: safeMode?.value === 'maintenance',
    };
  } catch (error) {
    console.error('Error getting rollback status:', error);
    return {
      lastRollback: null,
      rollbackCount24h: 0,
      currentlyInSafeMode: false,
    };
  }
}
