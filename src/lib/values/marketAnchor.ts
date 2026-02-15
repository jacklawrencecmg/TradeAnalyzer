/**
 * Market Consensus Anchor System
 *
 * Gently aligns model values with external market consensus to prevent unrealistic outliers.
 * This provides stability and builds trust WITHOUT overriding the model's intelligence.
 *
 * Key Principles:
 * 1. Soft pull, not override (15-35% anchor strength)
 * 2. Elite players barely move (15% strength)
 * 3. Deep players track market more (35% strength)
 * 4. Breakout protection (reduces anchor for emerging stars)
 * 5. Outlier guardrails (flags extreme differences)
 * 6. Confidence scoring (shows model vs market agreement)
 *
 * Pipeline Position: Step 5 (after scarcity, before ranking)
 */

import { rankToValue, valueToRank } from './rankToValue';
import { supabase } from '../supabase';

export interface MarketAnchorInput {
  player_id: string;
  position: string;
  model_value: number;
  model_rank: number;
  market_rank?: number;
  production_percentile?: number; // For breakout protection
  league_profile_id: string;
  format: 'dynasty' | 'redraft';
}

export interface MarketAnchorResult {
  anchored_value: number;
  anchor_adjustment: number;
  anchor_strength: number;
  market_value: number;
  market_rank: number | null;
  confidence_score: number;
  is_outlier: boolean;
  is_breakout_protected: boolean;
  explanation: string;
}

/**
 * Anchor strength by tier
 * Elite players move less, deep players track market more
 */
const ANCHOR_STRENGTH_BY_TIER = {
  tier1: 0.15, // Ranks 1-24 (elite, barely move)
  tier2: 0.20, // Ranks 25-60 (solid starters)
  tier3: 0.25, // Ranks 61-120 (flex/depth)
  tier4: 0.35, // Ranks 120+ (deep, track market more)
};

/**
 * Outlier threshold (rank difference)
 * If model and market differ by more than this, flag as outlier
 */
const OUTLIER_THRESHOLD = 120;

/**
 * Breakout protection threshold
 * If production percentile >= 90th, player is likely breaking out
 */
const BREAKOUT_PERCENTILE = 90;

/**
 * Breakout protection reduces anchor strength by this factor
 */
const BREAKOUT_REDUCTION_FACTOR = 0.6; // 60% reduction

/**
 * Maximum anchor pull for outliers
 * Even for extreme outliers, don't pull more than 25%
 */
const MAX_OUTLIER_ANCHOR = 0.25;

/**
 * Apply market consensus anchoring to a player value
 *
 * This is the main entry point for anchoring.
 *
 * @param input - Player data and model value
 * @returns Anchored value with debug info
 */
export async function applyMarketAnchor(
  input: MarketAnchorInput
): Promise<MarketAnchorResult> {
  // 1. Get market rank (if available)
  const marketRank = input.market_rank || (await getMarketRank(input.player_id, input.format));

  if (!marketRank) {
    // No market data available, return model value unchanged
    return {
      anchored_value: input.model_value,
      anchor_adjustment: 0,
      anchor_strength: 0,
      market_value: input.model_value,
      market_rank: null,
      confidence_score: 0.5, // Neutral confidence
      is_outlier: false,
      is_breakout_protected: false,
      explanation: 'No market data available',
    };
  }

  // 2. Convert market rank to market value
  const marketValue = rankToValue(marketRank);

  // 3. Calculate difference
  const difference = marketValue - input.model_value;
  const rankDifference = Math.abs(marketRank - input.model_rank);

  // 4. Determine if outlier
  const isOutlier = rankDifference > OUTLIER_THRESHOLD;

  // 5. Determine if breakout protected
  const isBreakoutProtected =
    input.production_percentile !== undefined &&
    input.production_percentile >= BREAKOUT_PERCENTILE;

  // 6. Get base anchor strength by tier
  let anchorStrength = getAnchorStrengthByTier(input.model_rank);

  // 7. Apply breakout protection (reduces anchor strength)
  if (isBreakoutProtected) {
    anchorStrength *= (1 - BREAKOUT_REDUCTION_FACTOR);
  }

  // 8. Apply outlier guardrail (cap anchor strength for extreme differences)
  if (isOutlier) {
    anchorStrength = Math.min(anchorStrength, MAX_OUTLIER_ANCHOR);
  }

  // 9. Apply anchor adjustment
  const anchorAdjustment = Math.round(difference * anchorStrength);
  const anchoredValue = input.model_value + anchorAdjustment;

  // 10. Clamp to valid range
  const finalValue = Math.max(0, Math.min(10000, anchoredValue));

  // 11. Calculate confidence score
  const confidenceScore = calculateConfidenceScore(input.model_rank, marketRank);

  // 12. Generate explanation
  const explanation = generateExplanation({
    modelValue: input.model_value,
    marketValue,
    anchoredValue: finalValue,
    anchorStrength,
    isOutlier,
    isBreakoutProtected,
    rankDifference,
  });

  return {
    anchored_value: finalValue,
    anchor_adjustment: anchorAdjustment,
    anchor_strength: anchorStrength,
    market_value: marketValue,
    market_rank: marketRank,
    confidence_score: confidenceScore,
    is_outlier: isOutlier,
    is_breakout_protected: isBreakoutProtected,
    explanation,
  };
}

