import { supabase } from '../supabase';

export interface PlayerValue {
  player_id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  position_rank: number | null;
  ktc_value: number;
  fdp_value: number | null;
  captured_at: string;
  format: string;
}

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
  format: string = 'dynasty_sf',
  position: string
): Promise<PlayerValue[]> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        WITH latest_values AS (
          SELECT DISTINCT ON (player_id)
            player_id,
            position_rank,
            ktc_value,
            fdp_value,
            captured_at,
            format
          FROM ktc_value_snapshots
          WHERE format = $1
            AND player_position = $2
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
        ORDER BY lv.position_rank ASC NULLS LAST, lv.ktc_value DESC
      `,
    });

    if (error) {
      console.error('Error fetching latest values by position:', error);
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
    console.error('Error in getLatestValuesByPosition:', err);
    return [];
  }
}

export async function getLatestValueForPlayer(
  playerId: string,
  format: string = 'dynasty_sf'
): Promise<PlayerValue | null> {
  try {
    const { data, error } = await supabase
      .from('ktc_value_snapshots')
      .select(`
        player_id,
        position_rank,
        ktc_value,
        fdp_value,
        captured_at,
        format,
        nfl_players!inner (
          full_name,
          player_position,
          team,
          status
        )
      `)
      .eq('player_id', playerId)
      .eq('format', format)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const player = data.nfl_players as any;

    return {
      player_id: data.player_id,
      full_name: player.full_name,
      player_position: player.player_position,
      team: player.team,
      position_rank: data.position_rank,
      ktc_value: data.ktc_value || 0,
      fdp_value: data.fdp_value,
      captured_at: data.captured_at,
      format: data.format,
    };
  } catch (err) {
    console.error('Error in getLatestValueForPlayer:', err);
    return null;
  }
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
