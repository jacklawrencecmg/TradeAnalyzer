import { supabase } from '../supabase';

export interface PlayerHistoryPoint {
  captured_at: string;
  ktc_value: number;
  fdp_value: number;
}

export interface PlayerInfo {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
}

export async function getPlayerValueHistory(
  playerId: string,
  format: string = 'dynasty_sf',
  daysBack: number = 180
): Promise<{ ok: boolean; history: PlayerHistoryPoint[]; error?: string }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('ktc_value_snapshots')
      .select('captured_at, ktc_value, fdp_value')
      .eq('player_id', playerId)
      .eq('format', format)
      .gte('captured_at', cutoffDate.toISOString())
      .order('captured_at', { ascending: true });

    if (error) {
      return { ok: false, history: [], error: error.message };
    }

    if (!data || data.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('ktc_value_snapshots')
        .select('captured_at, ktc_value, fdp_value')
        .eq('player_id', playerId)
        .eq('format', format)
        .order('captured_at', { ascending: false })
        .limit(200);

      if (fallbackError) {
        return { ok: false, history: [], error: fallbackError.message };
      }

      return {
        ok: true,
        history: (fallbackData || []).reverse(),
      };
    }

    return {
      ok: true,
      history: data,
    };
  } catch (error) {
    return {
      ok: false,
      history: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getPlayerLatestValue(
  playerId: string,
  format: string = 'dynasty_sf'
): Promise<{ ok: boolean; data?: PlayerInfo; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, team, ktc_value, fdp_value, position_rank')
      .eq('player_id', playerId)
      .eq('format', format)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: false, error: 'Player not found' };
    }

    return {
      ok: true,
      data: {
        player_id: data.player_id,
        player_name: data.full_name,
        position: data.position,
        team: data.team,
        ktc_value: data.ktc_value,
        fdp_value: data.fdp_value,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function searchPlayers(
  query: string,
  limit: number = 10
): Promise<{ ok: boolean; results: PlayerInfo[]; error?: string }> {
  try {
    if (!query || query.trim().length === 0) {
      return { ok: true, results: [] };
    }

    const searchTerm = query.trim().toLowerCase();

    const { data: allSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, team, ktc_value, fdp_value, captured_at')
      .eq('format', 'dynasty_sf')
      .order('captured_at', { ascending: false });

    if (error) {
      return { ok: false, results: [], error: error.message };
    }

    const latestByPlayer = new Map<string, any>();
    for (const snapshot of allSnapshots || []) {
      if (!latestByPlayer.has(snapshot.player_id)) {
        latestByPlayer.set(snapshot.player_id, snapshot);
      }
    }

    const matches = Array.from(latestByPlayer.values())
      .filter((player) => {
        const name = player.full_name.toLowerCase();
        return name.includes(searchTerm) || searchTerm.includes(name.split(' ')[0]);
      })
      .sort((a, b) => {
        const aName = a.full_name.toLowerCase();
        const bName = b.full_name.toLowerCase();

        if (aName.startsWith(searchTerm)) return -1;
        if (bName.startsWith(searchTerm)) return 1;

        return b.fdp_value - a.fdp_value;
      })
      .slice(0, limit)
      .map((player) => ({
        player_id: player.player_id,
        player_name: player.full_name,
        position: player.position,
        team: player.team,
        ktc_value: player.ktc_value,
        fdp_value: player.fdp_value,
      }));

    return { ok: true, results: matches };
  } catch (error) {
    return {
      ok: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function calculateTrend(history: PlayerHistoryPoint[], days: number = 7): 'up' | 'down' | 'stable' {
  if (history.length < 2) return 'stable';

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentHistory = history.filter(
    (point) => new Date(point.captured_at) >= cutoffDate
  );

  if (recentHistory.length < 2) {
    const oldest = history[0];
    const newest = history[history.length - 1];
    const diff = newest.fdp_value - oldest.fdp_value;

    if (diff > 200) return 'up';
    if (diff < -200) return 'down';
    return 'stable';
  }

  const oldest = recentHistory[0];
  const newest = recentHistory[recentHistory.length - 1];
  const diff = newest.fdp_value - oldest.fdp_value;

  if (diff > 200) return 'up';
  if (diff < -200) return 'down';
  return 'stable';
}

export function calculateBadges(history: PlayerHistoryPoint[]): {
  breakout: boolean;
  fallingKnife: boolean;
  volatile: boolean;
} {
  if (history.length < 5) {
    return { breakout: false, fallingKnife: false, volatile: false };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = history.filter(
    (point) => new Date(point.captured_at) >= thirtyDaysAgo
  );

  if (last30Days.length < 2) {
    return { breakout: false, fallingKnife: false, volatile: false };
  }

  const oldest = last30Days[0];
  const newest = last30Days[last30Days.length - 1];
  const change = newest.fdp_value - oldest.fdp_value;

  const values = last30Days.map((p) => p.fdp_value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    breakout: change > 800,
    fallingKnife: change < -800,
    volatile: stdDev > 500,
  };
}
