/**
 * Alert Dispatcher
 *
 * Handles delivery of alerts with:
 * - Smart filtering (collapse similar alerts)
 * - Rate limiting (5/day free, 50/day premium)
 * - Priority-based delivery (critical = immediate, normal = batched)
 * - Multiple channels (in-app, email, push)
 *
 * Prevents spam while ensuring important alerts get through.
 */

import { supabase } from '../supabase';
import type { AlertTrigger } from './evaluateAlertTriggers';

export interface DispatchOptions {
  immediate?: boolean; // Skip batching
  channels?: ('in_app' | 'email' | 'push')[];
  deduplicateWindow?: number; // Minutes to check for similar alerts
}

export interface DispatchResult {
  success: boolean;
  alertId?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Dispatch a single alert
 *
 * @param trigger - Alert trigger to dispatch
 * @param options - Dispatch options
 * @returns Dispatch result
 */
export async function dispatchAlert(
  trigger: AlertTrigger,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const {
    immediate = trigger.priority === 'critical',
    channels = ['in_app'],
    deduplicateWindow = 60,
  } = options;

  // Check rate limit
  const canReceive = await checkRateLimit(trigger.userId);
  if (!canReceive) {
    return {
      success: false,
      skipped: true,
      reason: 'Rate limit exceeded',
    };
  }

  // Check for duplicate alerts
  const isDuplicate = await checkDuplicate(trigger, deduplicateWindow);
  if (isDuplicate) {
    return {
      success: false,
      skipped: true,
      reason: 'Duplicate alert within deduplication window',
    };
  }

  // Store alert in database (in-app)
  const alertId = await storeAlert(trigger);
  if (!alertId) {
    return {
      success: false,
      reason: 'Failed to store alert',
    };
  }

  // Send via additional channels
  if (immediate && channels.includes('email')) {
    await sendEmailAlert(trigger);
  }

  if (immediate && channels.includes('push')) {
    await sendPushAlert(trigger);
  }

  return {
    success: true,
    alertId,
  };
}

/**
 * Batch dispatch multiple alerts with smart collapsing
 *
 * Collapses similar alerts into summary messages
 */
export async function batchDispatchAlerts(
  triggers: AlertTrigger[],
  options: DispatchOptions = {}
): Promise<{
  dispatched: number;
  skipped: number;
  collapsed: number;
  errors: number;
}> {
  let dispatched = 0;
  let skipped = 0;
  let collapsed = 0;
  let errors = 0;

  // Group triggers by user
  const byUser = new Map<string, AlertTrigger[]>();
  for (const trigger of triggers) {
    const existing = byUser.get(trigger.userId) || [];
    existing.push(trigger);
    byUser.set(trigger.userId, existing);
  }

  // Process each user's triggers
  for (const [userId, userTriggers] of byUser.entries()) {
    // Check if we should collapse
    const shouldCollapse = userTriggers.length >= 3;

    if (shouldCollapse) {
      // Collapse into summary alert
      const summary = createSummaryAlert(userId, userTriggers);
      const result = await dispatchAlert(summary, options);

      if (result.success) {
        dispatched++;
        collapsed += userTriggers.length - 1;
      } else if (result.skipped) {
        skipped++;
      } else {
        errors++;
      }
    } else {
      // Dispatch individually
      for (const trigger of userTriggers) {
        const result = await dispatchAlert(trigger, options);

        if (result.success) {
          dispatched++;
        } else if (result.skipped) {
          skipped++;
        } else {
          errors++;
        }
      }
    }
  }

  return { dispatched, skipped, collapsed, errors };
}

/**
 * Create summary alert from multiple triggers
 */
function createSummaryAlert(userId: string, triggers: AlertTrigger[]): AlertTrigger {
  const byType = new Map<string, number>();
  for (const trigger of triggers) {
    byType.set(trigger.type, (byType.get(trigger.type) || 0) + 1);
  }

  const summaryParts: string[] = [];
  for (const [type, count] of byType.entries()) {
    const label = getTypeLabel(type);
    summaryParts.push(`${count} ${label}`);
  }

  const highestPriority = triggers.reduce((max, t) => {
    const priorities = { critical: 4, high: 3, normal: 2, low: 1 };
    return priorities[t.priority] > priorities[max.priority] ? t : max;
  }, triggers[0]);

  return {
    userId,
    type: 'market_trend',
    title: `📊 ${triggers.length} Updates for Your Watchlist`,
    message: summaryParts.join(', '),
    priority: highestPriority.priority,
    metadata: {
      collapsed: true,
      triggers: triggers.map((t) => ({
        type: t.type,
        playerId: t.playerId,
        title: t.title,
      })),
    },
  };
}

/**
 * Store alert in database
 */
async function storeAlert(trigger: AlertTrigger): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: trigger.userId,
      type: trigger.type,
      player_id: trigger.playerId || null,
      league_id: trigger.leagueId || null,
      title: trigger.title,
      message: trigger.message,
      priority: trigger.priority,
      metadata: trigger.metadata || {},
      expires_at: trigger.expiresAt?.toISOString() || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error storing alert:', error);
    return null;
  }

  return data.id;
}

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_receive_notification', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Exception checking rate limit:', error);
    return false;
  }
}

