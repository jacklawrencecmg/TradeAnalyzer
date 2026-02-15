/**
 * Advice Outcome Evaluation
 *
 * Measures if advice was correct:
 * - Buy low success (did player value increase?)
 * - Sell high success (did player value decrease?)
 * - Breakout detection (did production increase?)
 *
 * Compares predicted vs actual direction.
 */

import { supabase } from '../supabase';

export type Direction = 'up' | 'down' | 'neutral';

export interface AdviceOutcome {
  id: string;
  adviceId?: string;
  playerId: string;
  leagueId?: string;
  week: number;
  predictedDirection: Direction;
  actualDirection?: Direction;
  success?: boolean;
  createdAt: string;
  evaluatedAt?: string;
}

/**
 * Record advice prediction
 *
 * Call this when advice is generated (e.g., "buy low on Player X")
 */
export async function recordAdvicePrediction(
  playerId: string,
  predictedDirection: Direction,
  options?: {
    adviceId?: string;
    leagueId?: string;
    week?: number;
  }
): Promise<string | null> {
  try {
    const week = options?.week || getCurrentWeek();

    const { data, error } = await supabase
      .from('advice_outcomes')
      .insert({
        advice_id: options?.adviceId,
        player_id: playerId,
        league_id: options?.leagueId,
        week,
        predicted_direction: predictedDirection,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error recording advice prediction:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('Exception recording advice prediction:', err);
    return null;
  }
}

/**
 * Evaluate advice outcome
 *
 * Run this after the week completes to check if advice was correct.
 * Uses fantasy points vs positional median to determine direction.
 */
export async function evaluateAdviceOutcome(outcomeId: string): Promise<boolean> {
  try {
    // Get outcome record
    const { data: outcome, error: fetchError } = await supabase
      .from('advice_outcomes')
      .select('*')
      .eq('id', outcomeId)
      .maybeSingle();

    if (fetchError || !outcome) {
      console.error('Error fetching outcome:', fetchError);
      return false;
    }

    // Get player performance for the week
    const actualDirection = await getPlayerDirection(outcome.player_id, outcome.week);

    // Determine success
    const success = outcome.predicted_direction === actualDirection;

    // Update outcome
    const { error: updateError } = await supabase
      .from('advice_outcomes')
      .update({
        actual_direction: actualDirection,
        success,
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', outcomeId);

    if (updateError) {
      console.error('Error updating outcome:', updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception evaluating advice outcome:', err);
    return false;
  }
}

/**
 * Get player direction for week
 *
 * Determines if player performed above/below/at positional median
 */
async function getPlayerDirection(playerId: string, week: number): Promise<Direction> {
  try {
    // TODO: Implement actual stats lookup from Sleeper or sportsdata API
    // For now, use player values as proxy

    // Get player value before and after week
    const beforeDate = getWeekStartDate(week);
    const afterDate = getWeekEndDate(week);

    const { data: beforeValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .lte('created_at', beforeDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: afterValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .gte('created_at', afterDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!beforeValue || !afterValue) {
      return 'neutral'; // Insufficient data
    }

    const valueDiff = afterValue.fdp_value - beforeValue.fdp_value;
    const percentChange = (valueDiff / beforeValue.fdp_value) * 100;

    // Significant change thresholds
    if (percentChange > 5) return 'up';
    if (percentChange < -5) return 'down';
    return 'neutral';
  } catch (err) {
    console.error('Exception getting player direction:', err);
    return 'neutral';
  }
}

/**
 * Batch evaluate advice outcomes for week
 *
 * Run this at end of week to evaluate all predictions
 */
export async function evaluateWeekAdviceOutcomes(week: number): Promise<number> {
  const { data: outcomes, error } = await supabase
    .from('advice_outcomes')
    .select('id')
    .eq('week', week)
    .is('evaluated_at', null);

  if (error) {
    console.error('Error fetching outcomes to evaluate:', error);
    return 0;
  }

  let evaluated = 0;

  for (const outcome of outcomes || []) {
    const success = await evaluateAdviceOutcome(outcome.id);
    if (success) evaluated++;
  }

  return evaluated;
}

/**
 * Get advice success rate
 */
export async function getAdviceSuccessRate(
  options?: {
    direction?: Direction;
    startWeek?: number;
    endWeek?: number;
    playerId?: string;
  }
): Promise<{ total: number; successful: number; rate: number }> {
  let query = supabase
    .from('advice_outcomes')
    .select('success')
    .not('success', 'is', null);

  if (options?.direction) {
    query = query.eq('predicted_direction', options.direction);
  }

  if (options?.startWeek) {
    query = query.gte('week', options.startWeek);
  }

  if (options?.endWeek) {
    query = query.lte('week', options.endWeek);
  }

  if (options?.playerId) {
    query = query.eq('player_id', options.playerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error getting advice success rate:', error);
    return { total: 0, successful: 0, rate: 0 };
  }

  const total = data?.length || 0;
  const successful = data?.filter((o) => o.success === true).length || 0;
  const rate = total > 0 ? (successful / total) * 100 : 0;

  return { total, successful, rate };
}

/**
 * Get buy low success rate
 */
export async function getBuyLowSuccessRate(
  startWeek?: number,
  endWeek?: number
): Promise<number> {
  const result = await getAdviceSuccessRate({
    direction: 'up', // Buy low predicts value will go up
    startWeek,
    endWeek,
  });

  return result.rate;
}

/**
 * Get sell high success rate
 */
export async function getSellHighSuccessRate(
  startWeek?: number,
  endWeek?: number
): Promise<number> {
  const result = await getAdviceSuccessRate({
    direction: 'down', // Sell high predicts value will go down
    startWeek,
    endWeek,
  });

  return result.rate;
}

/**
 * Get breakout detection accuracy
 */
export async function getBreakoutDetectionAccuracy(
  startWeek?: number,
  endWeek?: number
): Promise<number> {
  // Breakouts are significant upward moves
  const result = await getAdviceSuccessRate({
    direction: 'up',
    startWeek,
    endWeek,
  });

  return result.rate;
}

/**
 * Get advice performance by player
 */
export async function getPlayerAdvicePerformance(
  playerId: string
): Promise<{ total: number; successful: number; rate: number; recentDirection?: Direction }> {
  const result = await getAdviceSuccessRate({ playerId });

  // Get most recent prediction
  const { data: recent } = await supabase
    .from('advice_outcomes')
    .select('predicted_direction')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...result,
    recentDirection: recent?.predicted_direction as Direction | undefined,
  };
}

/**
 * Get unevaluated outcomes (need evaluation)
 */
export async function getUnevaluatedOutcomes(
  limit: number = 100
): Promise<AdviceOutcome[]> {
  const { data, error } = await supabase
    .from('advice_outcomes')
    .select('*')
    .is('evaluated_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching unevaluated outcomes:', error);
    return [];
  }

  return (data || []).map((o) => ({
    id: o.id,
    adviceId: o.advice_id,
    playerId: o.player_id,
    leagueId: o.league_id,
    week: o.week,
    predictedDirection: o.predicted_direction as Direction,
    actualDirection: o.actual_direction as Direction | undefined,
    success: o.success,
    createdAt: o.created_at,
    evaluatedAt: o.evaluated_at,
  }));
}

/**
 * Helper: Get current NFL week
 */
function getCurrentWeek(): number {
  // TODO: Implement actual NFL week calculation
  // For now, simple approximation
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 1); // Sept 1
  const weeksSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}

/**
 * Helper: Get week start date
 */
function getWeekStartDate(week: number): Date {
  const year = new Date().getFullYear();
  const seasonStart = new Date(year, 8, 1); // Sept 1
  return new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
}

/**
 * Helper: Get week end date
 */
function getWeekEndDate(week: number): Date {
  const start = getWeekStartDate(week);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}
