/**
 * FDP Branding Helpers
 *
 * INTERNAL MODULE - DO NOT EXPORT OUTSIDE src/lib/fdp/**
 *
 * These functions create branded types from raw values.
 * Only getFDPValue() should use these helpers.
 *
 * If these are exported to UI, the type safety is broken.
 */

import type {
  FDPValue,
  FDPTier,
  FDPRank,
  FDPEpoch,
  FDPValueBundle,
  FDPRawResponse,
} from './types';

/**
 * Brand a raw number as FDP canonical value
 * INTERNAL USE ONLY
 */
export function brandValue(value: number): FDPValue {
  return value as FDPValue;
}

/**
 * Brand a tier number
 * INTERNAL USE ONLY
 */
export function brandTier(tier: number): FDPTier {
  return tier as FDPTier;
}

/**
 * Brand a rank number
 * INTERNAL USE ONLY
 */
export function brandRank(rank: number): FDPRank {
  return rank as FDPRank;
}

/**
 * Brand an epoch string
 * INTERNAL USE ONLY
 */
export function brandEpoch(epoch: string): FDPEpoch {
  return epoch as FDPEpoch;
}

/**
 * Convert raw database response to branded FDP bundle
 * INTERNAL USE ONLY
 */
export function createFDPBundle(raw: FDPRawResponse): FDPValueBundle {
  // Parse tier
  const tierNum = parseTier(raw.tier);

  return {
    player_id: raw.player_id,
    player_name: raw.player_name,
    position: raw.position,
    team: raw.team,
    value: brandValue(raw.adjusted_value || raw.base_value),
    tier: brandTier(tierNum),
    overall_rank: brandRank(raw.rank_overall),
    pos_rank: brandRank(raw.rank_position),
    value_epoch: brandEpoch(raw.value_epoch_id),
    updated_at: raw.updated_at,
    adjustments: {
      base_value: raw.base_value,
      market_anchor: raw.market_value || raw.base_value,
      scarcity: 0, // TODO: extract from adjustments
      league_context: 0, // TODO: extract from adjustments
      final_value: raw.adjusted_value || raw.base_value,
    },
  };
}

/**
 * Parse tier string to number
 */
function parseTier(tier: string): number {
  if (!tier) return 5;

  // Handle formats: "1", "Tier 1", "T1"
  const match = tier.match(/\d+/);
  return match ? parseInt(match[0], 10) : 5;
}

/**
 * Create FDP bundle from multiple raw responses
 * INTERNAL USE ONLY
 */
export function createFDPBundles(
  responses: FDPRawResponse[]
): Map<string, FDPValueBundle> {
  const map = new Map<string, FDPValueBundle>();

  for (const raw of responses) {
    map.set(raw.player_id, createFDPBundle(raw));
  }

  return map;
}

/**
 * Validate that branding is working
 * Used in tests to ensure type safety
 */
export function validateBranding(): void {
  // This should compile
  const testValue: FDPValue = brandValue(1000);

  // This should NOT compile if types are correct:
  // const broken: FDPValue = 1000; // TS Error!

  // Prevent unused variable warning
  void testValue;
}
