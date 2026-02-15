/**
 * Model Configuration Loader
 *
 * Loads model weights and thresholds from database with caching.
 * NEVER crashes - always falls back to safe defaults.
 */

import { supabase } from '../supabase';

export interface ModelConfig {
  production_weight: number;
  age_curve_weight: number;
  snap_share_weight: number;
  depth_chart_weight: number;
  market_anchor_tier1: number;
  market_anchor_tier2: number;
  market_anchor_tier3: number;
  market_anchor_tier4: number;
  breakout_usage_threshold: number;
  buy_low_delta: number;
  sell_high_delta: number;
  elite_tier_percent: number;
  scarcity_multiplier: number;
  qb_superflex_boost: number;
  te_premium_factor: number;
  rb_workhorse_bonus: number;
  rb_committee_penalty: number;
  rookie_draft_capital_weight: number;
  rookie_uncertainty_discount: number;
  value_tier_elite: number;
  value_tier_high: number;
  value_tier_mid: number;
  value_tier_low: number;
}

const DEFAULT_CONFIG: ModelConfig = {
  production_weight: 0.60,
  age_curve_weight: 0.10,
  snap_share_weight: 0.20,
  depth_chart_weight: 0.10,
  market_anchor_tier1: 0.15,
  market_anchor_tier2: 0.20,
  market_anchor_tier3: 0.25,
  market_anchor_tier4: 0.35,
  breakout_usage_threshold: 0.25,
  buy_low_delta: 600,
  sell_high_delta: -600,
  elite_tier_percent: 0.05,
  scarcity_multiplier: 1.35,
  qb_superflex_boost: 1.25,
  te_premium_factor: 0.30,
  rb_workhorse_bonus: 250,
  rb_committee_penalty: -150,
  rookie_draft_capital_weight: 0.35,
  rookie_uncertainty_discount: 0.85,
  value_tier_elite: 8000,
  value_tier_high: 5000,
  value_tier_mid: 2500,
  value_tier_low: 1000,
};

let configCache: ModelConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Get model configuration with caching
 * Falls back to defaults if database fails
 */
export async function getModelConfig(): Promise<ModelConfig> {
  const now = Date.now();

  // Return cached config if still valid
  if (configCache && now - cacheTimestamp < CACHE_TTL) {
    return configCache;
  }

  try {
    // Load config from database
    const { data, error } = await supabase
      .from('model_config')
      .select('key, value');

    if (error) {
      console.error('Failed to load model config:', error);
      return DEFAULT_CONFIG;
    }

    if (!data || data.length === 0) {
      console.warn('No model config found, using defaults');
      return DEFAULT_CONFIG;
    }

    // Build config object
    const config: Partial<ModelConfig> = {};

    for (const row of data) {
      const key = row.key as keyof ModelConfig;
      config[key] = row.value;
    }

    // Merge with defaults (in case some keys are missing)
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Cache the result
    configCache = mergedConfig;
    cacheTimestamp = now;

    return mergedConfig;
  } catch (error) {
    console.error('Exception loading model config:', error);
    // Return last cached config or defaults
    return configCache || DEFAULT_CONFIG;
  }
}

/**
 * Invalidate config cache (call after updates)
 */
export function invalidateModelConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Get config synchronously (returns cached or defaults)
 * Use only when async not available
 */
export function getModelConfigSync(): ModelConfig {
  return configCache || DEFAULT_CONFIG;
}

/**
 * Get market anchor strength based on percentile tier
 */
export function getMarketAnchorStrength(
  percentile: number,
  config: ModelConfig = DEFAULT_CONFIG
): number {
  if (percentile >= 0.95) return config.market_anchor_tier1;
  if (percentile >= 0.75) return config.market_anchor_tier2;
  if (percentile >= 0.50) return config.market_anchor_tier3;
  return config.market_anchor_tier4;
}

/**
 * Get value tier name based on value
 */
export function getValueTier(
  value: number,
  config: ModelConfig = DEFAULT_CONFIG
): string {
  if (value >= config.value_tier_elite) return 'elite';
  if (value >= config.value_tier_high) return 'high';
  if (value >= config.value_tier_mid) return 'mid';
  if (value >= config.value_tier_low) return 'low';
  return 'depth';
}

/**
 * Check if player should trigger buy-low alert
 */
export function shouldBuyLow(
  valueDelta: number,
  config: ModelConfig = DEFAULT_CONFIG
): boolean {
  return valueDelta >= config.buy_low_delta;
}

/**
 * Check if player should trigger sell-high alert
 */
export function shouldSellHigh(
  valueDelta: number,
  config: ModelConfig = DEFAULT_CONFIG
): boolean {
  return valueDelta <= config.sell_high_delta;
}

/**
 * Calculate RB role adjustment
 */
export function getRbRoleAdjustment(
  role: 'workhorse' | 'committee' | 'backup',
  config: ModelConfig = DEFAULT_CONFIG
): number {
  switch (role) {
    case 'workhorse':
      return config.rb_workhorse_bonus;
    case 'committee':
      return config.rb_committee_penalty;
    case 'backup':
      return 0;
    default:
      return 0;
  }
}

/**
 * Calculate position-specific boost for league type
 */
export function getPositionBoost(
  position: string,
  leagueType: 'superflex' | 'tep' | 'standard',
  config: ModelConfig = DEFAULT_CONFIG
): number {
  if (position === 'QB' && leagueType === 'superflex') {
    return config.qb_superflex_boost;
  }
  if (position === 'TE' && leagueType === 'tep') {
    return config.te_premium_factor;
  }
  return 1.0; // No boost
}
