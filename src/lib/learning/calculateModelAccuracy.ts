/**
 * Model Accuracy Calculator
 *
 * Measures how accurate predictions were compared to actual fantasy results.
 * Calculates error metrics, detects biases, and identifies improvement opportunities.
 *
 * Process:
 * 1. Load predictions (frozen before games)
 * 2. Load actual results (after games)
 * 3. Convert actual fantasy points to rankings
 * 4. Calculate prediction errors
 * 5. Detect systematic biases
 * 6. Store accuracy metrics
 *
 * Runs: Weekly after all games complete (Tuesday after MNF)
 */

import { supabase } from '../supabase';

export interface AccuracyMetrics {
  season: number;
  week: number;
  position: string;
  format: 'dynasty' | 'redraft';
  sample_size: number;
  avg_error: number;
  median_error: number;
  max_error: number;
  overvalued_bias: number; // Positive if we consistently rank players too high
  undervalued_bias: number; // Positive if we consistently rank players too low
  accuracy_score: number; // 0-1, higher is better
}

export interface BiasDetection {
  position: string;
  bias_type: 'overvalued' | 'undervalued' | 'none';
  magnitude: number;
  confidence: number;
  sample_size: number;
  examples: string[];
}

export interface CalculationResult {
  season: number;
  week: number;
  metrics: AccuracyMetrics[];
  biases: BiasDetection[];
  errors: string[];
}

/**
 * Calculate accuracy for a specific week
 *
 * @param season - Season year
 * @param week - Week number
 * @returns Calculation result with metrics and biases
 */
