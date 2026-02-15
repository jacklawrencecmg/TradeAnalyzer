/**
 * Canonical Player Values API
 *
 * Single Source of Truth for all player values.
 * ALL value reads MUST go through these functions.
 *
 * DO NOT:
 * - Read directly from ktc_value_snapshots
 * - Calculate values inline in components
 * - Use fallback value logic
 *
 * Key Features:
 * - Epoch-based versioning
 * - League profile aware
 * - Efficient batch operations
 * - Comprehensive caching
 */

import { supabase } from '../supabase';
import { cache, getCacheKey } from '../cache';

const VALUE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================
// TYPES
// ============================================================

export interface PlayerValueCanonical {
  id: string;
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  league_profile_id: string | null;
  format: string;
  base_value: number;
  adjusted_value: number;
  market_value: number | null;
  rank_overall: number | null;
  rank_position: number | null;
  tier: string;
  value_epoch_id: string;
  created_at: string;
  updated_at: string;
  source: string;
  confidence_score: number | null;
  metadata: Record<string, any>;
}

export interface ValueHistoryPoint {
  date: string;
  value: number;
  epoch_id: string;
}

export interface EpochInfo {
  id: string;
  epoch_number: number;
  created_at: string;
  created_by: string;
  trigger_reason: string;
  status: string;
}

// ============================================================
// EPOCH MANAGEMENT
// ============================================================

/**
 * Get current active epoch ID
 */
export async function getCurrentEpochId(): Promise<string | null> {
  const cacheKey = getCacheKey(['current-epoch']);

  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.rpc('get_current_epoch');

    if (error || !data) {
      console.error('Failed to get current epoch:', error);
      return null;
    }

    cache.set(cacheKey, data, 60000); // Cache for 1 minute
    return data;
  } catch (err) {
    console.error('Exception getting current epoch:', err);
    return null;
  }
}

/**
 * Get epoch info
 */
