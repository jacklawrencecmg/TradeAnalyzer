/**
 * Weekly Results Sync Job
 *
 * Fetches actual fantasy performance data and stores in player_weekly_outcomes.
 * This provides the ground truth for measuring prediction accuracy.
 *
 * Sources:
 * - Sleeper API (primary)
 * - ESPN API (fallback)
 * - SportsData.io (comprehensive stats)
 *
 * Runs: Weekly after games complete (Tuesday morning)
 */

import { supabase } from '../supabase';
import { resolvePlayerId } from '../players/resolvePlayerId';

export interface WeeklyOutcome {
  player_name: string;
  player_id?: string;
  position: string;
  season: number;
  week: number;
  fantasy_points: number;
  snap_share?: number;
  target_share?: number;
  opportunity_share?: number;
  games_started: boolean;
  games_played: boolean;
  injured: boolean;
  dnp_reason?: string;
}

export interface SyncResult {
  season: number;
  week: number;
  imported: number;
  matched: number;
  updated: number;
  errors: string[];
}

/**
 * Sync weekly results for a specific week
 *
 * @param season - NFL season year
 * @param week - Week number (1-18)
 * @returns Sync result with statistics
 */
export async function syncWeeklyResults(
  season: number,
  week: number
): Promise<SyncResult> {
  const result: SyncResult = {
    season,
    week,
    imported: 0,
    matched: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch results from data source
    const outcomes = await fetchWeeklyOutcomes(season, week);
    result.imported = outcomes.length;

    // Step 2: Match players and store results
    for (const outcome of outcomes) {
      try {
        // Resolve player ID
        let playerId = outcome.player_id;
        if (!playerId) {
          playerId = await resolvePlayerId(outcome.player_name, outcome.position);
        }

        if (!playerId) {
          result.errors.push(
            `Could not match player: ${outcome.player_name} (${outcome.position})`
          );
          continue;
        }

        // Upsert outcome
        const { error } = await supabase
          .from('player_weekly_outcomes')
          .upsert(
            {
              player_id: playerId,
              season: outcome.season,
              week: outcome.week,
              fantasy_points: outcome.fantasy_points,
              snap_share: outcome.snap_share,
              target_share: outcome.target_share,
              opportunity_share: outcome.opportunity_share,
              games_started: outcome.games_started,
              games_played: outcome.games_played,
              injured: outcome.injured,
              dnp_reason: outcome.dnp_reason,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'player_id,season,week' }
          );

        if (error) {
          result.errors.push(
            `Error storing outcome for ${outcome.player_name}: ${error.message}`
          );
        } else {
          result.matched++;
          result.updated++;
        }
      } catch (error) {
        result.errors.push(
          `Error processing ${outcome.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Fatal error syncing week ${week}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Fetch weekly outcomes from data source
 *
 * Priority: Sleeper > ESPN > SportsData
 *
 * @param season - Season year
 * @param week - Week number
 * @returns Array of outcomes
 */
async function fetchWeeklyOutcomes(
  season: number,
  week: number
): Promise<WeeklyOutcome[]> {
  // Try Sleeper API first
  try {
    return await fetchSleeperWeeklyStats(season, week);
  } catch (error) {
    console.warn('Sleeper API failed, trying fallback sources', error);
  }

  // Try ESPN API as fallback
  try {
    return await fetchESPNWeeklyStats(season, week);
  } catch (error) {
    console.warn('ESPN API failed', error);
  }

  // No data sources available
  throw new Error('All data sources failed');
}

/**
 * Fetch from Sleeper API
 *
 * Sleeper provides weekly stats for all relevant players.
 */
async function fetchSleeperWeeklyStats(
  season: number,
  week: number
): Promise<WeeklyOutcome[]> {
  // Sleeper API: /stats/nfl/regular/{season}/{week}
  const response = await fetch(
    `https://api.sleeper.app/stats/nfl/regular/${season}/${week}`
  );

  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.statusText}`);
  }

  const stats = await response.json();
  const outcomes: WeeklyOutcome[] = [];

  // Sleeper returns object keyed by player_id
  for (const [sleeperId, playerStats] of Object.entries(stats)) {
    const typedStats = playerStats as any;

    // Calculate PPR fantasy points
    const fantasyPoints = calculatePPRPoints(typedStats);

    outcomes.push({
      player_name: typedStats.player_name || 'Unknown',
      player_id: await getPlayerIdFromSleeperId(sleeperId),
      position: typedStats.position || 'UNKNOWN',
      season,
      week,
      fantasy_points: fantasyPoints,
      snap_share: calculateSnapShare(typedStats),
      target_share: calculateTargetShare(typedStats),
      opportunity_share: calculateOpportunityShare(typedStats),
      games_started: typedStats.gs === 1,
      games_played: typedStats.gp === 1,
      injured: typedStats.injury_status !== null,
      dnp_reason: typedStats.injury_status,
    });
  }

  return outcomes;
}

/**
 * Fetch from ESPN API
 */
async function fetchESPNWeeklyStats(
  season: number,
  week: number
): Promise<WeeklyOutcome[]> {
  // ESPN API requires authentication and is more complex
  // This is a placeholder for the implementation
  console.warn('ESPN API not yet implemented');
  return [];
}

/**
 * Calculate PPR fantasy points from stats
 */
function calculatePPRPoints(stats: any): number {
  let points = 0;

  // Passing
  points += (stats.pass_yd || 0) * 0.04; // 1 point per 25 yards
  points += (stats.pass_td || 0) * 4;
  points -= (stats.pass_int || 0) * 2;

  // Rushing
  points += (stats.rush_yd || 0) * 0.1; // 1 point per 10 yards
  points += (stats.rush_td || 0) * 6;

  // Receiving
  points += (stats.rec || 0) * 1; // PPR
  points += (stats.rec_yd || 0) * 0.1; // 1 point per 10 yards
  points += (stats.rec_td || 0) * 6;

  // Fumbles
  points -= (stats.fum_lost || 0) * 2;

  // 2-point conversions
  points += (stats.pass_2pt || 0) * 2;
  points += (stats.rush_2pt || 0) * 2;
  points += (stats.rec_2pt || 0) * 2;

  return Math.round(points * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate snap share
 */
function calculateSnapShare(stats: any): number | undefined {
  if (stats.off_snp && stats.tm_off_snp) {
    return stats.off_snp / stats.tm_off_snp;
  }
  return undefined;
}

/**
 * Calculate target share (for pass catchers)
 */
function calculateTargetShare(stats: any): number | undefined {
  if (stats.rec_tgt && stats.tm_pass_att) {
    return stats.rec_tgt / stats.tm_pass_att;
  }
  return undefined;
}

/**
 * Calculate opportunity share (touches / team plays)
 */
function calculateOpportunityShare(stats: any): number | undefined {
  const touches = (stats.rush_att || 0) + (stats.rec_tgt || 0);
  const teamPlays = (stats.tm_off_snp || 0);

  if (teamPlays > 0) {
    return touches / teamPlays;
  }
  return undefined;
}

/**
 * Get our player_id from Sleeper player_id
 */
async function getPlayerIdFromSleeperId(sleeperId: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('nfl_players')
    .select('id')
    .eq('external_id', sleeperId)
    .eq('provider', 'sleeper')
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return data.id;
}

/**
 * Sync entire season (all weeks)
 *
 * @param season - Season year
 * @param startWeek - Starting week (default 1)
 * @param endWeek - Ending week (default 18)
 * @returns Array of sync results
 */
export async function syncEntireSeason(
  season: number,
  startWeek: number = 1,
  endWeek: number = 18
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (let week = startWeek; week <= endWeek; week++) {
    try {
      const result = await syncWeeklyResults(season, week);
      results.push(result);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({
        season,
        week,
        imported: 0,
        matched: 0,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    }
  }

  return results;
}

/**
 * Get sync status for a season
 *
 * @param season - Season year
 * @returns Array of week statuses
 */
export async function getSeasonSyncStatus(
  season: number
): Promise<
  Array<{
    week: number;
    playerCount: number;
    avgFantasyPoints: number;
    lastSync: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('player_weekly_outcomes')
    .select('week, fantasy_points, updated_at')
    .eq('season', season)
    .order('week');

  if (error || !data) {
    return [];
  }

  // Group by week
  const weekMap = new Map<
    number,
    { count: number; totalPoints: number; lastSync: string }
  >();

  for (const record of data) {
    if (!weekMap.has(record.week)) {
      weekMap.set(record.week, {
        count: 0,
        totalPoints: 0,
        lastSync: record.updated_at,
      });
    }

    const weekData = weekMap.get(record.week)!;
    weekData.count++;
    weekData.totalPoints += record.fantasy_points;
  }

  return Array.from(weekMap.entries()).map(([week, data]) => ({
    week,
    playerCount: data.count,
    avgFantasyPoints: data.totalPoints / data.count,
    lastSync: data.lastSync,
  }));
}

/**
 * Validate weekly results
 *
 * Checks for data quality issues.
 *
 * @param season - Season year
 * @param week - Week number
 * @returns Validation result
 */
export async function validateWeeklyResults(
  season: number,
  week: number
): Promise<{
  valid: boolean;
  warnings: string[];
  stats: {
    totalPlayers: number;
    positionBreakdown: Record<string, number>;
    avgPoints: number;
    outliers: number;
  };
}> {
  const warnings: string[] = [];

  // Fetch results
  const { data: results, error } = await supabase
    .from('player_weekly_outcomes')
    .select(`
      fantasy_points,
      player_id,
      nfl_players!inner (
        player_position
      )
    `)
    .eq('season', season)
    .eq('week', week);

  if (error || !results) {
    return {
      valid: false,
      warnings: ['Failed to fetch results'],
      stats: {
        totalPlayers: 0,
        positionBreakdown: {},
        avgPoints: 0,
        outliers: 0,
      },
    };
  }

  // Calculate stats
  const positionBreakdown: Record<string, number> = {};
  let totalPoints = 0;
  let outliers = 0;

  for (const result of results) {
    const position = (result.nfl_players as any).player_position;
    positionBreakdown[position] = (positionBreakdown[position] || 0) + 1;
    totalPoints += result.fantasy_points;

    // Check for outliers (>60 points is suspicious)
    if (result.fantasy_points > 60) {
      outliers++;
      warnings.push(`Outlier: ${result.fantasy_points} points`);
    }
  }

  const avgPoints = results.length > 0 ? totalPoints / results.length : 0;

  // Validate expected player counts
  const qbCount = positionBreakdown.QB || 0;
  const rbCount = positionBreakdown.RB || 0;
  const wrCount = positionBreakdown.WR || 0;
  const teCount = positionBreakdown.TE || 0;

  if (qbCount < 30) {
    warnings.push(`Only ${qbCount} QBs tracked (expected 32+)`);
  }

  if (rbCount < 50) {
    warnings.push(`Only ${rbCount} RBs tracked (expected 70+)`);
  }

  if (wrCount < 80) {
    warnings.push(`Only ${wrCount} WRs tracked (expected 100+)`);
  }

  if (teCount < 30) {
    warnings.push(`Only ${teCount} TEs tracked (expected 40+)`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      totalPlayers: results.length,
      positionBreakdown,
      avgPoints,
      outliers,
    },
  };
}

/**
 * Backfill historical data
 *
 * Fetches and stores results for past seasons.
 *
 * @param startSeason - Starting season
 * @param endSeason - Ending season
 * @returns Array of sync results
 */
export async function backfillHistoricalData(
  startSeason: number,
  endSeason: number
): Promise<SyncResult[]> {
  const allResults: SyncResult[] = [];

  for (let season = startSeason; season <= endSeason; season++) {
    console.log(`Backfilling season ${season}...`);
    const seasonResults = await syncEntireSeason(season);
    allResults.push(...seasonResults);

    // Add delay between seasons
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return allResults;
}