export async function calculateModelAccuracy(
  season: number,
  week: number
): Promise<CalculationResult> {
  const result: CalculationResult = {
    season,
    week,
    metrics: [],
    biases: [],
    errors: [],
  };

  try {
    // Process both formats
    for (const format of ['dynasty', 'redraft'] as const) {
      const formatMetrics = await calculateFormatAccuracy(season, week, format);
      result.metrics.push(...formatMetrics);
    }

    // Detect biases from metrics
    result.biases = detectBiasesFromMetrics(result.metrics);

    // Store metrics in database
    for (const metric of result.metrics) {
      await storeAccuracyMetric(metric);
    }

    console.log(
      `Calculated accuracy for ${season} Week ${week}: ${result.metrics.length} metrics, ${result.biases.length} biases detected`
    );
  } catch (error) {
    result.errors.push(
      `Error calculating accuracy: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Calculate accuracy for a specific format
 */
async function calculateFormatAccuracy(
  season: number,
  week: number,
  format: 'dynasty' | 'redraft'
): Promise<AccuracyMetrics[]> {
  const metrics: AccuracyMetrics[] = [];

  // Step 1: Get predictions for this week
  const { data: predictions, error: predError } = await supabase
    .from('player_value_predictions')
    .select(
      `
      player_id,
      predicted_rank,
      predicted_position_rank,
      nfl_players!inner (
        full_name,
        player_position
      )
    `
    )
    .eq('season', season)
    .eq('week', week)
    .eq('format', format);

  if (predError || !predictions || predictions.length === 0) {
    console.warn(`No predictions found for ${season} Week ${week} (${format})`);
    return metrics;
  }

  // Step 2: Get actual results for this week
  const { data: outcomes, error: outcomeError } = await supabase
    .from('player_weekly_outcomes')
    .select(
      `
      player_id,
      fantasy_points,
      nfl_players!inner (
        player_position
      )
    `
    )
    .eq('season', season)
    .eq('week', week)
    .eq('games_played', true);

  if (outcomeError || !outcomes) {
    console.warn(`No outcomes found for ${season} Week ${week}`);
    return metrics;
  }

  // Step 3: Convert outcomes to rankings
  const actualRankings = calculateActualRankings(outcomes);

  // Step 4: Match predictions to actuals and calculate errors
  const positions = ['QB', 'RB', 'WR', 'TE'];

  for (const position of positions) {
    const positionPredictions = predictions.filter(
      (p) => (p.nfl_players as any).player_position === position
    );

    const positionActuals = actualRankings.filter((a) => a.position === position);

    if (positionPredictions.length === 0 || positionActuals.length === 0) {
      continue;
    }

    // Calculate errors for each player
    const errors: number[] = [];
    let overvaluedCount = 0;
    let undervaluedCount = 0;

    for (const pred of positionPredictions) {
      const actual = positionActuals.find((a) => a.player_id === pred.player_id);

      if (!actual) {
        continue; // Player didn't play this week
      }

      const error = Math.abs(pred.predicted_position_rank - actual.position_rank);
      errors.push(error);

      // Track bias direction
      if (pred.predicted_position_rank < actual.position_rank) {
        overvaluedCount++; // We ranked them higher than they performed
      } else if (pred.predicted_position_rank > actual.position_rank) {
        undervaluedCount++; // We ranked them lower than they performed
      }
    }

    if (errors.length === 0) {
      continue;
    }

    // Calculate metrics
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const sortedErrors = [...errors].sort((a, b) => a - b);
    const medianError = sortedErrors[Math.floor(sortedErrors.length / 2)];
    const maxError = Math.max(...errors);

    const overvaluedBias = overvaluedCount / errors.length;
    const undervaluedBias = undervaluedCount / errors.length;

    const accuracyScore = calculateAccuracyScore(avgError, errors.length);

    metrics.push({
      season,
      week,
      position,
      format,
      sample_size: errors.length,
      avg_error: Math.round(avgError * 100) / 100,
      median_error: medianError,
      max_error: maxError,
      overvalued_bias: Math.round(overvaluedBias * 100) / 100,
      undervalued_bias: Math.round(undervaluedBias * 100) / 100,
      accuracy_score: accuracyScore,
    });
  }

  return metrics;
}

/**
 * Calculate actual rankings from weekly outcomes
 */
function calculateActualRankings(
  outcomes: any[]
): Array<{ player_id: string; position: string; position_rank: number; overall_rank: number }> {
  // Group by position
  const byPosition = new Map<string, any[]>();

  for (const outcome of outcomes) {
    const position = (outcome.nfl_players as any).player_position;
    if (!byPosition.has(position)) {
      byPosition.set(position, []);
    }
    byPosition.get(position)!.push(outcome);
  }

  // Rank within each position
  const rankings: Array<{
    player_id: string;
    position: string;
    position_rank: number;
    overall_rank: number;
  }> = [];

  for (const [position, players] of byPosition.entries()) {
    // Sort by fantasy points (descending)
    const sorted = players.sort((a, b) => b.fantasy_points - a.fantasy_points);

    sorted.forEach((player, index) => {
      rankings.push({
        player_id: player.player_id,
        position,
        position_rank: index + 1,
        overall_rank: 0, // Will calculate if needed
      });
    });
  }

  // Calculate overall rankings
  const allSorted = outcomes.sort((a, b) => b.fantasy_points - a.fantasy_points);
  allSorted.forEach((outcome, index) => {
    const ranking = rankings.find((r) => r.player_id === outcome.player_id);
    if (ranking) {
      ranking.overall_rank = index + 1;
    }
  });

  return rankings;
}

/**
 * Calculate accuracy score from average error
 *
 * Formula: 1.0 - (avg_error / 100)
 * Adjusted for sample size confidence
 */
function calculateAccuracyScore(avgError: number, sampleSize: number): number {
  let score = 1.0 - avgError / 100.0;

  // Clamp to 0..1
  score = Math.max(0, Math.min(1, score));

  // Reduce confidence for small samples
  if (sampleSize < 10) {
    score *= sampleSize / 10.0;
  }

  return Math.round(score * 1000) / 1000; // 3 decimal places
}

/**
 * Detect biases from accuracy metrics
 */
function detectBiasesFromMetrics(metrics: AccuracyMetrics[]): BiasDetection[] {
  const biases: BiasDetection[] = [];

  // Group by position
  const byPosition = new Map<string, AccuracyMetrics[]>();

  for (const metric of metrics) {
    if (!byPosition.has(metric.position)) {
      byPosition.set(metric.position, []);
    }
    byPosition.get(metric.position)!.push(metric);
  }

  // Analyze each position
  for (const [position, posMetrics] of byPosition.entries()) {
    const avgOvervaluedBias =
      posMetrics.reduce((sum, m) => sum + m.overvalued_bias, 0) / posMetrics.length;
    const avgUndervaluedBias =
      posMetrics.reduce((sum, m) => sum + m.undervalued_bias, 0) / posMetrics.length;
    const totalSamples = posMetrics.reduce((sum, m) => sum + m.sample_size, 0);

    // Detect significant bias (>60% in one direction)
    if (avgOvervaluedBias > 0.6) {
      biases.push({
        position,
        bias_type: 'overvalued',
        magnitude: avgOvervaluedBias - 0.5, // Above neutral 50%
        confidence: Math.min(1, totalSamples / 50), // More samples = more confidence
        sample_size: totalSamples,
        examples: [], // TODO: Add specific player examples
      });
    } else if (avgUndervaluedBias > 0.6) {
      biases.push({
        position,
        bias_type: 'undervalued',
        magnitude: avgUndervaluedBias - 0.5,
        confidence: Math.min(1, totalSamples / 50),
        sample_size: totalSamples,
        examples: [],
      });
    }
  }

  return biases;
}

/**
 * Store accuracy metric in database
 */
async function storeAccuracyMetric(metric: AccuracyMetrics): Promise<void> {
  const { error } = await supabase.from('model_accuracy_history').upsert(
    {
      season: metric.season,
      week: metric.week,
      position: metric.position,
      format: metric.format,
      sample_size: metric.sample_size,
      avg_error: metric.avg_error,
      median_error: metric.median_error,
      max_error: metric.max_error,
      overvalued_bias: metric.overvalued_bias,
      undervalued_bias: metric.undervalued_bias,
      accuracy_score: metric.accuracy_score,
    },
    { onConflict: 'season,week,position,format' }
  );

  if (error) {
    console.error(`Error storing accuracy metric: ${error.message}`);
  }
}

/**
 * Get accuracy trends over time
 *
 * @param position - Position to analyze
 * @param format - Dynasty or redraft
 * @param weeks - Number of recent weeks to analyze
 * @returns Trend data
 */
export async function getAccuracyTrends(
  position: string,
  format: 'dynasty' | 'redraft',
  weeks: number = 4
): Promise<{
  position: string;
  format: string;
  avg_error_trend: number[];
  accuracy_score_trend: number[];
  bias_trend: number[];
  improving: boolean;
}> {
  const { data: metrics, error } = await supabase
    .from('model_accuracy_history')
    .select('avg_error, accuracy_score, overvalued_bias, undervalued_bias')
    .eq('position', position)
    .eq('format', format)
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(weeks);

  if (error || !metrics || metrics.length === 0) {
    return {
      position,
      format,
      avg_error_trend: [],
      accuracy_score_trend: [],
      bias_trend: [],
      improving: false,
    };
  }

  const avgErrorTrend = metrics.map((m) => m.avg_error).reverse();
  const accuracyScoreTrend = metrics.map((m) => m.accuracy_score).reverse();
  const biasTrend = metrics
    .map((m) => m.overvalued_bias - m.undervalued_bias)
    .reverse();

  // Determine if improving (lower error over time)
  const recentError = avgErrorTrend[avgErrorTrend.length - 1];
  const oldError = avgErrorTrend[0];
  const improving = recentError < oldError;

  return {
    position,
    format,
    avg_error_trend: avgErrorTrend,
    accuracy_score_trend: accuracyScoreTrend,
    bias_trend: biasTrend,
    improving,
  };
}

/**
 * Get biggest prediction misses
 *
 * @param season - Season year
 * @param week - Week number
 * @param limit - Number of misses to return
 * @returns Array of biggest misses
 */
export async function getBiggestMisses(
  season: number,
  week: number,
  limit: number = 10
): Promise<
  Array<{
    player_name: string;
    position: string;
    predicted_rank: number;
    actual_rank: number;
    error: number;
    fantasy_points: number;
  }>
> {
  // This requires joining predictions with outcomes
  // Complex query, returning placeholder
  return [];
}

/**
 * Calculate season-long accuracy
 *
 * @param season - Season year
 * @param format - Dynasty or redraft
 * @returns Season accuracy summary
 */
export async function calculateSeasonAccuracy(
  season: number,
  format: 'dynasty' | 'redraft'
): Promise<{
  season: number;
  format: string;
  weeks_analyzed: number;
  avg_error: number;
  accuracy_score: number;
  position_breakdown: Record<string, { avg_error: number; accuracy_score: number }>;
}> {
  const { data: metrics, error } = await supabase
    .from('model_accuracy_history')
    .select('*')
    .eq('season', season)
    .eq('format', format);

  if (error || !metrics || metrics.length === 0) {
    return {
      season,
      format,
      weeks_analyzed: 0,
      avg_error: 0,
      accuracy_score: 0,
      position_breakdown: {},
    };
  }

  const weeksAnalyzed = new Set(metrics.map((m) => m.week)).size;
  const avgError =
    metrics.reduce((sum, m) => sum + m.avg_error * m.sample_size, 0) /
    metrics.reduce((sum, m) => sum + m.sample_size, 0);
  const accuracyScore =
    metrics.reduce((sum, m) => sum + m.accuracy_score * m.sample_size, 0) /
    metrics.reduce((sum, m) => sum + m.sample_size, 0);

  // Position breakdown
  const positionBreakdown: Record<string, { avg_error: number; accuracy_score: number }> = {};

  const positions = ['QB', 'RB', 'WR', 'TE'];
  for (const position of positions) {
    const posMetrics = metrics.filter((m) => m.position === position);
    if (posMetrics.length > 0) {
      const posAvgError =
        posMetrics.reduce((sum, m) => sum + m.avg_error * m.sample_size, 0) /
        posMetrics.reduce((sum, m) => sum + m.sample_size, 0);
      const posAccuracy =
        posMetrics.reduce((sum, m) => sum + m.accuracy_score * m.sample_size, 0) /
        posMetrics.reduce((sum, m) => sum + m.sample_size, 0);

      positionBreakdown[position] = {
        avg_error: Math.round(posAvgError * 100) / 100,
        accuracy_score: Math.round(posAccuracy * 1000) / 1000,
      };
    }
  }

  return {
    season,
    format,
    weeks_analyzed: weeksAnalyzed,
    avg_error: Math.round(avgError * 100) / 100,
    accuracy_score: Math.round(accuracyScore * 1000) / 1000,
    position_breakdown: positionBreakdown,
  };
}

/**
 * Scheduled accuracy calculation
 *
 * Runs weekly after games complete (Tuesday).
 */
export async function scheduledAccuracyCalculation(): Promise<CalculationResult> {
  // Get current season and week
  const { season, week } = getCurrentSeasonWeek();

  console.log(`Running scheduled accuracy calculation for ${season} Week ${week}...`);

  // Calculate for just-completed week
  return calculateModelAccuracy(season, week);
}

/**
 * Get current NFL season and week
 */
function getCurrentSeasonWeek(): { season: number; week: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const season = month >= 9 ? year : year - 1;
  const seasonStart = new Date(season, 8, 1);
  const daysSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.min(18, Math.max(1, Math.floor(daysSinceStart / 7) + 1));

  return { season, week };
}
