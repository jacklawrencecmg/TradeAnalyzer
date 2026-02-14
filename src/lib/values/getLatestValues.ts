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
          .from('ktc_value_snapshots')
          .select('id, player_id, position_rank, ktc_value, fdp_value, captured_at, position')
          .eq('format', format)
          .eq('position', position)
          .order('captured_at', { ascending: false })
          .limit(500);

        if (error) {
          console.error('Error fetching values:', error);
          return [];
        }

        const uniquePlayers = new Map<string, any>();
        data?.forEach(snapshot => {
          if (!uniquePlayers.has(snapshot.player_id)) {
            uniquePlayers.set(snapshot.player_id, snapshot);
          }
        });

        const playerIds = Array.from(uniquePlayers.keys());
        const { data: players, error: playersError } = await supabase
          .from('nfl_players')
          .select('external_id, full_name, player_position, team, status, rookie_year')
          .in('external_id', playerIds)
          .in('status', ['Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR']);

        if (playersError || !players) {
          return [];
        }

        const playerMap = new Map(players.map(p => [p.external_id, p]));

        const results: PlayerValue[] = [];
        uniquePlayers.forEach((snapshot, playerId) => {
          const player = playerMap.get(playerId);
          if (player) {
            results.push({
              player_id: snapshot.player_id,
              external_id: player.external_id,
              full_name: player.full_name,
              player_position: player.player_position,
              team: player.team,
              status: player.status,
              rookie_year: player.rookie_year,
              position_rank: snapshot.position_rank,
              ktc_value: snapshot.ktc_value,
              fdp_value: snapshot.fdp_value,
              captured_at: snapshot.captured_at,
              format,
              snapshot_id: snapshot.id,
            });
          }
        });

        return results.sort((a, b) => {
          if (a.position_rank !== null && b.position_rank !== null) {
            return a.position_rank - b.position_rank;
          }
          if (a.position_rank !== null) return -1;
          if (b.position_rank !== null) return 1;
          return (b.ktc_value || 0) - (a.ktc_value || 0);
        });
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
        const { data: snapshot, error: snapshotError } = await supabase
          .from('ktc_value_snapshots')
          .select('id, player_id, position_rank, ktc_value, fdp_value, captured_at, position')
          .eq('player_id', playerId)
          .eq('format', format)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (snapshotError || !snapshot) {
          return null;
        }

        const { data: player, error: playerError } = await supabase
          .from('nfl_players')
          .select('external_id, full_name, player_position, team, status, rookie_year')
          .eq('external_id', snapshot.player_id)
          .maybeSingle();

        if (playerError || !player) {
          return null;
        }

        return {
          player_id: snapshot.player_id,
          external_id: player.external_id,
          full_name: player.full_name,
          player_position: player.player_position,
          team: player.team,
          status: player.status,
          rookie_year: player.rookie_year,
          position_rank: snapshot.position_rank,
          ktc_value: snapshot.ktc_value,
          fdp_value: snapshot.fdp_value,
          captured_at: snapshot.captured_at,
          format,
          snapshot_id: snapshot.id,
        };
      } catch (err) {
        console.error('Error in getLatestValueForPlayer:', err);
        return null;
      }
    },
    VALUE_CACHE_TTL
  );
}

export async function getPlayerValueHistory(
  playerId: string,
  format: string = 'dynasty_sf',
  days: number = 180
): Promise<Array<{ captured_at: string; ktc_value: number; fdp_value: number | null }>> {
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
}

