/**
 * Example: How to integrate model config with value calculations
 *
 * This shows how to use live tunable parameters in your value logic
 */

import { getModelConfig, type ModelConfig } from './getModelConfig';

/**
 * Example: Calculate player value using config weights
 */
export async function calculatePlayerValue(player: {
  production_score: number;
  age: number;
  snap_share: number;
  depth_chart_position: number;
  position: string;
  is_rookie: boolean;
  draft_capital?: number;
}): Promise<number> {
  // Load config once per batch
  const config = await getModelConfig();

  // Use config weights instead of hardcoded values
  let value = 0;

  // Production component (was hardcoded 0.60, now config.production_weight)
  value += player.production_score * config.production_weight;

  // Age curve component (was hardcoded 0.10, now config.age_curve_weight)
  const ageFactor = calculateAgeFactor(player.age, player.position);
  value += ageFactor * config.age_curve_weight;

  // Opportunity component (was hardcoded 0.20, now config.snap_share_weight)
  value += player.snap_share * config.snap_share_weight;

  // Depth chart component (was hardcoded 0.10, now config.depth_chart_weight)
  value += player.depth_chart_position * config.depth_chart_weight;

  // Position-specific adjustments
  if (player.position === 'TE') {
    value *= config.scarcity_multiplier; // Live tunable TE premium
  }

  // Rookie adjustments
  if (player.is_rookie && player.draft_capital) {
    const draftCapitalScore = player.draft_capital * config.rookie_draft_capital_weight;
    value = value * config.rookie_uncertainty_discount + draftCapitalScore;
  }

  return Math.round(value);
}

/**
 * Example: Apply RB role adjustments using config
 */
export async function applyRbRoleAdjustment(
  baseValue: number,
  role: 'workhorse' | 'committee' | 'backup'
): Promise<number> {
  const config = await getModelConfig();

  let adjustment = 0;

  switch (role) {
    case 'workhorse':
      adjustment = config.rb_workhorse_bonus; // Was hardcoded 250
      break;
    case 'committee':
      adjustment = config.rb_committee_penalty; // Was hardcoded -150
      break;
    default:
      adjustment = 0;
  }

  return baseValue + adjustment;
}

/**
 * Example: Apply superflex QB boost using config
 */
export async function applyLeagueTypeAdjustment(
  baseValue: number,
  position: string,
  leagueType: 'superflex' | 'tep' | 'standard'
): Promise<number> {
  const config = await getModelConfig();

  let multiplier = 1.0;

  if (position === 'QB' && leagueType === 'superflex') {
    multiplier = config.qb_superflex_boost; // Was hardcoded 1.25
  } else if (position === 'TE' && leagueType === 'tep') {
    multiplier = 1.0 + config.te_premium_factor; // Was hardcoded 1.30
  }

  return Math.round(baseValue * multiplier);
}

/**
 * Example: Determine value tier using config thresholds
 */
export async function getPlayerTier(value: number): Promise<string> {
  const config = await getModelConfig();

  // Thresholds are now live tunable!
  if (value >= config.value_tier_elite) return 'elite';
  if (value >= config.value_tier_high) return 'high';
  if (value >= config.value_tier_mid) return 'mid';
  if (value >= config.value_tier_low) return 'low';
  return 'depth';
}

/**
 * Example: Apply market anchor using config strength tiers
 */
export async function applyMarketAnchor(
  modelValue: number,
  marketValue: number,
  percentile: number
): Promise<number> {
  const config = await getModelConfig();

  // Determine anchor strength based on tier (live tunable!)
  let anchorStrength = config.market_anchor_tier4; // Default: depth players

  if (percentile >= 0.95) {
    anchorStrength = config.market_anchor_tier1; // Elite
  } else if (percentile >= 0.75) {
    anchorStrength = config.market_anchor_tier2; // High-end
  } else if (percentile >= 0.50) {
    anchorStrength = config.market_anchor_tier3; // Mid-tier
  }

  // Blend model value with market consensus
  const blendedValue = modelValue * (1 - anchorStrength) + marketValue * anchorStrength;

  return Math.round(blendedValue);
}

/**
 * Example: Check if player triggers buy-low alert
 */
export async function checkBuyLowAlert(
  currentValue: number,
  previousValue: number
): Promise<boolean> {
  const config = await getModelConfig();

  const valueDrop = previousValue - currentValue;

  // Threshold is now live tunable!
  return valueDrop >= config.buy_low_delta;
}

/**
 * Example: Check if player triggers sell-high alert
 */
export async function checkSellHighAlert(
  currentValue: number,
  previousValue: number
): Promise<boolean> {
  const config = await getModelConfig();

  const valueSpike = currentValue - previousValue;

  // Threshold is now live tunable!
  return valueSpike >= Math.abs(config.sell_high_delta);
}

/**
 * Example: Check if player is breakout candidate
 */
export async function isBreakoutCandidate(
  usageRate: number,
  isYoung: boolean
): Promise<boolean> {
  const config = await getModelConfig();

  // Threshold is now live tunable!
  return isYoung && usageRate >= config.breakout_usage_threshold;
}

/**
 * Helper: Calculate age factor (example)
 */
function calculateAgeFactor(age: number, position: string): number {
  // Peak ages by position
  const peakAges: Record<string, number> = {
    QB: 28,
    RB: 25,
    WR: 27,
    TE: 27,
  };

  const peakAge = peakAges[position] || 26;
  const ageDiff = Math.abs(age - peakAge);

  // Simple age curve: peak = 1.0, decline by 0.05 per year away from peak
  return Math.max(0, 1.0 - ageDiff * 0.05);
}

/**
 * Example: Batch calculation with config loaded once
 */
export async function calculateBatchValues(
  players: Array<{
    id: string;
    production_score: number;
    age: number;
    snap_share: number;
    depth_chart_position: number;
    position: string;
    is_rookie: boolean;
  }>
): Promise<Record<string, number>> {
  // Load config ONCE for entire batch
  const config = await getModelConfig();

  const values: Record<string, number> = {};

  for (const player of players) {
    // Use config throughout without reloading
    let value = 0;

    value += player.production_score * config.production_weight;

    const ageFactor = calculateAgeFactor(player.age, player.position);
    value += ageFactor * config.age_curve_weight;

    value += player.snap_share * config.snap_share_weight;
    value += player.depth_chart_position * config.depth_chart_weight;

    if (player.position === 'TE') {
      value *= config.scarcity_multiplier;
    }

    values[player.id] = Math.round(value);
  }

  return values;
}
