/**
 * Market Position Evaluator
 *
 * Analyzes player's market position by comparing:
 * - Model value (our calculation)
 * - Market value (KTC/consensus)
 * - Recent changes (7d, 24h)
 * - Usage trends
 * - Availability status
 *
 * Returns comprehensive evaluation for advice generation.
 */

import { supabase } from '../supabase';

export interface PlayerMarketPosition {
  playerId: string;
  playerName: string;
  position: string;
  age?: number;

  // Values
  modelValue: number;
  marketValue: number;
  valueDelta: number; // model - market (positive = undervalued)

  // Recent changes
  recentChange7d: number;
  recentChange24h: number;
  recentChangePercent7d: number;

  // Model metrics
  modelRank?: number;
  marketRank?: number;
  rankDelta?: number; // market rank - model rank (positive = overranked in market)

  // Usage & trends
  usageTrend: number; // -1 to 1 scale
  snapShareTrend?: number;
  targetShareTrend?: number;

  // Context
  availabilityStatus: string;
  rosteredPercent?: number;
  injuryStatus?: string;

  // Confidence
  confidence: number; // 0-100 scale
  dataQuality: number; // 0-100 scale

  // Metadata
  format: 'dynasty' | 'redraft';
  evaluatedAt: Date;
}

/**
 * Evaluate player's market position
 *
 * @param playerId - Player ID
 * @param leagueProfileId - Optional league profile for league-specific values
 * @param format - Dynasty or redraft
 * @returns Market position evaluation
 */
export async function evaluatePlayerMarketPosition(
  playerId: string,
  leagueProfileId: string | null,
  format: 'dynasty' | 'redraft'
): Promise<PlayerMarketPosition | null> {
  // Get player data
  const { data: player, error: playerError } = await supabase
    .from('nfl_players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle();

  if (playerError || !player) {
    return null;
  }

  // Get model value (FDP value)
  const modelValue = await getModelValue(playerId, leagueProfileId, format);

  if (!modelValue) {
    return null;
  }

  // Get market value (KTC or consensus)
  const marketValue = await getMarketValue(playerId, format);

  // Calculate value delta
  const valueDelta = modelValue - (marketValue || modelValue);

  // Get recent changes
  const recentChange7d = await getRecentChange(playerId, format, 7);
  const recentChange24h = await getRecentChange(playerId, format, 1);

  const recentChangePercent7d =
    modelValue > 0 ? (recentChange7d / modelValue) * 100 : 0;

  // Get ranks
  const modelRank = await getModelRank(playerId, leagueProfileId, format);
  const marketRank = await getMarketRank(playerId, format);
  const rankDelta = marketRank && modelRank ? marketRank - modelRank : undefined;

  // Get usage trends
  const usageTrend = await calculateUsageTrend(playerId);

  // Get availability
  const availabilityStatus = player.injury_status || 'Healthy';
  const injuryStatus = player.injury_status;

  // Calculate rostered percent (for waiver analysis)
  const rosteredPercent = await getRosteredPercent(playerId);

  // Calculate confidence
  const confidence = calculateConfidence({
    hasMarketValue: !!marketValue,
    hasRecentData: Math.abs(recentChange7d) > 0,
    hasUsageData: usageTrend !== 0,
    dataAge: 0, // Could track this
  });

  const dataQuality = calculateDataQuality({
    hasModelValue: true,
    hasMarketValue: !!marketValue,
    hasRankData: !!modelRank && !!marketRank,
    hasUsageData: usageTrend !== 0,
  });

  return {
    playerId,
    playerName: player.full_name,
    position: player.player_position,
    age: player.age,
    modelValue,
    marketValue: marketValue || modelValue,
    valueDelta,
    recentChange7d,
    recentChange24h,
    recentChangePercent7d,
    modelRank,
    marketRank,
    rankDelta,
    usageTrend,
    availabilityStatus,
    rosteredPercent,
    injuryStatus,
    confidence,
    dataQuality,
    format,
    evaluatedAt: new Date(),
  };
}

/**
 * Get model value (FDP calculated value)
 */
async function getModelValue(
  playerId: string,
  leagueProfileId: string | null,
  format: 'dynasty' | 'redraft'
): Promise<number | null> {
  // Query latest FDP value
  const { data, error } = await supabase
    .from('player_values')
    .select('fdp_value')
    .eq('player_id', playerId)
    .eq('format', format)
    .is('league_profile_id', leagueProfileId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.fdp_value || null;
}

/**
 * Get market value (KTC consensus)
 */
async function getMarketValue(
  playerId: string,
  format: 'dynasty' | 'redraft'
): Promise<number | null> {
  // Query latest KTC value snapshot
  const { data, error } = await supabase
    .from('ktc_value_snapshots')
    .select('value')
    .eq('player_id', playerId)
    .eq('format', format)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.value || null;
}

/**
 * Get recent value change
 */
async function getRecentChange(
  playerId: string,
  format: 'dynasty' | 'redraft',
  days: number
): Promise<number> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const { data, error } = await supabase
    .from('player_value_explanations')
    .select('delta')
    .eq('player_id', playerId)
    .eq('format', format)
    .gte('generated_at', sinceDate.toISOString());

  if (error || !data || data.length === 0) {
    return 0;
  }

  // Sum all deltas in the period
  return data.reduce((sum, row) => sum + row.delta, 0);
}

/**
 * Get model rank
 */
async function getModelRank(
  playerId: string,
  leagueProfileId: string | null,
  format: 'dynasty' | 'redraft'
): Promise<number | null> {
  // Count players with higher FDP value
  const { data: playerValue } = await supabase
    .from('player_values')
    .select('fdp_value')
    .eq('player_id', playerId)
    .eq('format', format)
    .is('league_profile_id', leagueProfileId)
    .maybeSingle();

  if (!playerValue || !playerValue.fdp_value) {
    return null;
  }

  const { count } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', format)
    .is('league_profile_id', leagueProfileId)
    .gt('fdp_value', playerValue.fdp_value);

  return count !== null ? count + 1 : null;
}

/**
 * Get market rank (KTC)
 */
async function getMarketRank(
  playerId: string,
  format: 'dynasty' | 'redraft'
): Promise<number | null> {
  const { data: playerValue } = await supabase
    .from('ktc_value_snapshots')
    .select('value')
    .eq('player_id', playerId)
    .eq('format', format)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!playerValue || !playerValue.value) {
    return null;
  }

  const latestSnapshot = await supabase
    .from('ktc_value_snapshots')
    .select('snapshot_date')
    .eq('format', format)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnapshot) {
    return null;
  }

  const { count } = await supabase
    .from('ktc_value_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('format', format)
    .eq('snapshot_date', latestSnapshot.data.snapshot_date)
    .gt('value', playerValue.value);

  return count !== null ? count + 1 : null;
}

