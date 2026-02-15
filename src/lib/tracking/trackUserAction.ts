/**
 * User Action Tracking
 *
 * CRITICAL: Tracks what users actually do so the model can learn.
 *
 * Tracks:
 * - Trades sent/accepted
 * - Pickups/drops
 * - Start/bench decisions
 * - Advice viewed/followed
 * - Player searches
 *
 * This data feeds back into model training and outcome evaluation.
 */

import { supabase } from '../supabase';

export type ActionType =
  | 'trade_sent'
  | 'trade_accepted'
  | 'trade_rejected'
  | 'trade_countered'
  | 'pickup'
  | 'drop'
  | 'start'
  | 'bench'
  | 'viewed_advice'
  | 'followed_advice'
  | 'ignored_advice'
  | 'player_searched'
  | 'player_viewed'
  | 'value_checked'
  | 'watchlist_added'
  | 'watchlist_removed'
  | 'trade_calculated';

export interface UserAction {
  id: string;
  userId: string;
  leagueId?: string;
  playerId?: string;
  actionType: ActionType;
  relatedValue?: number;
  createdAt: string;
  metadata: Record<string, any>;
}

/**
 * Track user action
 *
 * @param userId - User ID
 * @param actionType - Type of action
 * @param options - Additional context
 */
export async function trackUserAction(
  userId: string,
  actionType: ActionType,
  options?: {
    leagueId?: string;
    playerId?: string;
    relatedValue?: number;
    metadata?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_actions').insert({
      user_id: userId,
      league_id: options?.leagueId,
      player_id: options?.playerId,
      action_type: actionType,
      related_value: options?.relatedValue,
      metadata: options?.metadata || {},
    });

    if (error) {
      console.error('Error tracking user action:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception tracking user action:', err);
    return false;
  }
}

/**
 * Track trade action
 */
export async function trackTrade(
  userId: string,
  actionType: 'trade_sent' | 'trade_accepted' | 'trade_rejected' | 'trade_countered',
  options: {
    leagueId?: string;
    tradeId?: string;
    givingValue: number;
    receivingValue: number;
    netValue: number;
    players?: string[];
  }
) {
  return trackUserAction(userId, actionType, {
    leagueId: options.leagueId,
    relatedValue: options.netValue,
    metadata: {
      tradeId: options.tradeId,
      givingValue: options.givingValue,
      receivingValue: options.receivingValue,
      netValue: options.netValue,
      players: options.players,
    },
  });
}

/**
 * Track roster action (pickup/drop/start/bench)
 */
export async function trackRosterAction(
  userId: string,
  actionType: 'pickup' | 'drop' | 'start' | 'bench',
  options: {
    leagueId?: string;
    playerId: string;
    playerValue?: number;
    week?: number;
  }
) {
  return trackUserAction(userId, actionType, {
    leagueId: options.leagueId,
    playerId: options.playerId,
    relatedValue: options.playerValue,
    metadata: {
      week: options.week,
    },
  });
}

/**
 * Track advice interaction
 */
export async function trackAdviceAction(
  userId: string,
  actionType: 'viewed_advice' | 'followed_advice' | 'ignored_advice',
  options: {
    leagueId?: string;
    playerId?: string;
    adviceId?: string;
    adviceType?: string;
    confidence?: number;
  }
) {
  return trackUserAction(userId, actionType, {
    leagueId: options.leagueId,
    playerId: options.playerId,
    metadata: {
      adviceId: options.adviceId,
      adviceType: options.adviceType,
      confidence: options.confidence,
    },
  });
}

/**
 * Track player research
 */
export async function trackPlayerResearch(
  userId: string,
  actionType: 'player_searched' | 'player_viewed' | 'value_checked',
  options: {
    leagueId?: string;
    playerId: string;
    playerValue?: number;
    searchQuery?: string;
  }
) {
  return trackUserAction(userId, actionType, {
    leagueId: options.leagueId,
    playerId: options.playerId,
    relatedValue: options.playerValue,
    metadata: {
      searchQuery: options.searchQuery,
    },
  });
}

/**
 * Get user actions for period
 */
export async function getUserActions(
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    actionType?: ActionType;
    limit?: number;
  }
): Promise<UserAction[]> {
  let query = supabase
    .from('user_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }

  if (options?.actionType) {
    query = query.eq('action_type', options.actionType);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user actions:', error);
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    leagueId: a.league_id,
    playerId: a.player_id,
    actionType: a.action_type as ActionType,
    relatedValue: a.related_value,
    createdAt: a.created_at,
    metadata: a.metadata || {},
  }));
}

/**
 * Get action statistics for user
 */
export async function getUserActionStats(
  userId: string,
  period: 'day' | 'week' | 'month' | 'all' = 'all'
): Promise<Record<string, number>> {
  const startDate = getStartDateForPeriod(period);

  const { data } = await supabase
    .from('user_actions')
    .select('action_type')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString());

  const stats: Record<string, number> = {};

  (data || []).forEach((action) => {
    stats[action.action_type] = (stats[action.action_type] || 0) + 1;
  });

  return stats;
}

/**
 * Get most common actions across all users
 */
export async function getTopActions(
  period: 'day' | 'week' | 'month' = 'week',
  limit: number = 10
): Promise<Array<{ actionType: string; count: number }>> {
  const startDate = getStartDateForPeriod(period);

  const { data } = await supabase
    .from('user_actions')
    .select('action_type')
    .gte('created_at', startDate.toISOString());

  const counts: Record<string, number> = {};

  (data || []).forEach((action) => {
    counts[action.action_type] = (counts[action.action_type] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([actionType, count]) => ({ actionType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get player actions (what users do with this player)
 */
export async function getPlayerActions(
  playerId: string,
  options?: {
    actionType?: ActionType;
    limit?: number;
  }
): Promise<UserAction[]> {
  let query = supabase
    .from('user_actions')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  if (options?.actionType) {
    query = query.eq('action_type', options.actionType);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching player actions:', error);
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    leagueId: a.league_id,
    playerId: a.player_id,
    actionType: a.action_type as ActionType,
    relatedValue: a.related_value,
    createdAt: a.created_at,
    metadata: a.metadata || {},
  }));
}

/**
 * Helper: Get start date for period
 */
function getStartDateForPeriod(period: 'day' | 'week' | 'month' | 'all'): Date {
  const now = new Date();

  switch (period) {
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0); // Beginning of time
    default:
      return new Date(0);
  }
}

/**
 * Batch track actions (for importing historical data)
 */
export async function trackActionsBatch(
  actions: Array<{
    userId: string;
    actionType: ActionType;
    leagueId?: string;
    playerId?: string;
    relatedValue?: number;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }>
): Promise<boolean> {
  try {
    const inserts = actions.map((a) => ({
      user_id: a.userId,
      action_type: a.actionType,
      league_id: a.leagueId,
      player_id: a.playerId,
      related_value: a.relatedValue,
      metadata: a.metadata || {},
      created_at: a.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const { error } = await supabase.from('user_actions').insert(inserts);

    if (error) {
      console.error('Error batch tracking actions:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception batch tracking actions:', err);
    return false;
  }
}
