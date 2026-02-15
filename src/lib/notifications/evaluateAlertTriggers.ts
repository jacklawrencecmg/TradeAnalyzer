/**
 * Alert Trigger Evaluation System
 *
 * Evaluates when to generate alerts for users based on:
 * - Value changes (300+ = normal, 700+ = high, 1200+ = critical)
 * - Advice engine updates (buy low, sell high, breakout)
 * - Role changes (promotions, injury returns)
 * - Trade opportunities (fair trades become available)
 * - Waiver upgrades (better players available)
 *
 * Respects rate limits: 5/day free, 50/day premium
 */

import { supabase } from '../supabase';

export interface AlertTrigger {
  userId: string;
  type:
    | 'value_change'
    | 'advice_buy_low'
    | 'advice_sell_high'
    | 'advice_breakout'
    | 'advice_waiver'
    | 'advice_stash'
    | 'advice_avoid'
    | 'role_change'
    | 'injury_update'
    | 'trade_opportunity'
    | 'waiver_upgrade'
    | 'market_trend';
  playerId?: string;
  leagueId?: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface ValueChangeEvent {
  playerId: string;
  playerName: string;
  oldValue: number;
  newValue: number;
  change: number;
  format: 'dynasty' | 'redraft';
}

export interface AdviceEvent {
  playerId: string;
  playerName: string;
  position: string;
  adviceType: string;
  confidence: number;
  reason: string;
  format: 'dynasty' | 'redraft';
}

export interface RoleChangeEvent {
  playerId: string;
  playerName: string;
  oldRole: string;
  newRole: string;
  reason: string;
}

/**
 * Evaluate value change triggers
 *
 * Generates alerts for watched players whose values changed significantly
 */
export async function evaluateValueChangeTriggers(
  events: ValueChangeEvent[]
): Promise<AlertTrigger[]> {
  const triggers: AlertTrigger[] = [];

  for (const event of events) {
    const absChange = Math.abs(event.change);

    // Determine priority based on magnitude
    let priority: 'low' | 'normal' | 'high' | 'critical' = 'low';
    if (absChange >= 1200) {
      priority = 'critical';
    } else if (absChange >= 700) {
      priority = 'high';
    } else if (absChange >= 300) {
      priority = 'normal';
    } else {
      continue; // Skip if change too small
    }

    // Find users watching this player
    const watchingUsers = await getUsersWatchingPlayer(event.playerId);

    for (const userId of watchingUsers) {
      // Check if user can receive more alerts today
      const canReceive = await canUserReceiveAlert(userId);
      if (!canReceive) {
        continue;
      }

      const direction = event.change > 0 ? 'increased' : 'decreased';
      const emoji = event.change > 0 ? '📈' : '📉';

      triggers.push({
        userId,
        type: 'value_change',
        playerId: event.playerId,
        title: `${emoji} ${event.playerName} Value ${direction}`,
        message: `${event.playerName} value ${direction} by ${absChange} points (${event.oldValue} → ${event.newValue})`,
        priority,
        metadata: {
          oldValue: event.oldValue,
          newValue: event.newValue,
          change: event.change,
          format: event.format,
        },
      });
    }
  }

  return triggers;
}

/**
 * Evaluate advice engine triggers
 *
 * Generates alerts when new advice appears for watched players
 */
export async function evaluateAdviceTriggers(events: AdviceEvent[]): Promise<AlertTrigger[]> {
  const triggers: AlertTrigger[] = [];

  for (const event of events) {
    const watchingUsers = await getUsersWatchingPlayer(event.playerId);

    for (const userId of watchingUsers) {
      const canReceive = await canUserReceiveAlert(userId);
      if (!canReceive) {
        continue;
      }

      // Only premium users get advice alerts (except breakouts)
      const isPremium = await isPremiumUser(userId);
      if (!isPremium && event.adviceType !== 'breakout') {
        continue;
      }

      const { title, emoji, priority } = getAdviceAlertConfig(event.adviceType, event.confidence);

      triggers.push({
        userId,
        type: `advice_${event.adviceType}` as any,
        playerId: event.playerId,
        title: `${emoji} ${event.playerName} ${title}`,
        message: event.reason,
        priority,
        metadata: {
          adviceType: event.adviceType,
          confidence: event.confidence,
          position: event.position,
          format: event.format,
        },
        expiresAt: event.adviceType === 'breakout' ? new Date(Date.now() + 72 * 60 * 60 * 1000) : undefined,
      });
    }
  }

  return triggers;
}

/**
 * Evaluate role change triggers
 *
 * Generates alerts when player roles change significantly
 */
export async function evaluateRoleChangeTriggers(
  events: RoleChangeEvent[]
): Promise<AlertTrigger[]> {
  const triggers: AlertTrigger[] = [];

  for (const event of events) {
    const watchingUsers = await getUsersWatchingPlayer(event.playerId);

    const isPremium = event.newRole === 'starter' || event.reason.includes('return');
    const priority: 'normal' | 'high' = event.newRole === 'starter' ? 'high' : 'normal';

    for (const userId of watchingUsers) {
      // Free users only get starter promotions
      if (!isPremium && !(await isPremiumUser(userId))) {
        continue;
      }

      const canReceive = await canUserReceiveAlert(userId);
      if (!canReceive) {
        continue;
      }

      triggers.push({
        userId,
        type: 'role_change',
        playerId: event.playerId,
        title: `⭐ ${event.playerName} Role Change`,
        message: `${event.playerName}: ${event.oldRole} → ${event.newRole}. ${event.reason}`,
        priority,
        metadata: {
          oldRole: event.oldRole,
          newRole: event.newRole,
          reason: event.reason,
        },
      });
    }
  }

  return triggers;
}

/**
 * Evaluate waiver upgrade opportunities (league-aware)
 *
 * Generates alerts when better players are available on waivers
 */
export async function evaluateWaiverUpgradeTriggers(
  userId: string,
  leagueId: string
): Promise<AlertTrigger[]> {
  const triggers: AlertTrigger[] = [];

  // Premium feature only
  const isPremium = await isPremiumUser(userId);
  if (!isPremium) {
    return triggers;
  }

  const canReceive = await canUserReceiveAlert(userId);
  if (!canReceive) {
    return triggers;
  }

  // TODO: Implement logic to compare team starters vs available waiver players
  // This requires integration with league rosters

  return triggers;
}

/**
 * Evaluate trade opportunity triggers (league-aware)
 *
 * Generates alerts when fair trades become available
 */
export async function evaluateTradeOpportunityTriggers(
  userId: string,
  leagueId: string
): Promise<AlertTrigger[]> {
  const triggers: AlertTrigger[] = [];

  // Premium feature only
  const isPremium = await isPremiumUser(userId);
  if (!isPremium) {
    return triggers;
  }

  const canReceive = await canUserReceiveAlert(userId);
  if (!canReceive) {
    return triggers;
  }

  // TODO: Implement logic to evaluate trade fairness
  // This requires team strategy analysis

  return triggers;
}

/**
 * Helper: Get users watching a specific player
 */
async function getUsersWatchingPlayer(playerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('watchlist_players')
    .select('watchlist_id')
    .eq('player_id', playerId);

  if (error || !data) {
    return [];
  }

  const watchlistIds = data.map((row) => row.watchlist_id);

  if (watchlistIds.length === 0) {
    return [];
  }

  const { data: watchlists } = await supabase
    .from('user_watchlists')
    .select('user_id')
    .in('id', watchlistIds)
    .not('user_id', 'is', null);

  if (!watchlists) {
    return [];
  }

  return watchlists.map((w) => w.user_id).filter((id) => id !== null);
}

/**
 * Helper: Check if user can receive more alerts today
 */
async function canUserReceiveAlert(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_receive_notification', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error checking alert limit:', error);
    return false;
  }

  return data === true;
}

