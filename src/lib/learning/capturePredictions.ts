/**
 * Prediction Snapshot System
 *
 * Captures model predictions BEFORE games are played.
 * These frozen predictions are used to measure accuracy against actual results.
 *
 * Timing:
 * - Preseason: Capture before Week 1
 * - Weekly: Capture Tuesday before next week's games
 *
 * Storage:
 * - player_value_predictions table
 * - Indexed by player_id, season, week, format
 * - Never modified after capture (historical record)
 */

import { supabase } from '../supabase';

export interface PredictionSnapshot {
  player_id: string;
  player_name: string;
  position: string;
  season: number;
  week: number;
  format: 'dynasty' | 'redraft';
  predicted_rank: number;
  predicted_position_rank: number;
  predicted_value: number;
  confidence_score?: number;
  model_version?: string;
  league_profile_id?: string;
}

export interface CaptureResult {
  season: number;
  week: number;
  format: string;
  captured: number;
  skipped: number;
  errors: string[];
}

/**
 * Capture predictions for a specific week
 *
 * This should be called BEFORE games are played (typically Tuesday).
 *
 * @param season - NFL season year
 * @param week - Week number (0 = preseason, 1-18 = regular season)
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile (defaults to standard)
 * @returns Capture result with statistics
 */
export async function capturePredictions(
  season: number,
  week: number,
  format: 'dynasty' | 'redraft',
  leagueProfileId?: string
): Promise<CaptureResult> {
  const result: CaptureResult = {
    season,
    week,
    format,
    captured: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Step 1: Get current player values from latest_player_values
    const { data: latestValues, error: fetchError } = await supabase
      .from('latest_player_values')
      .select(
        `
        player_id,
        format,
        market_value,
        overall_rank,
        position_rank,
        confidence_score,
        nfl_players!inner (
          full_name,
          player_position
        )
      `
      )
      .eq('format', format)
      .order('overall_rank');

    if (fetchError) {
      result.errors.push(`Error fetching values: ${fetchError.message}`);
      return result;
    }

    if (!latestValues || latestValues.length === 0) {
      result.errors.push('No values found to capture');
      return result;
    }

    // Step 2: Check if predictions already exist for this week
    const { data: existing } = await supabase
      .from('player_value_predictions')
      .select('player_id')
      .eq('season', season)
      .eq('week', week)
      .eq('format', format)
      .limit(1);

    if (existing && existing.length > 0) {
      result.errors.push(
        `Predictions already captured for ${season} Week ${week} (${format})`
      );
      result.skipped = latestValues.length;
      return result;
    }

    // Step 3: Prepare predictions
    const predictions = latestValues.map((value) => ({
      player_id: value.player_id,
      season,
      week,
      format,
      predicted_rank: value.overall_rank,
      predicted_position_rank: value.position_rank,
      predicted_value: value.market_value,
      confidence_score: value.confidence_score,
      model_version: getCurrentModelVersion(),
      league_profile_id: leagueProfileId || null,
    }));

    // Step 4: Batch insert predictions
    const batchSize = 100;
    for (let i = 0; i < predictions.length; i += batchSize) {
      const batch = predictions.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('player_value_predictions')
        .insert(batch);

      if (insertError) {
        result.errors.push(
          `Error inserting batch ${i / batchSize + 1}: ${insertError.message}`
        );
      } else {
        result.captured += batch.length;
      }
    }

    console.log(
      `Captured ${result.captured} predictions for ${season} Week ${week} (${format})`
    );
  } catch (error) {
    result.errors.push(
      `Fatal error capturing predictions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Capture predictions for all formats
 *
 * @param season - Season year
 * @param week - Week number
 * @returns Array of capture results
 */
export async function captureAllFormats(
  season: number,
  week: number
): Promise<CaptureResult[]> {
  const results: CaptureResult[] = [];

  // Capture dynasty predictions
  const dynastyResult = await capturePredictions(season, week, 'dynasty');
  results.push(dynastyResult);

  // Capture redraft predictions
  const redraftResult = await capturePredictions(season, week, 'redraft');
  results.push(redraftResult);

  return results;
}

/**
 * Capture preseason predictions (Week 0)
 *
 * These are the season-long predictions made before any games.
 *
 * @param season - Season year
 * @returns Capture results
 */
export async function capturePreseasonPredictions(
  season: number
): Promise<CaptureResult[]> {
  console.log(`Capturing preseason predictions for ${season}...`);
  return captureAllFormats(season, 0);
}

/**
 * Get current model version
 *
 * This helps track which version of the model made predictions.
 */
function getCurrentModelVersion(): string {
  // Format: YYYY.MM.DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

/**
 * Get prediction capture status for a season
 *
 * @param season - Season year
 * @returns Array of week statuses
 */
export async function getPredictionCaptureStatus(
  season: number
): Promise<
  Array<{
    week: number;
    format: string;
    playerCount: number;
    capturedAt: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('player_value_predictions')
    .select('week, format, created_at')
    .eq('season', season)
    .order('week');

  if (error || !data) {
    return [];
  }

  // Group by week and format
  const statusMap = new Map<
    string,
    { count: number; capturedAt: string }
  >();

  for (const record of data) {
    const key = `${record.week}-${record.format}`;
    if (!statusMap.has(key)) {
      statusMap.set(key, {
        count: 0,
        capturedAt: record.created_at,
      });
    }
    statusMap.get(key)!.count++;
  }

  return Array.from(statusMap.entries()).map(([key, data]) => {
    const [week, format] = key.split('-');
    return {
      week: parseInt(week, 10),
      format,
      playerCount: data.count,
      capturedAt: data.capturedAt,
    };
  });
}

/**
 * Get predictions for a specific player and week
 *
 * @param playerId - Player ID
 * @param season - Season year
 * @param week - Week number
 * @returns Predictions for both formats
 */
export async function getPlayerPredictions(
  playerId: string,
  season: number,
  week: number
): Promise<{
  dynasty: PredictionSnapshot | null;
  redraft: PredictionSnapshot | null;
}> {
  const { data: predictions, error } = await supabase
    .from('player_value_predictions')
    .select(
      `
      *,
      nfl_players!inner (
        full_name,
        player_position
      )
    `
    )
    .eq('player_id', playerId)
    .eq('season', season)
    .eq('week', week);

  if (error || !predictions) {
    return { dynasty: null, redraft: null };
  }

  const dynasty = predictions.find((p) => p.format === 'dynasty');
  const redraft = predictions.find((p) => p.format === 'redraft');

  return {
    dynasty: dynasty
      ? {
          player_id: dynasty.player_id,
          player_name: (dynasty.nfl_players as any).full_name,
          position: (dynasty.nfl_players as any).player_position,
          season: dynasty.season,
          week: dynasty.week,
          format: 'dynasty',
          predicted_rank: dynasty.predicted_rank,
          predicted_position_rank: dynasty.predicted_position_rank,
          predicted_value: dynasty.predicted_value,
          confidence_score: dynasty.confidence_score,
          model_version: dynasty.model_version,
          league_profile_id: dynasty.league_profile_id,
        }
      : null,
    redraft: redraft
      ? {
          player_id: redraft.player_id,
          player_name: (redraft.nfl_players as any).full_name,
          position: (redraft.nfl_players as any).player_position,
          season: redraft.season,
          week: redraft.week,
          format: 'redraft',
          predicted_rank: redraft.predicted_rank,
          predicted_position_rank: redraft.predicted_position_rank,
          predicted_value: redraft.predicted_value,
          confidence_score: redraft.confidence_score,
          model_version: redraft.model_version,
          league_profile_id: redraft.league_profile_id,
        }
      : null,
  };
}

/**
 * Compare prediction vs actual result
 *
 * @param playerId - Player ID
 * @param season - Season year
 * @param week - Week number
 * @returns Comparison data
 */
export async function comparePredictionVsActual(
  playerId: string,
  season: number,
  week: number
): Promise<{
  prediction: PredictionSnapshot | null;
  actual: {
    fantasy_points: number;
    snap_share: number | null;
    games_played: boolean;
  } | null;
  error: number | null;
}> {
  // Get prediction
  const { dynasty, redraft } = await getPlayerPredictions(playerId, season, week);
  const prediction = dynasty || redraft;

  // Get actual result
  const { data: actual, error: actualError } = await supabase
    .from('player_weekly_outcomes')
    .select('fantasy_points, snap_share, games_played')
    .eq('player_id', playerId)
    .eq('season', season)
    .eq('week', week)
    .maybeSingle();

  if (actualError || !actual || !prediction) {
    return {
      prediction,
      actual: actual || null,
      error: null,
    };
  }

  // Calculate error (we'll need to convert fantasy points to rank for true comparison)
  // For now, just return the data
  return {
    prediction,
    actual,
    error: null, // TODO: Calculate rank-based error
  };
}

/**
 * Delete predictions for a specific week
 *
 * USE WITH CAUTION - only for test data cleanup.
 *
 * @param season - Season year
 * @param week - Week number
 * @param format - Optional format filter
 * @returns Number of rows deleted
 */
export async function deletePredictions(
  season: number,
  week: number,
  format?: 'dynasty' | 'redraft'
): Promise<number> {
  let query = supabase
    .from('player_value_predictions')
    .delete()
    .eq('season', season)
    .eq('week', week);

  if (format) {
    query = query.eq('format', format);
  }

  const { data, error } = await query.select();

  if (error) {
    throw new Error(`Error deleting predictions: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Schedule prediction capture job
 *
 * This should be added to your cron system to run weekly.
 *
 * Example cron: 0 6 * * 2 (Tuesday 6am)
 */
export async function scheduledPredictionCapture(): Promise<CaptureResult[]> {
  // Determine current season and week
  const { season, week } = getCurrentSeasonWeek();

  console.log(`Running scheduled prediction capture for ${season} Week ${week}...`);

  // Capture next week's predictions
  return captureAllFormats(season, week + 1);
}

/**
 * Get current NFL season and week
 *
 * This is a simplified version - you'd want more robust season detection.
 */
function getCurrentSeasonWeek(): { season: number; week: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // NFL season runs Sept-Feb
  const season = month >= 9 ? year : year - 1;

  // Calculate week (simplified - you'd want actual week tracking)
  // Sept 1 = Week 1
  const seasonStart = new Date(season, 8, 1); // Sept 1
  const daysSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.min(18, Math.max(1, Math.floor(daysSinceStart / 7) + 1));

  return { season, week };
}

/**
 * Validate prediction capture
 *
 * Ensures predictions were captured correctly.
 *
 * @param season - Season year
 * @param week - Week number
 * @returns Validation result
 */
export async function validatePredictionCapture(
  season: number,
  week: number
): Promise<{
  valid: boolean;
  warnings: string[];
  stats: {
    totalPredictions: number;
    formatBreakdown: Record<string, number>;
    positionBreakdown: Record<string, number>;
  };
}> {
  const warnings: string[] = [];

  // Fetch predictions
  const { data: predictions, error } = await supabase
    .from('player_value_predictions')
    .select(
      `
      format,
      predicted_rank,
      nfl_players!inner (
        player_position
      )
    `
    )
    .eq('season', season)
    .eq('week', week);

  if (error || !predictions) {
    return {
      valid: false,
      warnings: ['Failed to fetch predictions'],
      stats: {
        totalPredictions: 0,
        formatBreakdown: {},
        positionBreakdown: {},
      },
    };
  }

  // Calculate stats
  const formatBreakdown: Record<string, number> = {};
  const positionBreakdown: Record<string, number> = {};

  for (const pred of predictions) {
    formatBreakdown[pred.format] = (formatBreakdown[pred.format] || 0) + 1;

    const position = (pred.nfl_players as any).player_position;
    positionBreakdown[position] = (positionBreakdown[position] || 0) + 1;
  }

  // Validate expected counts
  const dynastyCount = formatBreakdown.dynasty || 0;
  const redraftCount = formatBreakdown.redraft || 0;

  if (dynastyCount < 500) {
    warnings.push(`Only ${dynastyCount} dynasty predictions (expected 800+)`);
  }

  if (redraftCount < 400) {
    warnings.push(`Only ${redraftCount} redraft predictions (expected 500+)`);
  }

  if (Math.abs(dynastyCount - redraftCount) > 300) {
    warnings.push(
      `Large difference between dynasty (${dynastyCount}) and redraft (${redraftCount})`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      totalPredictions: predictions.length,
      formatBreakdown,
      positionBreakdown,
    },
  };
}
