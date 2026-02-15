import { supabase } from '../supabase';

interface SleeperWeeklyStats {
  player_id: string;
  stats: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
    gp?: number;
    rec?: number;
    rec_td?: number;
    rec_yd?: number;
    rec_tgt?: number;
    rush_att?: number;
    rush_td?: number;
    rush_yd?: number;
    pass_att?: number;
    pass_cmp?: number;
    pass_td?: number;
    pass_yd?: number;
    pass_int?: number;
  };
}

interface WeeklyStatRow {
  player_id: string;
  season: number;
  week: number;
  fantasy_points: number;
  snap_share?: number;
  usage?: number;
  targets?: number;
  carries?: number;
  receptions?: number;
}

/**
 * Fetch weekly stats from Sleeper for a specific season/week
 */
export async function fetchSleeperWeeklyStats(
  season: number,
  week: number
): Promise<SleeperWeeklyStats[]> {
  try {
    const response = await fetch(
      `https://api.sleeper.com/stats/nfl/regular/${season}/${week}?season_type=regular`
    );

    if (!response.ok) {
      console.warn(`Sleeper stats API returned ${response.status} for ${season} week ${week}`);
      return [];
    }

    const data = await response.json();

    // Sleeper returns object with player_id keys
    const stats: SleeperWeeklyStats[] = [];
    for (const [playerId, playerStats] of Object.entries(data)) {
      stats.push({
        player_id: playerId,
        stats: playerStats as any,
      });
    }

    return stats;
  } catch (error) {
    console.error(`Error fetching Sleeper weekly stats for ${season} week ${week}:`, error);
    return [];
  }
}

/**
 * Calculate fantasy points from stats (PPR scoring)
 */
function calculateFantasyPoints(stats: any): number {
  let points = 0;

  // Use Sleeper's calculated PPR points if available
  if (stats.pts_ppr) {
    return stats.pts_ppr;
  }

  // Otherwise calculate manually
  // Passing
  points += (stats.pass_yd || 0) * 0.04; // 1 pt per 25 yards
  points += (stats.pass_td || 0) * 4;
  points -= (stats.pass_int || 0) * 2;

  // Rushing
  points += (stats.rush_yd || 0) * 0.1; // 1 pt per 10 yards
  points += (stats.rush_td || 0) * 6;

  // Receiving
  points += (stats.rec || 0) * 1; // PPR
  points += (stats.rec_yd || 0) * 0.1; // 1 pt per 10 yards
  points += (stats.rec_td || 0) * 6;

  return Math.round(points * 10) / 10;
}

/**
 * Calculate usage metric (targets + carries)
 */
function calculateUsage(stats: any): number | undefined {
  const targets = stats.rec_tgt || 0;
  const carries = stats.rush_att || 0;
  const total = targets + carries;

  return total > 0 ? total : undefined;
}

/**
 * Sync weekly stats from Sleeper to database
 */
export async function syncWeeklyStats(
  season: number,
  week: number
): Promise<{ synced: number; errors: string[] }> {
  const result = {
    synced: 0,
    errors: [] as string[],
  };

  try {
    const sleeperStats = await fetchSleeperWeeklyStats(season, week);

    if (sleeperStats.length === 0) {
      result.errors.push(`No stats found for ${season} week ${week}`);
      return result;
    }

    const rows: WeeklyStatRow[] = [];

    for (const playerStats of sleeperStats) {
      try {
        // Resolve Sleeper player_id to our nfl_players ID
        const { data: player } = await supabase
          .from('nfl_players')
          .select('id')
          .eq('sleeper_id', playerStats.player_id)
          .maybeSingle();

        if (!player) {
          continue; // Skip unresolved players
        }

        const fantasyPoints = calculateFantasyPoints(playerStats.stats);

        // Only store if player had meaningful activity
        if (fantasyPoints > 0 || (playerStats.stats.gp && playerStats.stats.gp > 0)) {
          rows.push({
            player_id: player.id,
            season,
            week,
            fantasy_points: fantasyPoints,
            usage: calculateUsage(playerStats.stats),
            targets: playerStats.stats.rec_tgt,
            carries: playerStats.stats.rush_att,
            receptions: playerStats.stats.rec,
          });
        }
      } catch (err) {
        result.errors.push(
          `Error processing player ${playerStats.player_id}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }

    // Batch upsert
    if (rows.length > 0) {
      const { error, count } = await supabase
        .from('weekly_player_stats')
        .upsert(rows, {
          onConflict: 'player_id,season,week',
        });

      if (error) {
        result.errors.push(`Database error: ${error.message}`);
      } else {
        result.synced = count || rows.length;
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return result;
  }
}

/**
 * Get recent stats for a player (last N weeks)
 */
export async function getRecentStats(
  playerId: string,
  numWeeks: number = 4
): Promise<WeeklyStatRow[]> {
  const { data, error } = await supabase
    .from('weekly_player_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(numWeeks);

  if (error) {
    console.error('Error fetching recent stats:', error);
    return [];
  }

  return data || [];
}

/**
 * Get season average for a player
 */
export async function getSeasonAverage(
  playerId: string,
  season: number
): Promise<number | null> {
  const { data, error } = await supabase
    .from('weekly_player_stats')
    .select('fantasy_points')
    .eq('player_id', playerId)
    .eq('season', season);

  if (error || !data || data.length === 0) {
    return null;
  }

  const total = data.reduce((sum, row) => sum + (row.fantasy_points || 0), 0);
  return total / data.length;
}

/**
 * Get current NFL season and week
 */
export function getCurrentSeasonWeek(): { season: number; week: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // NFL season runs September (month 9) through February (month 2)
  let season = year;
  if (month >= 9) {
    season = year; // Current year's season
  } else if (month <= 2) {
    season = year - 1; // Last year's season
  } else {
    // Offseason (March-August): use last completed season
    season = year - 1;
  }

  // Estimate week (rough approximation)
  let week = 1;
  if (month === 9) {
    week = Math.min(Math.floor((now.getDate() - 1) / 7) + 1, 4);
  } else if (month === 10) {
    week = 5 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  } else if (month === 11) {
    week = 9 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  } else if (month === 12) {
    week = 13 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  } else if (month === 1) {
    week = 17 + Math.min(Math.floor((now.getDate() - 1) / 7), 1);
  } else if (month === 2 && now.getDate() <= 14) {
    week = 18;
  }

  return { season, week };
}

/**
 * Check if currently in NFL season
 */
export function isInSeason(): boolean {
  const month = new Date().getMonth() + 1;
  return month >= 9 || month <= 2;
}