/**
 * Calculate usage trend
 *
 * Returns -1 to 1 scale:
 * - 1.0 = Strong upward trend
 * - 0.0 = No trend / stable
 * - -1.0 = Strong downward trend
 */
async function calculateUsageTrend(playerId: string): Promise<number> {
  // Query recent role changes or adjustments
  const { data, error } = await supabase
    .from('player_value_adjustments')
    .select('adjustment_type, adjustment_value')
    .eq('player_id', playerId)
    .in('adjustment_type', ['role_change', 'opportunity', 'usage'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data || data.length === 0) {
    return 0;
  }

  // Calculate trend from adjustments
  let trendScore = 0;

  for (const adjustment of data) {
    if (adjustment.adjustment_type === 'role_change') {
      trendScore += adjustment.adjustment_value > 0 ? 0.3 : -0.3;
    } else if (adjustment.adjustment_type === 'opportunity') {
      trendScore += (adjustment.adjustment_value / 1000) * 0.5;
    }
  }

  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, trendScore));
}

/**
 * Get rostered percent (for waiver analysis)
 */
async function getRosteredPercent(playerId: string): Promise<number | null> {
  // This would come from Sleeper API or similar
  // For now, estimate based on value/rank
  // TODO: Implement actual rostered % tracking
  return null;
}

/**
 * Calculate confidence in evaluation
 *
 * Higher confidence when:
 * - Market value available (not just model)
 * - Recent data available
 * - Usage data available
 * - Data is fresh
 */
function calculateConfidence(factors: {
  hasMarketValue: boolean;
  hasRecentData: boolean;
  hasUsageData: boolean;
  dataAge: number; // days
}): number {
  let confidence = 50; // Base confidence

  if (factors.hasMarketValue) {
    confidence += 25; // Market value adds significant confidence
  }

  if (factors.hasRecentData) {
    confidence += 15; // Recent changes add confidence
  }

  if (factors.hasUsageData) {
    confidence += 10; // Usage trends add confidence
  }

  // Reduce for stale data
  if (factors.dataAge > 7) {
    confidence -= 10;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Calculate data quality score
 *
 * How complete is our data for this player?
 */
function calculateDataQuality(factors: {
  hasModelValue: boolean;
  hasMarketValue: boolean;
  hasRankData: boolean;
  hasUsageData: boolean;
}): number {
  let quality = 0;

  if (factors.hasModelValue) quality += 30;
  if (factors.hasMarketValue) quality += 30;
  if (factors.hasRankData) quality += 20;
  if (factors.hasUsageData) quality += 20;

  return quality;
}

/**
 * Batch evaluate players
 *
 * More efficient when evaluating many players at once.
 */
export async function batchEvaluateMarketPosition(
  playerIds: string[],
  leagueProfileId: string | null,
  format: 'dynasty' | 'redraft'
): Promise<Map<string, PlayerMarketPosition>> {
  const results = new Map<string, PlayerMarketPosition>();

  // Process in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);

    const evaluations = await Promise.all(
      batch.map((playerId) =>
        evaluatePlayerMarketPosition(playerId, leagueProfileId, format)
      )
    );

    for (const evaluation of evaluations) {
      if (evaluation) {
        results.set(evaluation.playerId, evaluation);
      }
    }
  }

  return results;
}

/**
 * Get replacement level value for position
 *
 * Used for waiver wire analysis.
 */
export async function getReplacementLevelValue(
  position: string,
  format: 'dynasty' | 'redraft'
): Promise<number> {
  // Replacement level is approximately the 36th ranked player at each position
  const replacementRank = 36;

  const { data, error } = await supabase
    .from('player_values')
    .select('fdp_value')
    .eq('format', format)
    .is('league_profile_id', null)
    .order('fdp_value', { ascending: false })
    .range(replacementRank - 1, replacementRank - 1);

  if (error || !data || data.length === 0) {
    // Default replacement values by position
    const defaults: Record<string, number> = {
      QB: 2000,
      RB: 1800,
      WR: 1600,
      TE: 1200,
    };
    return defaults[position] || 1500;
  }

  return data[0].fdp_value || 1500;
}