export async function getAllLatestValues(format: string = 'dynasty_sf'): Promise<PlayerValue[]> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        WITH latest_values AS (
          SELECT DISTINCT ON (player_id)
            player_id,
            player_position,
            position_rank,
            ktc_value,
            fdp_value,
            captured_at,
            format
          FROM ktc_value_snapshots
          WHERE format = $1
          ORDER BY player_id, captured_at DESC
        )
        SELECT
          lv.player_id,
          np.full_name,
          np.player_position,
          np.team,
          lv.position_rank,
          lv.ktc_value,
          lv.fdp_value,
          lv.captured_at,
          lv.format
        FROM latest_values lv
        JOIN nfl_players np ON np.id = lv.player_id
        WHERE np.status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR', 'Free Agent')
        ORDER BY lv.ktc_value DESC
      `,
    });

    if (error) {
      console.error('Error fetching all latest values:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      player_id: row.player_id,
      full_name: row.full_name,
      player_position: row.player_position,
      team: row.team,
      position_rank: row.position_rank,
      ktc_value: row.ktc_value || 0,
      fdp_value: row.fdp_value,
      captured_at: row.captured_at,
      format,
    }));
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
    let query = `
      WITH latest_values AS (
        SELECT DISTINCT ON (player_id)
          player_id,
          player_position,
          ktc_value,
          fdp_value,
          captured_at
        FROM ktc_value_snapshots
        WHERE format = $1
    `;

    if (position) {
      query += ` AND player_position = $2`;
    }

    query += `
        ORDER BY player_id, captured_at DESC
      )
      SELECT
        COUNT(*) as total_players,
        AVG(ktc_value)::int as avg_value,
        MAX(ktc_value) as max_value,
        MIN(ktc_value) as min_value,
        MAX(captured_at) as last_updated
      FROM latest_values lv
      JOIN nfl_players np ON np.id = lv.player_id
      WHERE np.status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR')
    `;

    const { data, error } = await supabase.rpc('execute_sql', { query });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];

    return {
      format,
      position,
      total_players: parseInt(row.total_players) || 0,
      avg_value: parseInt(row.avg_value) || 0,
      max_value: row.max_value || 0,
      min_value: row.min_value || 0,
      last_updated: row.last_updated || new Date().toISOString(),
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
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        WITH latest_values AS (
          SELECT DISTINCT ON (player_id)
            player_id,
            player_position,
            position_rank,
            ktc_value,
            fdp_value,
            captured_at,
            format
          FROM ktc_value_snapshots
          WHERE format = $1
          ORDER BY player_id, captured_at DESC
        )
        SELECT
          lv.player_id,
          np.full_name,
          np.player_position,
          np.team,
          lv.position_rank,
          lv.ktc_value,
          lv.fdp_value,
          lv.captured_at,
          lv.format
        FROM latest_values lv
        JOIN nfl_players np ON np.id = lv.player_id
        WHERE np.status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR')
          AND lv.ktc_value > 0
        ORDER BY lv.ktc_value DESC
        LIMIT $2
      `,
    });

    if (error) {
      console.error('Error fetching top players:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      player_id: row.player_id,
      full_name: row.full_name,
      player_position: row.player_position,
      team: row.team,
      position_rank: row.position_rank,
      ktc_value: row.ktc_value || 0,
      fdp_value: row.fdp_value,
      captured_at: row.captured_at,
      format,
    }));
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
    const { resolvePlayerId } = await import('../players/resolvePlayerId');
    const result = await resolvePlayerId({
      name: searchTerm,
      autoQuarantine: false,
    });

    if (result.success && result.player_id) {
      const value = await getLatestValueForPlayer(result.player_id, format);
      return value ? [value] : [];
    }

    if (result.suggestions && result.suggestions.length > 0) {
      const playerIds = result.suggestions.map(s => s.player_id).slice(0, limit);
      const values: PlayerValue[] = [];

      for (const playerId of playerIds) {
        const value = await getLatestValueForPlayer(playerId, format);
        if (value) {
          values.push(value);
        }
      }

      return values;
    }

    return [];
  } catch (err) {
    console.error('Error in searchPlayerValues:', err);
    return [];
  }
}

export async function getValuesLastUpdated(format: string = 'dynasty_sf'): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ktc_value_snapshots')
      .select('captured_at')
      .eq('format', format)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.captured_at;
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

  const values = await Promise.all(
    playerIds.map(id => getLatestValueForPlayer(id, format))
  );

  const valueMap = new Map<string, PlayerValue>();
  values.forEach((value, index) => {
    if (value) {
      valueMap.set(playerIds[index], value);
    }
  });

  return valueMap;
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