/**
 * Check for duplicate alert
 */
async function checkDuplicate(trigger: AlertTrigger, windowMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id')
    .eq('user_id', trigger.userId)
    .eq('type', trigger.type)
    .gte('created_at', since.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }

  // If same player, more strict duplicate check
  if (trigger.playerId && data && data.length > 0) {
    const { data: exactMatch } = await supabase
      .from('user_notifications')
      .select('id')
      .eq('user_id', trigger.userId)
      .eq('type', trigger.type)
      .eq('player_id', trigger.playerId)
      .gte('created_at', since.toISOString())
      .limit(1);

    return exactMatch !== null && exactMatch.length > 0;
  }

  return data !== null && data.length > 0;
}

/**
 * Send email alert (placeholder)
 */
async function sendEmailAlert(trigger: AlertTrigger): Promise<void> {
  // TODO: Implement email sending via Supabase Edge Function
  console.log('Email alert:', trigger.title);
}

/**
 * Send push notification (placeholder)
 */
async function sendPushAlert(trigger: AlertTrigger): Promise<void> {
  // TODO: Implement push notifications
  console.log('Push alert:', trigger.title);
}

/**
 * Get human-readable label for alert type
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    value_change: 'Value Changes',
    advice_buy_low: 'Buy Low Opportunities',
    advice_sell_high: 'Sell High Alerts',
    advice_breakout: 'Breakout Alerts',
    advice_waiver: 'Waiver Targets',
    advice_stash: 'Stash Candidates',
    advice_avoid: 'Avoid Warnings',
    role_change: 'Role Changes',
    injury_update: 'Injury Updates',
    trade_opportunity: 'Trade Opportunities',
    waiver_upgrade: 'Waiver Upgrades',
    market_trend: 'Market Trends',
    team_alert: 'Team Alerts',
  };

  return labels[type] || 'Updates';
}

/**
 * Dispatch alerts for daily digest
 *
 * Special handling for batch morning updates
 */
export async function dispatchDailyDigest(
  userId: string,
  summary: {
    buyLows: number;
    sellHighs: number;
    breakouts: number;
    waiverTargets: number;
    valueChanges: number;
  }
): Promise<DispatchResult> {
  const totalUpdates =
    summary.buyLows +
    summary.sellHighs +
    summary.breakouts +
    summary.waiverTargets +
    summary.valueChanges;

  if (totalUpdates === 0) {
    return {
      success: false,
      skipped: true,
      reason: 'No updates to report',
    };
  }

  const messageParts: string[] = [];
  if (summary.buyLows > 0) messageParts.push(`${summary.buyLows} Buy Low${summary.buyLows > 1 ? 's' : ''}`);
  if (summary.sellHighs > 0) messageParts.push(`${summary.sellHighs} Sell High${summary.sellHighs > 1 ? 's' : ''}`);
  if (summary.breakouts > 0) messageParts.push(`${summary.breakouts} Breakout${summary.breakouts > 1 ? 's' : ''}`);
  if (summary.waiverTargets > 0) messageParts.push(`${summary.waiverTargets} Waiver Target${summary.waiverTargets > 1 ? 's' : ''}`);
  if (summary.valueChanges > 0) messageParts.push(`${summary.valueChanges} Value Change${summary.valueChanges > 1 ? 's' : ''}`);

  const trigger: AlertTrigger = {
    userId,
    type: 'daily_digest',
    title: '🌅 Your Daily Fantasy Report',
    message: `${totalUpdates} updates: ${messageParts.join(', ')}`,
    priority: 'normal',
    metadata: summary,
  };

  return dispatchAlert(trigger, {
    immediate: false,
    channels: ['in_app', 'email'], // Send email for daily digest
  });
}

/**
 * Mark alert as read
 */
export async function markAlertRead(alertId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking alert read:', error);
    return false;
  }

  return true;
}

/**
 * Mark all alerts as read for user
 */
export async function markAllAlertsRead(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) {
    console.error('Error marking alerts read:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get unread alert count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Exception getting unread count:', error);
    return 0;
  }
}