/**
 * Apply market anchoring to multiple players (batch)
 *
 * @param players - Array of player inputs
 * @returns Map of player_id to anchor result
 */
export async function applyMarketAnchors(
  players: MarketAnchorInput[]
): Promise<Map<string, MarketAnchorResult>> {
  const results = new Map<string, MarketAnchorResult>();

  // Process in parallel
  const promises = players.map((player) => applyMarketAnchor(player));
  const anchorResults = await Promise.all(promises);

  players.forEach((player, index) => {
    results.set(player.player_id, anchorResults[index]);
  });

  return results;
}

/**
 * Get market rank for a player
 *
 * @param playerId - Player ID
 * @param format - Dynasty or redraft
 * @returns Market rank or null
 */
async function getMarketRank(
  playerId: string,
  format: 'dynasty' | 'redraft'
): Promise<number | null> {
  const { data, error } = await supabase
    .from('market_player_consensus')
    .select('market_rank')
    .eq('player_id', playerId)
    .eq('format', format)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.market_rank;
}

/**
 * Get anchor strength based on player tier (rank)
 *
 * @param rank - Player rank
 * @returns Anchor strength (0-1)
 */
function getAnchorStrengthByTier(rank: number): number {
  if (rank <= 24) {
    return ANCHOR_STRENGTH_BY_TIER.tier1; // 0.15
  }

  if (rank <= 60) {
    return ANCHOR_STRENGTH_BY_TIER.tier2; // 0.20
  }

  if (rank <= 120) {
    return ANCHOR_STRENGTH_BY_TIER.tier3; // 0.25
  }

  return ANCHOR_STRENGTH_BY_TIER.tier4; // 0.35
}

/**
 * Calculate confidence score
 *
 * Higher score = model and market agree more
 * Formula: 1 - (rank_difference / 400)
 *
 * @param modelRank - Model's rank
 * @param marketRank - Market's rank
 * @returns Confidence score (0-1)
 */
