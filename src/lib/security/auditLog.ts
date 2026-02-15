/**
 * Admin Audit Logging
 *
 * Track all admin actions for accountability and debugging.
 *
 * Logged Actions:
 * - Rebuild started/completed
 * - Sync started/completed
 * - Rollback
 * - Doctor repair actions
 * - Profile changes
 * - Security events
 */

import { supabase } from '../supabase';

export type AuditAction =
  | 'rebuild_started'
  | 'rebuild_completed'
  | 'rebuild_failed'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'rollback'
  | 'doctor_audit'
  | 'doctor_repair'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_deleted'
  | 'cache_cleared'
  | 'rate_limit_cleared'
  | 'ip_blocked'
  | 'ip_unblocked'
  | 'security_event'
  | 'manual_value_adjustment'
  | 'data_export';

export interface AuditLogEntry {
  action: AuditAction;
  actor: string;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log admin action
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      action: entry.action,
      actor: entry.actor,
      metadata: entry.metadata || {},
      success: entry.success !== false, // Default to true
      error_message: entry.errorMessage,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log admin action:', error);
    }

    // Also console log for immediate visibility
    const emoji = entry.success !== false ? '✅' : '❌';
    console.log(`${emoji} [AUDIT] ${entry.actor} → ${entry.action}`, entry.metadata || '');
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

/**
 * Log rebuild action
 */
export async function logRebuild(
  actor: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, any>
): Promise<void> {
  await logAdminAction({
    action: `rebuild_${status}` as AuditAction,
    actor,
    metadata,
    success: status === 'completed',
  });
}

/**
 * Log sync action
 */
export async function logSync(
  actor: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, any>
): Promise<void> {
  await logAdminAction({
    action: `sync_${status}` as AuditAction,
    actor,
    metadata,
    success: status === 'completed',
  });
}

/**
 * Log doctor action
 */
export async function logDoctor(
  actor: string,
  type: 'audit' | 'repair',
  metadata?: Record<string, any>
): Promise<void> {
  await logAdminAction({
    action: `doctor_${type}` as AuditAction,
    actor,
    metadata,
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  event: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAdminAction({
    action: 'security_event',
    actor: 'system',
    metadata: {
      event,
      ...metadata,
    },
  });

  // Security events should also alert
  console.warn('🚨 SECURITY EVENT:', event, metadata);
}

/**
 * Get audit logs (admin dashboard)
 */
export async function getAuditLogs(
  limit: number = 100,
  offset: number = 0,
  action?: AuditAction
): Promise<
  Array<{
    id: string;
    action: AuditAction;
    actor: string;
    metadata: Record<string, any>;
    success: boolean;
    errorMessage: string | null;
    createdAt: string;
  }>
> {
  try {
    let query = supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      metadata: row.metadata || {},
      success: row.success,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return [];
  }
}

/**
 * Get audit stats
 */
export async function getAuditStats(
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<{
  totalActions: number;
  successRate: number;
  byAction: Record<string, number>;
  byActor: Record<string, number>;
  recentFailures: number;
}> {
  try {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('action, actor, success')
      .gte('created_at', since.toISOString());

    if (!data || data.length === 0) {
      return {
        totalActions: 0,
        successRate: 0,
        byAction: {},
        byActor: {},
        recentFailures: 0,
      };
    }

    const totalActions = data.length;
    const successCount = data.filter((row) => row.success).length;
    const successRate = (successCount / totalActions) * 100;

    const byAction: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    let recentFailures = 0;

    data.forEach((row) => {
      byAction[row.action] = (byAction[row.action] || 0) + 1;
      byActor[row.actor] = (byActor[row.actor] || 0) + 1;

      if (!row.success) {
        recentFailures++;
      }
    });

    return {
      totalActions,
      successRate,
      byAction,
      byActor,
      recentFailures,
    };
  } catch (error) {
    console.error('Error getting audit stats:', error);
    return {
      totalActions: 0,
      successRate: 0,
      byAction: {},
      byActor: {},
      recentFailures: 0,
    };
  }
}

/**
 * Get recent failures (for alerting)
 */
export async function getRecentFailures(limit: number = 20): Promise<
  Array<{
    action: AuditAction;
    actor: string;
    errorMessage: string | null;
    createdAt: string;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('action, actor, error_message, created_at')
      .eq('success', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching failures:', error);
      return [];
    }

    return (data || []).map((row) => ({
      action: row.action,
      actor: row.actor,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting failures:', error);
    return [];
  }
}

/**
 * Search audit logs
 */
export async function searchAuditLogs(
  query: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    action: AuditAction;
    actor: string;
    metadata: Record<string, any>;
    createdAt: string;
  }>
> {
  try {
    // Search in action, actor, or metadata
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id, action, actor, metadata, created_at')
      .or(`action.ilike.%${query}%,actor.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching audit logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error searching audit logs:', error);
    return [];
  }
}

/**
 * Log with performance timing
 */
export async function logTimedAction<T>(
  actor: string,
  action: AuditAction,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const elapsed = Date.now() - startTime;

    await logAdminAction({
      action,
      actor,
      metadata: {
        ...metadata,
        duration_ms: elapsed,
      },
      success: true,
    });

    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;

    await logAdminAction({
      action,
      actor,
      metadata: {
        ...metadata,
        duration_ms: elapsed,
      },
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Alert on critical events
 */
export async function alertCriticalEvent(
  event: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Log to audit
  await logSecurityEvent(event, metadata);

  // Create system alert
  try {
    await supabase.from('system_alerts').insert({
      severity: 'critical',
      message: `SECURITY: ${event}`,
      alert_type: 'security',
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Failed to create system alert:', error);
  }
}

/**
 * Batch log multiple actions (for performance)
 */
export async function logBatch(entries: AuditLogEntry[]): Promise<void> {
  try {
    const rows = entries.map((entry) => ({
      action: entry.action,
      actor: entry.actor,
      metadata: entry.metadata || {},
      success: entry.success !== false,
      error_message: entry.errorMessage,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('admin_audit_log').insert(rows);

    if (error) {
      console.error('Failed to batch log actions:', error);
    }
  } catch (error) {
    console.error('Batch log error:', error);
  }
}