export async function getEpochInfo(epochId: string): Promise<EpochInfo | null> {
  try {
    const { data, error } = await supabase
      .from('value_epochs')
      .select('*')
      .eq('id', epochId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error getting epoch info:', err);
    return null;
  }
}

/**
 * Get latest epoch number
 */
export async function getLatestEpochNumber(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_latest_epoch_number');

    if (error) {
      console.error('Failed to get latest epoch number:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Exception getting latest epoch number:', err);
    return 0;
  }
}

// ============================================================
// SINGLE PLAYER VALUE
// ============================================================

/**
 * Get value for a single player (PRIMARY FUNCTION)
 *
 * @param player_id - Player identifier
 * @param league_profile_id - League profile (null = default)
 * @param format - Format (dynasty/redraft/bestball)
 * @returns PlayerValueCanonical or null if not found
 */
export async function getPlayerValue(
  player_id: string,
  league_profile_id: string | null = null,
  format: string = 'dynasty'
): Promise<PlayerValueCanonical | null> {
  const epochId = await getCurrentEpochId();
  if (!epochId) {
    console.error('No active epoch found');
    return null;
  }

  const cacheKey = getCacheKey([
    'player-value',
    player_id,
    league_profile_id || 'default',
    format,
    epochId,
  ]);

  const cached = cache.get<PlayerValueCanonical>(cacheKey);
  if (cached) return cached;

  try {
    const query = supabase
      .from('player_values_canonical')
      .select('*')
      .eq('player_id', player_id)
      .eq('format', format)
      .eq('value_epoch_id', epochId);

    if (league_profile_id) {
      query.eq('league_profile_id', league_profile_id);
    } else {
      query.is('league_profile_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching player value:', error);
      return null;
    }

    if (data) {
      cache.set(cacheKey, data, VALUE_CACHE_TTL);
    }

    return data;
  } catch (err) {
    console.error('Exception in getPlayerValue:', err);
    return null;
  }
}

// ============================================================
// BATCH PLAYER VALUES
// ============================================================

/**
 * Get values for multiple players (EFFICIENT BATCH OPERATION)
 *
 * @param player_ids - Array of player identifiers
 * @param league_profile_id - League profile (null = default)
 * @param format - Format (dynasty/redraft/bestball)
 * @returns Map of player_id -> PlayerValueCanonical
 */
export async function getPlayerValues(
  player_ids: string[],
  league_profile_id: string | null = null,
  format: string = 'dynasty'
): Promise<Map<string, PlayerValueCanonical>> {
  if (player_ids.length === 0) {
    return new Map();
  }

  const epochId = await getCurrentEpochId();
  if (!epochId) {
    console.error('No active epoch found');
    return new Map();
  }

  try {
    const query = supabase
      .from('player_values_canonical')
      .select('*')
      .in('player_id', player_ids)
      .eq('format', format)
      .eq('value_epoch_id', epochId);

    if (league_profile_id) {
      query.eq('league_profile_id', league_profile_id);
    } else {
      query.is('league_profile_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching player values batch:', error);
      return new Map();
    }

    const valueMap = new Map<string, PlayerValueCanonical>();
    data?.forEach((value) => {
      valueMap.set(value.player_id, value);

      // Cache individual values
      const cacheKey = getCacheKey([
        'player-value',
        value.player_id,
        league_profile_id || 'default',
        format,
        epochId,
      ]);
      cache.set(cacheKey, value, VALUE_CACHE_TTL);
    });

    return valueMap;
  } catch (err) {
    console.error('Exception in getPlayerValues:', err);
    return new Map();
  }
}

// ============================================================
// RANKINGS
// ============================================================

/**
 * Get rankings (all players sorted)
 *
 * @param league_profile_id - League profile (null = default)
 * @param format - Format (dynasty/redraft/bestball)
 * @param position - Filter by position (optional)
 * @param limit - Max number of results
 * @returns Array of PlayerValueCanonical sorted by adjusted_value
 */
export async function getRankings(
  league_profile_id: string | null = null,
  format: string = 'dynasty',
  position?: string,
  limit: number = 500
): Promise<PlayerValueCanonical[]> {
  const epochId = await getCurrentEpochId();
  if (!epochId) {
    console.error('No active epoch found');
    return [];
  }

  const cacheKey = getCacheKey([
    'rankings',
    league_profile_id || 'default',
    format,
    position || 'all',
    epochId,
    limit.toString(),
  ]);

  const cached = cache.get<PlayerValueCanonical[]>(cacheKey);
  if (cached) return cached;

  try {
    let query = supabase
      .from('player_values_canonical')
      .select('*')
      .eq('format', format)
      .eq('value_epoch_id', epochId);

    if (league_profile_id) {
      query = query.eq('league_profile_id', league_profile_id);
    } else {
      query = query.is('league_profile_id', null);
    }

    if (position) {
      query = query.eq('position', position);
    }

    query = query
      .order('adjusted_value', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching rankings:', error);
      return [];
    }

    if (data) {
      cache.set(cacheKey, data, VALUE_CACHE_TTL);
    }

    return data || [];
  } catch (err) {
    console.error('Exception in getRankings:', err);
    return [];
  }
}

/**
 * Get rankings by position rank
 */
export async function getRankingsByPositionRank(
  position: string,
  league_profile_id: string | null = null,
  format: string = 'dynasty',
  limit: number = 100
): Promise<PlayerValueCanonical[]> {
  const epochId = await getCurrentEpochId();
  if (!epochId) return [];

  try {
    let query = supabase
      .from('player_values_canonical')
      .select('*')
      .eq('format', format)
      .eq('position', position)
      .eq('value_epoch_id', epochId)
      .not('rank_position', 'is', null);

    if (league_profile_id) {
      query = query.eq('league_profile_id', league_profile_id);
    } else {
      query = query.is('league_profile_id', null);
    }

    query = query
      .order('rank_position', { ascending: true })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching position rankings:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception in getRankingsByPositionRank:', err);
    return [];
  }
}

// ============================================================
// VALUE HISTORY
// ============================================================

/**
 * Get value history for a player
 *
 * @param player_id - Player identifier
 * @param days - Number of days to look back
 * @param format - Format (default: dynasty)
 * @returns Array of historical value points
 */
export async function getValueHistory(
  player_id: string,
  days: number = 180,
  format: string = 'dynasty'
): Promise<ValueHistoryPoint[]> {
  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data, error } = await supabase
      .from('player_values_canonical')
      .select('updated_at, adjusted_value, value_epoch_id')
      .eq('player_id', player_id)
      .eq('format', format)
      .is('league_profile_id', null)
      .gte('updated_at', sinceDate.toISOString())
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('Error fetching value history:', error);
      return [];
    }

    return (data || []).map((row) => ({
      date: row.updated_at,
      value: row.adjusted_value,
      epoch_id: row.value_epoch_id,
    }));
  } catch (err) {
    console.error('Exception in getValueHistory:', err);
    return [];
  }
}

