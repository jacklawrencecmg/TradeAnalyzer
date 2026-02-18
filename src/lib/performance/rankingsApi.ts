/**
 * Optimized Rankings API
 *
 * O(1) query performance for rankings pages.
 * Single query against latest_player_values view with proper indexes.
 *
 * Target: <50ms server time under load
 */

import { supabase } from '../supabase';
import { cachedFetch, getCacheKey } from '../cache';

const RANKINGS_CACHE_TTL = 5 * 60 * 1000;
const STATS_CACHE_TTL = 10 * 60 * 1000;

export interface RankingsQuery {
  leagueProfileId?: string | null;
  format: 'dynasty' | 'redraft';
  position?: 'QB' | 'RB' | 'WR' | 'TE' | 'all';
  limit?: number;
  offset?: number;
  minValue?: number;
}

export interface RankingsResult {
  playerId: string;
  fullName: string;
  searchName: string;
  position: string;
  team: string;
  status: string;
  value: number;
  positionRank: number;
  tier?: number;
  valueEpoch: string;
  capturedAt: string;
  age?: number;
}

/**
 * Get rankings with single O(1) query
 *
 * NO per-row lookups. NO N+1 queries.
 */
export async function getRankings(query: RankingsQuery): Promise<{
  rankings: RankingsResult[];
  total: number;
  valueEpoch: string | null;
}> {
  const startTime = Date.now();
  const { leagueProfileId, format, position, limit = 100, offset = 0, minValue } = query;

  try {
    // Build single query with all filters
    let queryBuilder = supabase
      .from('latest_player_values')
      .select('*', { count: 'exact' })
      .eq('format', format)
      .not('fdp_value', 'is', null)
      .not('position_rank', 'is', null)
      .order('position_rank', { ascending: true });

    // Profile filter
    if (leagueProfileId) {
      queryBuilder = queryBuilder.eq('league_profile_id', leagueProfileId);
    } else {
      queryBuilder = queryBuilder.is('league_profile_id', null);
    }

    // Position filter
    if (position && position !== 'all') {
      queryBuilder = queryBuilder.eq('player_position', position);
    }

    // Min value filter
    if (minValue) {
      queryBuilder = queryBuilder.gte('fdp_value', minValue);
    }

    // Pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    // Execute single query
    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('Rankings query error:', error);
      return { rankings: [], total: 0, valueEpoch: null };
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 200) {
      console.warn(`⚠️ Slow rankings query: ${elapsed}ms`, { format, position, limit, offset });
    }

    // Extract value epoch from first result
    const valueEpoch = data && data.length > 0 ? data[0].value_epoch : null;

    // Transform to result format
    const rankings: RankingsResult[] = (data || []).map((row) => ({
      playerId: row.player_id,
      fullName: row.full_name,
      searchName: row.search_name,
      position: row.player_position,
      team: row.team,
      status: row.status,
      value: row.fdp_value,
      positionRank: row.position_rank,
      valueEpoch: row.value_epoch,
      capturedAt: row.captured_at,
      age: row.age,
    }));

    return {
      rankings,
      total: count || 0,
      valueEpoch,
    };
  } catch (error) {
    console.error('Rankings error:', error);
    return { rankings: [], total: 0, valueEpoch: null };
  }
}

/**
 * Get top N players (fastest query)
 */
export async function getTopPlayers(
  format: 'dynasty' | 'redraft',
  limit: number = 100
): Promise<RankingsResult[]> {
  const { rankings } = await getRankings({ format, limit });
  return rankings;
}

/**
 * Get position rankings (optimized)
 */
export async function getPositionRankings(
  position: 'QB' | 'RB' | 'WR' | 'TE',
  format: 'dynasty' | 'redraft',
  limit: number = 50
): Promise<RankingsResult[]> {
  const { rankings } = await getRankings({ format, position, limit });
  return rankings;
}

/**
 * Get player rank (single query)
 */
async function getTotalPlayerCount(format: 'dynasty' | 'redraft'): Promise<number> {
  const cacheKey = getCacheKey(['rankings-total-count', format]);
  return cachedFetch(
    cacheKey,
    async () => {
      const { count } = await supabase
        .from('latest_player_values')
        .select('*', { count: 'exact', head: true })
        .eq('format', format)
        .is('league_profile_id', null)
        .not('fdp_value', 'is', null);
      return count || 0;
    },
    STATS_CACHE_TTL
  );
}

export async function getPlayerRank(
  playerId: string,
  format: 'dynasty' | 'redraft'
): Promise<{
  rank: number;
  value: number;
  total: number;
} | null> {
  try {
    const [playerData, total] = await Promise.all([
      supabase
        .from('latest_player_values')
        .select('position_rank, fdp_value')
        .eq('player_id', playerId)
        .eq('format', format)
        .is('league_profile_id', null)
        .maybeSingle(),
      getTotalPlayerCount(format),
    ]);

    if (playerData.error || !playerData.data) return null;

    return {
      rank: playerData.data.position_rank,
      value: playerData.data.fdp_value,
      total,
    };
  } catch (error) {
    console.error('Get player rank error:', error);
    return null;
  }
}

/**
 * Get current value epoch (for cache invalidation)
 */
export async function getCurrentValueEpoch(
  format: 'dynasty' | 'redraft'
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('latest_player_values')
      .select('value_epoch')
      .eq('format', format)
      .is('league_profile_id', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.value_epoch || null;
  } catch (error) {
    console.error('Get value epoch error:', error);
    return null;
  }
}

/**
 * Rankings statistics (for UI)
 */
export async function getRankingsStats(
  format: 'dynasty' | 'redraft'
): Promise<{
  totalPlayers: number;
  byPosition: Record<string, number>;
  valueEpoch: string | null;
  lastUpdated: string | null;
}> {
  const cacheKey = getCacheKey(['rankings-stats', format]);
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const { data } = await supabase
          .from('latest_player_values')
          .select('player_position, value_epoch, captured_at')
          .eq('format', format)
          .is('league_profile_id', null)
          .not('fdp_value', 'is', null);

        if (!data) {
          return { totalPlayers: 0, byPosition: {}, valueEpoch: null, lastUpdated: null };
        }

        const byPosition: Record<string, number> = {};
        data.forEach((row) => {
          const pos = row.player_position || 'UNKNOWN';
          byPosition[pos] = (byPosition[pos] || 0) + 1;
        });

        const valueEpoch = data[0]?.value_epoch || null;
        const lastUpdated = data[0]?.captured_at || null;

        return {
          totalPlayers: data.length,
          byPosition,
          valueEpoch,
          lastUpdated,
        };
      } catch (error) {
        console.error('Get rankings stats error:', error);
        return { totalPlayers: 0, byPosition: {}, valueEpoch: null, lastUpdated: null };
      }
    },
    STATS_CACHE_TTL
  );
}
