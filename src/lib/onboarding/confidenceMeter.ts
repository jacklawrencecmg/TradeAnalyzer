/**
 * Confidence Meter
 *
 * Calculates and displays model confidence based on:
 * - Data completeness
 * - League fit
 * - Prediction accuracy
 *
 * Psychology: Users trust outputs more when confidence is displayed.
 */

import { supabase } from '../supabase';

export interface ConfidenceScore {
  overall: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'very_high';
  components: {
    dataCompleteness: number;
    leagueFit: number;
    predictionAccuracy: number;
  };
  factors: ConfidenceFactor[];
  recommendation: string;
}

export interface ConfidenceFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  status: 'excellent' | 'good' | 'fair' | 'poor';
  details: string;
}

/**
 * Calculate confidence score for user/league
 */
export async function calculateConfidence(
  userId: string,
  leagueId?: string
): Promise<ConfidenceScore> {
  const factors: ConfidenceFactor[] = [];

  // 1. Data Completeness (40% weight)
  const dataScore = await calculateDataCompleteness(userId, leagueId);
  factors.push({
    name: 'Data Completeness',
    score: dataScore,
    weight: 0.4,
    status: getStatus(dataScore),
    details: getDataCompletenessDetails(dataScore),
  });

  // 2. League Fit (35% weight)
  const leagueFitScore = await calculateLeagueFit(leagueId);
  factors.push({
    name: 'League Fit',
    score: leagueFitScore,
    weight: 0.35,
    status: getStatus(leagueFitScore),
    details: getLeagueFitDetails(leagueFitScore),
  });

  // 3. Prediction Accuracy (25% weight)
  const accuracyScore = await calculatePredictionAccuracy(userId);
  factors.push({
    name: 'Historical Accuracy',
    score: accuracyScore,
    weight: 0.25,
    status: getStatus(accuracyScore),
    details: getAccuracyDetails(accuracyScore),
  });

  // Calculate weighted overall score
  const overall = Math.round(
    factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0)
  );

  // Determine level
  let level: 'low' | 'medium' | 'high' | 'very_high';
  if (overall >= 85) level = 'very_high';
  else if (overall >= 70) level = 'high';
  else if (overall >= 50) level = 'medium';
  else level = 'low';

  // Generate recommendation
  const recommendation = generateRecommendation(overall, factors);

  return {
    overall,
    level,
    components: {
      dataCompleteness: dataScore,
      leagueFit: leagueFitScore,
      predictionAccuracy: accuracyScore,
    },
    factors,
    recommendation,
  };
}

/**
 * Calculate data completeness score
 */
async function calculateDataCompleteness(
  userId: string,
  leagueId?: string
): Promise<number> {
  let score = 0;
  const maxScore = 100;

  // League imported (40 points)
  if (leagueId) {
    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .maybeSingle();

    if (league) {
      score += 40;

      // League profile resolved (10 points)
      if (league.league_profile_id) {
        score += 10;
      }

      // Team roster loaded (20 points)
      // TODO: Check if roster data exists
      score += 20;
    }
  }

  // Player values synced (20 points)
  const { data: values } = await supabase
    .from('player_values')
    .select('player_id')
    .limit(1);

  if (values && values.length > 0) {
    score += 20;
  }

  // User has watchlist (10 points)
  const { data: watchlist } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (watchlist && watchlist.length > 0) {
    score += 10;
  }

  return Math.min(score, maxScore);
}

/**
 * Calculate league fit score
 */
async function calculateLeagueFit(leagueId?: string): Promise<number> {
  if (!leagueId) {
    return 0; // No league = no fit
  }

  let score = 0;

  const { data: league } = await supabase
    .from('leagues')
    .select('league_profile_id')
    .eq('id', leagueId)
    .maybeSingle();

  if (!league) {
    return 0;
  }

  // League profile exists (50 points)
  if (league.league_profile_id) {
    score += 50;

    const { data: profile } = await supabase
      .from('league_profiles')
      .select('*')
      .eq('id', league.league_profile_id)
      .maybeSingle();

    if (profile) {
      // Scoring settings configured (25 points)
      if (profile.scoring_multipliers) {
        score += 25;
      }

      // Roster settings configured (25 points)
      if (profile.roster_settings) {
        score += 25;
      }
    }
  } else {
    // No profile = standard scoring assumed (30 points)
    score = 30;
  }

  return Math.min(score, 100);
}

/**
 * Calculate prediction accuracy score
 */
async function calculatePredictionAccuracy(userId: string): Promise<number> {
  // Check for historical predictions
  const { data: predictions } = await supabase
    .from('model_predictions')
    .select('*')
    .eq('user_id', userId)
    .limit(10);

  if (!predictions || predictions.length === 0) {
    // No history = default 70 (neutral)
    return 70;
  }

  // Calculate accuracy from historical data
  const correctPredictions = predictions.filter(
    (p) => p.actual_result === p.predicted_result
  ).length;

  const accuracy = (correctPredictions / predictions.length) * 100;

  return Math.round(accuracy);
}

/**
 * Get status label for score
 */
function getStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Get data completeness details
 */
function getDataCompletenessDetails(score: number): string {
  if (score >= 90) {
    return 'All data loaded and current';
  }
  if (score >= 70) {
    return 'Most data loaded, calculations are reliable';
  }
  if (score >= 50) {
    return 'Core data available, some features limited';
  }
  return 'Import your league to unlock full analysis';
}

/**
 * Get league fit details
 */
function getLeagueFitDetails(score: number): string {
  if (score >= 90) {
    return 'Values perfectly tuned to your league settings';
  }
  if (score >= 70) {
    return 'Values adjusted for your league format';
  }
  if (score >= 50) {
    return 'Using standard scoring assumptions';
  }
  return 'Import league for accurate valuations';
}

/**
 * Get accuracy details
 */
function getAccuracyDetails(score: number): string {
  if (score >= 85) {
    return 'Model has excellent track record';
  }
  if (score >= 70) {
    return 'Model performing well on predictions';
  }
  if (score >= 50) {
    return 'Model still learning your preferences';
  }
  return 'Building prediction history';
}

/**
 * Generate overall recommendation
 */
function generateRecommendation(overall: number, factors: ConfidenceFactor[]): string {
  if (overall >= 85) {
    return 'High confidence — Trust trade recommendations and value insights';
  }

  if (overall >= 70) {
    return 'Good confidence — Recommendations are reliable, cross-reference major trades';
  }

  if (overall >= 50) {
    const lowestFactor = factors.reduce((min, f) => (f.score < min.score ? f : min), factors[0]);

    return `Medium confidence — Improve by: ${lowestFactor.name.toLowerCase()}`;
  }

  return 'Limited confidence — Import your league for accurate analysis';
}

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(
  level: 'low' | 'medium' | 'high' | 'very_high'
): string {
  const colors = {
    very_high: 'bg-green-600 text-white',
    high: 'bg-green-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-red-500 text-white',
  };

  return colors[level];
}

/**
 * Get confidence display text
 */
export function getConfidenceDisplayText(
  level: 'low' | 'medium' | 'high' | 'very_high'
): string {
  const labels = {
    very_high: 'Very High',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return labels[level];
}

/**
 * Quick confidence check (for header display)
 */
export async function getQuickConfidence(
  userId: string,
  leagueId?: string
): Promise<'low' | 'medium' | 'high' | 'very_high'> {
  const score = await calculateConfidence(userId, leagueId);
  return score.level;
}