// ============================================================
// SUMMARY STATS
// ============================================================

/**
 * Get summary statistics for values
 */
export async function getValuesSummary(
  league_profile_id: string | null = null,
  format: string = 'dynasty',
  position?: string
): Promise<{
  total_players: number;
  avg_value: number;
  max_value: number;
  min_value: number;
  last_updated: string;
} | null> {
  const epochId = await getCurrentEpochId();
  if (!epochId) return null;

  try {
    let query = supabase
      .from('player_values_canonical')
      .select('adjusted_value, updated_at')
      .eq('format', format)
      .eq('value_epoch_id', epochId);

    if (league_profile_id) {
      query = query.eq('league_profile_id', league_profile_id);
    } else {
      query = query.is('league_profile_id', null);
    }

    if (position) {
      query = query.eq('position', position);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    const values = data.map((d) => d.adjusted_value);
    const total = values.length;
    const avg = values.reduce((sum, v) => sum + v, 0) / total;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const lastUpdated = data[0].updated_at;

    return {
      total_players: total,
      avg_value: Math.round(avg),
      max_value: max,
      min_value: min,
      last_updated: lastUpdated,
    };
  } catch (err) {
    console.error('Exception in getValuesSummary:', err);
    return null;
  }
}

// ============================================================
// CACHE MANAGEMENT
// ============================================================

/**
 * Invalidate all value caches (call after rebuild)
 */
export function invalidateAllValueCaches(): void {
  cache.invalidatePattern('player-value:*');
  cache.invalidatePattern('rankings:*');
  cache.invalidatePattern('current-epoch');
}

/**
 * Invalidate caches for specific epoch
 */
export function invalidateCachesForEpoch(epochId: string): void {
  cache.invalidatePattern(`*:${epochId}`);
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Check if values are fresh (updated within threshold)
 */
export async function areValuesFresh(maxHours: number = 48): Promise<boolean> {
  const epochId = await getCurrentEpochId();
  if (!epochId) return false;

  const epochInfo = await getEpochInfo(epochId);
  if (!epochInfo) return false;

  const hoursSinceUpdate =
    (Date.now() - new Date(epochInfo.created_at).getTime()) / (1000 * 60 * 60);

  return hoursSinceUpdate <= maxHours;
}

/**
 * Get last updated timestamp
 */
export async function getValuesLastUpdated(): Promise<string | null> {
  const epochId = await getCurrentEpochId();
  if (!epochId) return null;

  const epochInfo = await getEpochInfo(epochId);
  return epochInfo?.created_at || null;
}

/**
 * Format value for display
 */
export function formatValue(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString();
}

/**
 * Calculate value difference
 */
export function calculateValueDifference(
  currentValue: number,
  previousValue: number
): {
  difference: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
} {
  const difference = currentValue - previousValue;
  const percentChange =
    previousValue > 0 ? (difference / previousValue) * 100 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(percentChange) >= 5) {
    trend = percentChange > 0 ? 'up' : 'down';
  }

  return {
    difference,
    percentChange,
    trend,
  };
}