function calculateConfidenceScore(modelRank: number, marketRank: number): number {
  const rankDiff = Math.abs(modelRank - marketRank);

  // confidence = 1 - (difference / 400)
  // Perfect match = 1.0, 400 ranks apart = 0.0
  const confidence = 1.0 - rankDiff / 400;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Generate human-readable explanation
 *
 * @param params - Explanation parameters
 * @returns Explanation string
 */
function generateExplanation(params: {
  modelValue: number;
  marketValue: number;
  anchoredValue: number;
  anchorStrength: number;
  isOutlier: boolean;
  isBreakoutProtected: boolean;
  rankDifference: number;
}): string {
  const {
    modelValue,
    marketValue,
    anchoredValue,
    anchorStrength,
    isOutlier,
    isBreakoutProtected,
    rankDifference,
  } = params;

  const parts: string[] = [];

  // Model vs market
  if (marketValue > modelValue) {
    parts.push(`Market values ${rankDifference} spots higher`);
  } else if (marketValue < modelValue) {
    parts.push(`Model values ${rankDifference} spots higher`);
  } else {
    parts.push('Model matches market');
  }

  // Anchor strength
  const strengthPct = Math.round(anchorStrength * 100);
  parts.push(`${strengthPct}% pull toward market`);

  // Special conditions
  if (isBreakoutProtected) {
    parts.push('breakout protection active');
  }

  if (isOutlier) {
    parts.push('flagged as outlier');
  }

  return parts.join(', ');
}

/**
 * Log anchor adjustment to audit table
 *
 * @param input - Player input
 * @param result - Anchor result
 */
export async function logAnchorAudit(
  input: MarketAnchorInput,
  result: MarketAnchorResult
): Promise<void> {
  await supabase.from('market_anchor_audit').insert({
    player_id: input.player_id,
    league_profile_id: input.league_profile_id,
    format: input.format,
    model_value: input.model_value,
    market_value: result.market_value,
    anchored_value: result.anchored_value,
    anchor_strength: result.anchor_strength,
    rank_difference: result.market_rank
      ? Math.abs(input.model_rank - result.market_rank)
      : 0,
    confidence_score: result.confidence_score,
    is_outlier: result.is_outlier,
    is_breakout_protected: result.is_breakout_protected,
    notes: result.explanation,
  });
}

/**
 * Get confidence label from score
 *
 * @param score - Confidence score (0-1)
 * @returns Label string
 */
export function getConfidenceLabel(score: number): string {
  if (score >= 0.9) return 'Very High';
  if (score >= 0.75) return 'High';
  if (score >= 0.5) return 'Medium';
  if (score >= 0.25) return 'Low';
  return 'Very Low';
}

/**
 * Get confidence color class
 *
 * @param score - Confidence score (0-1)
 * @returns Tailwind color class
 */
export function getConfidenceColor(score: number): string {
  if (score >= 0.9) return 'text-green-600';
  if (score >= 0.75) return 'text-blue-600';
  if (score >= 0.5) return 'text-yellow-600';
  if (score >= 0.25) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Validate market anchor results
 *
 * @param results - Anchor results to validate
 * @returns Validation summary
 */
export function validateAnchorResults(
  results: Map<string, MarketAnchorResult>
): {
  valid: boolean;
  warnings: string[];
  stats: {
    totalPlayers: number;
    withMarketData: number;
    outliers: number;
    breakoutProtected: number;
    avgConfidence: number;
    avgAdjustment: number;
  };
} {
  const warnings: string[] = [];
  let totalConfidence = 0;
  let totalAdjustment = 0;
  let withMarketData = 0;
  let outliers = 0;
  let breakoutProtected = 0;

  for (const result of results.values()) {
    totalConfidence += result.confidence_score;
    totalAdjustment += Math.abs(result.anchor_adjustment);

    if (result.market_rank !== null) {
      withMarketData++;
    }

    if (result.is_outlier) {
      outliers++;
    }

    if (result.is_breakout_protected) {
      breakoutProtected++;
    }

    // Check for extreme adjustments
    const pctChange = Math.abs(result.anchor_adjustment) / result.anchored_value;
    if (pctChange > 0.15 && result.anchored_value > 1000) {
      warnings.push(
        `Large adjustment: ${result.anchor_adjustment} (${Math.round(pctChange * 100)}%)`
      );
    }
  }

  const avgConfidence = totalConfidence / results.size;
  const avgAdjustment = totalAdjustment / results.size;

  // Validate overall metrics
  if (withMarketData < results.size * 0.8) {
    warnings.push(
      `Only ${withMarketData}/${results.size} players have market data (${Math.round((withMarketData / results.size) * 100)}%)`
    );
  }

  if (outliers > results.size * 0.1) {
    warnings.push(
      `High outlier rate: ${outliers}/${results.size} (${Math.round((outliers / results.size) * 100)}%)`
    );
  }

  if (avgConfidence < 0.6) {
    warnings.push(`Low average confidence: ${avgConfidence.toFixed(2)}`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      totalPlayers: results.size,
      withMarketData,
      outliers,
      breakoutProtected,
      avgConfidence,
      avgAdjustment,
    },
  };
}

/**
 * Get market vs model summary
 *
 * @param modelRank - Model's rank
 * @param marketRank - Market's rank
 * @returns Summary object
 */
export function getMarketVsModelSummary(
  modelRank: number,
  marketRank: number
): {
  agreement: 'perfect' | 'close' | 'moderate' | 'divergent' | 'extreme';
  rankDifference: number;
  direction: 'model_higher' | 'market_higher' | 'equal';
  message: string;
} {
  const rankDiff = Math.abs(modelRank - marketRank);
  let agreement: 'perfect' | 'close' | 'moderate' | 'divergent' | 'extreme';
  let message: string;

  if (rankDiff === 0) {
    agreement = 'perfect';
    message = 'Model and market in perfect agreement';
  } else if (rankDiff <= 10) {
    agreement = 'close';
    message = 'Model and market closely aligned';
  } else if (rankDiff <= 30) {
    agreement = 'moderate';
    message = 'Model and market moderately aligned';
  } else if (rankDiff <= 120) {
    agreement = 'divergent';
    message = 'Model and market have notable differences';
  } else {
    agreement = 'extreme';
    message = 'Model and market significantly divergent';
  }

  const direction = modelRank < marketRank ? 'model_higher' : modelRank > marketRank ? 'market_higher' : 'equal';

  return {
    agreement,
    rankDifference: rankDiff,
    direction,
    message,
  };
}