/**
 * Helper: Check if user is premium
 */
async function isPremiumUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_user_tier', {
    p_user_id: userId,
  });

  if (error) {
    return false;
  }

  return data === 'premium';
}

/**
 * Helper: Get advice alert configuration
 */
function getAdviceAlertConfig(
  adviceType: string,
  confidence: number
): { title: string; emoji: string; priority: 'normal' | 'high' | 'critical' } {
  const configs: Record<
    string,
    { title: string; emoji: string; priority: 'normal' | 'high' | 'critical' }
  > = {
    buy_low: {
      title: 'Buy Low Opportunity',
      emoji: '🟢',
      priority: confidence >= 80 ? 'high' : 'normal',
    },
    sell_high: {
      title: 'Sell High Alert',
      emoji: '🔴',
      priority: confidence >= 80 ? 'high' : 'normal',
    },
    breakout: {
      title: 'Breakout Alert',
      emoji: '⚡',
      priority: confidence >= 75 ? 'critical' : 'high',
    },
    waiver: {
      title: 'Waiver Target',
      emoji: '➕',
      priority: 'normal',
    },
    stash: {
      title: 'Stash Candidate',
      emoji: '⭐',
      priority: 'normal',
    },
    avoid: {
      title: 'Avoid Warning',
      emoji: '⚠️',
      priority: confidence >= 80 ? 'high' : 'normal',
    },
  };

  return (
    configs[adviceType] || {
      title: 'Alert',
      emoji: '📢',
      priority: 'normal',
    }
  );
}

/**
 * Batch evaluate all triggers for a user
 *
 * Combines multiple event types and returns prioritized alerts
 */
export async function evaluateAllTriggersForUser(
  userId: string,
  options: {
    valueChanges?: ValueChangeEvent[];
    adviceUpdates?: AdviceEvent[];
    roleChanges?: RoleChangeEvent[];
    leagueIds?: string[];
  } = {}
): Promise<AlertTrigger[]> {
  const allTriggers: AlertTrigger[] = [];

  // Value changes
  if (options.valueChanges) {
    const valueTriggers = await evaluateValueChangeTriggers(options.valueChanges);
    allTriggers.push(...valueTriggers.filter((t) => t.userId === userId));
  }

  // Advice updates
  if (options.adviceUpdates) {
    const adviceTriggers = await evaluateAdviceTriggers(options.adviceUpdates);
    allTriggers.push(...adviceTriggers.filter((t) => t.userId === userId));
  }

  // Role changes
  if (options.roleChanges) {
    const roleTriggers = await evaluateRoleChangeTriggers(options.roleChanges);
    allTriggers.push(...roleTriggers.filter((t) => t.userId === userId));
  }

  // League-specific triggers
  if (options.leagueIds) {
    for (const leagueId of options.leagueIds) {
      const waiverTriggers = await evaluateWaiverUpgradeTriggers(userId, leagueId);
      allTriggers.push(...waiverTriggers);

      const tradeTriggers = await evaluateTradeOpportunityTriggers(userId, leagueId);
      allTriggers.push(...tradeTriggers);
    }
  }

  // Sort by priority (critical > high > normal > low)
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  allTriggers.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return allTriggers;
}
