import { supabase } from '../supabase';
import { cache, cachedFetch, getCacheKey } from '../cache';

export interface PlayerValue {
  player_id: string;
  external_id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  status: string;
  rookie_year: number | null;
  position_rank: number | null;
  ktc_value: number | null;
  fdp_value: number | null;
  captured_at: string;
  format: string;
  snapshot_id: string;
}

const VALUE_CACHE_TTL = 5 * 60 * 1000;

export interface ValuesSummary {
  format: string;
  position?: string;
  total_players: number;
  avg_value: number;
  max_value: number;
  min_value: number;
  last_updated: string;
}

function mapRowToPlayerValue(row: any, format: string): PlayerValue {
  return {
    player_id: row.player_id,
    external_id: row.player_id,
    full_name: row.player_name || 'Unknown',
    player_position: row.position || '',
    team: row.team || null,
    status: 'Active',
    rookie_year: null,
    position_rank: row.rank_position || null,
    ktc_value: row.market_value || row.base_value || 0,
    fdp_value: row.adjusted_value || row.base_value || 0,
    captured_at: row.updated_at || new Date().toISOString(),
    format,
    snapshot_id: row.player_id,
  };
}

export async function getLatestValuesByPosition(
  format: string,
  position: string
): Promise<PlayerValue[]> {
  const cacheKey = getCacheKey(['latest-values', format, position]);

  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const { data, error } = await supabase
          .from('latest_player_values')
          .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
          .eq('format', format)
          .eq('position', position)
          .order('adjusted_value', { ascending: false })
          .limit(500);

        if (error) {
          console.error('Error fetching values:', error);
          return [];
        }

        return (data || []).map(row => mapRowToPlayerValue(row, format));
      } catch (err) {
        console.error('Error in getLatestValuesByPosition:', err);
        return [];
      }
    },
    VALUE_CACHE_TTL
  );
}

export async function getLatestValueForPlayer(
  playerId: string,
  format: string
): Promise<PlayerValue | null> {
  const cacheKey = getCacheKey(['player-value', playerId, format]);

  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const { data, error } = await supabase
          .from('latest_player_values')
          .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
          .eq('player_id', playerId)
          .eq('format', format)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return mapRowToPlayerValue(data, format);
      } catch (err) {
        console.error('Error in getLatestValueForPlayer:', err);
        return null;
      }
    },
    VALUE_CACHE_TTL
  );
}

const HISTORY_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getPlayerValueHistory(
  playerId: string,
  format: string = 'dynasty_sf',
  days: number = 180
): Promise<Array<{ captured_at: string; ktc_value: number; fdp_value: number | null }>> {
  const cacheKey = getCacheKey(['player-history', playerId, format, String(days)]);

  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const { data, error } = await supabase
          .from('ktc_value_snapshots')
          .select('captured_at, ktc_value, fdp_value')
          .eq('player_id', playerId)
          .eq('format', format)
          .gte('captured_at', sinceDate.toISOString())
          .order('captured_at', { ascending: true });

        if (error || !data) {
          return [];
        }

        return data.map(row => ({
          captured_at: row.captured_at,
          ktc_value: row.ktc_value || 0,
          fdp_value: row.fdp_value,
        }));
      } catch (err) {
        console.error('Error in getPlayerValueHistory:', err);
        return [];
      }
    },
    HISTORY_CACHE_TTL
  );
}

export async function getAllLatestValues(format: string = 'dynasty_sf'): Promise<PlayerValue[]> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
      .eq('format', format)
      .order('adjusted_value', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching all latest values:', error);
      return [];
    }

    return (data || []).map(row => mapRowToPlayerValue(row, format));
  } catch (err) {
    console.error('Error in getAllLatestValues:', err);
    return [];
  }
}

export async function getValuesSummary(
  format: string = 'dynasty_sf',
  position?: string
): Promise<ValuesSummary | null> {
  try {
    let query = supabase
      .from('latest_player_values')
      .select('adjusted_value, updated_at')
      .eq('format', format);

    if (position) {
      query = query.eq('position', position);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    const values = data.map(r => Number(r.adjusted_value) || 0);
    const total = values.length;
    const avg = total > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / total) : 0;
    const max = total > 0 ? Math.max(...values) : 0;
    const min = total > 0 ? Math.min(...values) : 0;
    const lastUpdated = data.reduce((latest, r) => {
      return r.updated_at > latest ? r.updated_at : latest;
    }, data[0].updated_at);

    return {
      format,
      position,
      total_players: total,
      avg_value: avg,
      max_value: max,
      min_value: min,
      last_updated: lastUpdated,
    };
  } catch (err) {
    console.error('Error in getValuesSummary:', err);
    return null;
  }
}

export async function getTopPlayers(
  format: string = 'dynasty_sf',
  limit: number = 100
): Promise<PlayerValue[]> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
      .eq('format', format)
      .gt('adjusted_value', 0)
      .order('adjusted_value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top players:', error);
      return [];
    }

    return (data || []).map(row => mapRowToPlayerValue(row, format));
  } catch (err) {
    console.error('Error in getTopPlayers:', err);
    return [];
  }
}

export async function searchPlayerValues(
  searchTerm: string,
  format: string = 'dynasty_sf',
  limit: number = 20
): Promise<PlayerValue[]> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
      .eq('format', format)
      .ilike('player_name', `%${searchTerm}%`)
      .order('adjusted_value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching player values:', error);
      return [];
    }

    return (data || []).map(row => mapRowToPlayerValue(row, format));
  } catch (err) {
    console.error('Error in searchPlayerValues:', err);
    return [];
  }
}

export async function getValuesLastUpdated(format: string = 'dynasty_sf'): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('updated_at')
      .eq('format', format)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.updated_at;
  } catch (err) {
    console.error('Error in getValuesLastUpdated:', err);
    return null;
  }
}

export function calculateValueDifference(currentValue: number, previousValue: number): {
  difference: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
} {
  const difference = currentValue - previousValue;
  const percentChange = previousValue > 0 ? (difference / previousValue) * 100 : 0;

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

export async function getMultiplePlayerValues(
  playerIds: string[],
  format: string
): Promise<Map<string, PlayerValue>> {
  if (playerIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at')
      .in('player_id', playerIds)
      .eq('format', format);

    if (error) {
      console.error('Error fetching multiple player values:', error);
      return new Map();
    }

    const valueMap = new Map<string, PlayerValue>();
    (data || []).forEach(row => {
      valueMap.set(row.player_id, mapRowToPlayerValue(row, format));
    });
    return valueMap;
  } catch (err) {
    console.error('Error in getMultiplePlayerValues:', err);
    return new Map();
  }
}

export function invalidateValueCaches(pattern?: string): void {
  if (pattern) {
    cache.invalidatePattern(pattern);
  } else {
    cache.invalidatePattern('latest-values.*');
    cache.invalidatePattern('player-value.*');
    cache.invalidatePattern('player-history.*');
  }
}

export const SUPPORTED_FORMATS = [
  'dynasty_sf',
  'dynasty_1qb',
  'dynasty_tep',
  'dynasty_sf_idp_tackle',
  'dynasty_sf_idp_balanced',
  'dynasty_sf_idp_big_play',
] as const;

export type ValueFormat = typeof SUPPORTED_FORMATS[number];

export const SUPPORTED_POSITIONS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'K',
  'DL',
  'LB',
  'DB',
] as const;

export type PlayerPosition = typeof SUPPORTED_POSITIONS[number];

export function isValidFormat(format: string): format is ValueFormat {
  return SUPPORTED_FORMATS.includes(format as ValueFormat);
}

export function isValidPosition(position: string): position is PlayerPosition {
  return SUPPORTED_POSITIONS.includes(position as PlayerPosition);
}

export function ensureValidValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

export function calculateTradeValue(playerValues: PlayerValue[]): {
  total: number | null;
  breakdown: Array<{ player_id: string; full_name: string; value: number | null }>;
} {
  const breakdown = playerValues.map(pv => ({
    player_id: pv.player_id,
    full_name: pv.full_name,
    value: pv.fdp_value || pv.ktc_value,
  }));

  const hasAnyNull = breakdown.some(b => b.value === null);
  const total = hasAnyNull
    ? null
    : breakdown.reduce((sum, b) => sum + (b.value || 0), 0);

  return { total, breakdown };
}
