/**
 * Scarcity Adjustment System
 *
 * Converts raw player values to scarcity-adjusted values using Value Over Replacement (VOR).
 * This makes values reflect lineup impact rather than just raw talent.
 *
 * Process:
 * 1. Calculate replacement level for each position (based on league settings)
 * 2. Compute VOR = player_value - replacement_value
 * 3. Normalize VOR to new scale (replacement ~5000, starters >5000, bench <5000)
 * 4. Apply positional elasticity caps to prevent position domination
 * 5. Return adjusted value + debug info
 *
 * This runs AFTER multipliers but BEFORE ranking in the rebuild pipeline.
 */

import type { LeagueProfile } from '../league/resolveLeagueProfile';
import {
  calculateReplacementLevels,
  estimateReplacementValue,
  type ReplacementLevels,
} from './replacementLevels';

export interface ScarcityAdjustment {
  adjustedValue: number;
  debug: {
    rawValue: number;
    replacementValue: number;
    vor: number;
    positionShare: number;
    elasticityAdjustment: number;
  };
}

export interface PlayerForScarcity {
  player_id: string;
  position: string;
  positionRank: number;
  value: number;
}

/**
 * Positional elasticity caps
 *
 * Prevents one position from dominating rankings.
 * Based on typical dynasty market distribution.
 */
export const POSITIONAL_CAPS = {
  QB: {
    maxShareTop100: 0.18, // Max 18% of top 100
    minShareTop100: 0.08, // Min 8% of top 100
  },
  RB: {
    maxShareTop100: 0.30, // Max 30% of top 100
    minShareTop100: 0.18, // Min 18% of top 100
  },
  WR: {
    maxShareTop100: 0.45, // Max 45% of top 100
    minShareTop100: 0.25, // Min 25% of top 100
  },
  TE: {
    maxShareTop100: 0.12, // Max 12% of top 100
    minShareTop100: 0.04, // Min 4% of top 100
  },
  DL: {
    maxShareTop100: 0.15,
    minShareTop100: 0.05,
  },
  LB: {
    maxShareTop100: 0.15,
    minShareTop100: 0.05,
  },
  DB: {
    maxShareTop100: 0.15,
    minShareTop100: 0.05,
  },
};

/**
 * VOR normalization constants
 */
const VOR_SCALE = 1.35; // Multiplier for VOR
const REPLACEMENT_VALUE = 5000; // Target value for replacement level players
const MIN_VALUE = 0;
const MAX_VALUE = 10000;

/**
 * Apply scarcity adjustment to a single player
 *
 * @param player - Player to adjust
 * @param replacementValue - Value of replacement level player at this position
 * @param allPlayers - All players (for elasticity calculation)
 * @param profile - League profile
 * @returns Adjusted value and debug info
 */
export function applyScarcityAdjustment(
  player: PlayerForScarcity,
  replacementValue: number,
  allPlayers: PlayerForScarcity[],
  profile: LeagueProfile
): ScarcityAdjustment {
  // 1. Calculate VOR (Value Over Replacement)
  const vor = player.value - replacementValue;

  // 2. Normalize VOR to new scale
  // Formula: 5000 + (vor * 1.35)
  // This centers replacement level at 5000
  let adjustedValue = REPLACEMENT_VALUE + vor * VOR_SCALE;

  // 3. Clamp to valid range
  adjustedValue = Math.max(MIN_VALUE, Math.min(MAX_VALUE, adjustedValue));

  // 4. Round to integer
  adjustedValue = Math.round(adjustedValue);

  // 5. Calculate elasticity adjustment (applied separately in batch)
  const elasticityAdjustment = 0; // Will be calculated in applyElasticityCaps

  return {
    adjustedValue,
    debug: {
      rawValue: player.value,
      replacementValue,
      vor,
      positionShare: 0, // Will be calculated in batch
      elasticityAdjustment,
    },
  };
}

/**
 * Apply scarcity adjustments to all players
 *
 * This is the main entry point. It:
 * 1. Calculates replacement levels
 * 2. Estimates replacement values
 * 3. Applies VOR adjustments
 * 4. Applies positional elasticity caps
 * 5. Returns adjusted players with debug info
 */
export function applyScarcityAdjustments(
  players: PlayerForScarcity[],
  profile: LeagueProfile,
  numTeams: number = 12
): Map<string, ScarcityAdjustment> {
  // 1. Calculate replacement levels
  const replacementLevels = calculateReplacementLevels(profile, numTeams);

  // 2. Estimate replacement values for each position
  const replacementValues = estimateReplacementValues(
    players,
    replacementLevels
  );

  // 3. Apply VOR adjustments to each player
  const adjustments = new Map<string, ScarcityAdjustment>();

  for (const player of players) {
    const replacementValue = replacementValues[player.position] || 3000;
    const adjustment = applyScarcityAdjustment(
      player,
      replacementValue,
      players,
      profile
    );
    adjustments.set(player.player_id, adjustment);
  }

  // 4. Apply positional elasticity caps
  applyElasticityCaps(players, adjustments, profile);

  return adjustments;
}

/**
 * Estimate replacement values for all positions
 */
function estimateReplacementValues(
  players: PlayerForScarcity[],
  replacementLevels: ReplacementLevels
): Record<string, number> {
  const values: Record<string, number> = {};

  // Sort players by value descending
  const sortedPlayers = [...players].sort((a, b) => b.value - a.value);

  // Estimate replacement value for each position
  for (const [position, replacementRank] of Object.entries(replacementLevels)) {
    values[position] = estimateReplacementValue(
      sortedPlayers,
      position,
      replacementRank
    );
  }

  return values;
}

/**
 * Apply positional elasticity caps
 *
 * Prevents one position from dominating top 100.
 * Uses smooth scaling to avoid drastic reordering.
 */
function applyElasticityCaps(
  players: PlayerForScarcity[],
  adjustments: Map<string, ScarcityAdjustment>,
  profile: LeagueProfile
): void {
  // Get adjusted values
  const adjustedPlayers = players.map((p) => ({
    ...p,
    adjustedValue: adjustments.get(p.player_id)!.adjustedValue,
  }));

  // Sort by adjusted value
  adjustedPlayers.sort((a, b) => b.adjustedValue - a.adjustedValue);

  // Get top 100
  const top100 = adjustedPlayers.slice(0, 100);

  // Count position representation in top 100
  const positionCounts: Record<string, number> = {};
  for (const player of top100) {
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
  }

  // Calculate position shares
  const positionShares: Record<string, number> = {};
  for (const [position, count] of Object.entries(positionCounts)) {
    positionShares[position] = count / 100;
  }

  // Identify positions that violate caps
  const violations: Array<{
    position: string;
    actual: number;
    target: number;
    excess: number;
  }> = [];

  for (const [position, share] of Object.entries(positionShares)) {
    const caps = POSITIONAL_CAPS[position as keyof typeof POSITIONAL_CAPS];
    if (!caps) continue;

    if (share > caps.maxShareTop100) {
      violations.push({
        position,
        actual: share,
        target: caps.maxShareTop100,
        excess: share - caps.maxShareTop100,
      });
    } else if (share < caps.minShareTop100) {
      violations.push({
        position,
        actual: share,
        target: caps.minShareTop100,
        excess: share - caps.minShareTop100, // Negative
      });
    }
  }

  // If no violations, we're done
  if (violations.length === 0) {
    return;
  }

  // Apply smooth adjustments to violators
  for (const violation of violations) {
    if (violation.excess > 0) {
      // Over-represented: compress top players
      compressPosition(
        players,
        adjustments,
        violation.position,
        violation.excess
      );
    } else {
      // Under-represented: boost top players
      boostPosition(
        players,
        adjustments,
        violation.position,
        Math.abs(violation.excess)
      );
    }
  }

  // Update debug info with position shares
  for (const player of top100) {
    const adjustment = adjustments.get(player.player_id);
    if (adjustment) {
      adjustment.debug.positionShare = positionShares[player.position] || 0;
    }
  }
}

/**
 * Compress over-represented position
 *
 * Gradually reduces values of top players at this position.
 * Uses smooth scaling to avoid dramatic changes.
 */
function compressPosition(
  players: PlayerForScarcity[],
  adjustments: Map<string, ScarcityAdjustment>,
  position: string,
  excessShare: number
): void {
  // Get players at this position sorted by adjusted value
  const positionPlayers = players
    .filter((p) => p.position === position)
    .map((p) => ({
      ...p,
      adjustment: adjustments.get(p.player_id)!,
    }))
    .sort((a, b) => b.adjustment.adjustedValue - a.adjustment.adjustedValue);

  // Calculate compression factor (smoother = less dramatic)
  // Excess of 0.05 (5%) → compress by ~2-3%
  const compressionFactor = 1.0 - excessShare * 0.5;

  // Apply compression to top players (more compression for higher ranks)
  const numToCompress = Math.min(50, positionPlayers.length);

  for (let i = 0; i < numToCompress; i++) {
    const player = positionPlayers[i];
    const adjustment = player.adjustment;

    // Graduated compression (more for top players)
    const rankFactor = 1.0 - i / numToCompress; // 1.0 at top, 0.0 at bottom
    const playerCompression = 1.0 - (1.0 - compressionFactor) * rankFactor;

    // Apply compression
    const oldValue = adjustment.adjustedValue;
    const newValue = Math.round(oldValue * playerCompression);

    adjustment.adjustedValue = newValue;
    adjustment.debug.elasticityAdjustment = newValue - oldValue;
  }
}

/**
 * Boost under-represented position
 *
 * Gradually increases values of top players at this position.
 */
function boostPosition(
  players: PlayerForScarcity[],
  adjustments: Map<string, ScarcityAdjustment>,
  position: string,
  deficitShare: number
): void {
  // Get players at this position sorted by adjusted value
  const positionPlayers = players
    .filter((p) => p.position === position)
    .map((p) => ({
      ...p,
      adjustment: adjustments.get(p.player_id)!,
    }))
    .sort((a, b) => b.adjustment.adjustedValue - a.adjustment.adjustedValue);

  // Calculate boost factor
  // Deficit of 0.05 (5%) → boost by ~2-3%
  const boostFactor = 1.0 + deficitShare * 0.5;

  // Apply boost to top players
  const numToBoost = Math.min(30, positionPlayers.length);

  for (let i = 0; i < numToBoost; i++) {
    const player = positionPlayers[i];
    const adjustment = player.adjustment;

    // Graduated boost (more for top players)
    const rankFactor = 1.0 - i / numToBoost;
    const playerBoost = 1.0 + (boostFactor - 1.0) * rankFactor;

    // Apply boost
    const oldValue = adjustment.adjustedValue;
    const newValue = Math.round(oldValue * playerBoost);

    adjustment.adjustedValue = Math.min(MAX_VALUE, newValue);
    adjustment.debug.elasticityAdjustment = newValue - oldValue;
  }
}

/**
 * Get scarcity explanation for a player
 *
 * Returns human-readable explanation of scarcity adjustment.
 */
export function getScarcityExplanation(
  position: string,
  positionRank: number,
  replacementRank: number,
  profile: LeagueProfile
): string {
  const distance = replacementRank - positionRank;

  if (distance > 0) {
    // Above replacement
    return `${distance} spots above replacement (${position}${replacementRank}) in this league`;
  } else if (distance < 0) {
    // Below replacement
    return `${Math.abs(distance)} spots below replacement (${position}${replacementRank}) in this league`;
  } else {
    // At replacement
    return `At replacement level (${position}${replacementRank}) in this league`;
  }
}

/**
 * Validate scarcity adjustments are reasonable
 */
export function validateScarcityAdjustments(
  adjustments: Map<string, ScarcityAdjustment>
): {
  valid: boolean;
  warnings: string[];
  stats: {
    avgAdjustment: number;
    maxAdjustment: number;
    minAdjustment: number;
    numIncreased: number;
    numDecreased: number;
  };
} {
  const warnings: string[] = [];
  let totalAdjustment = 0;
  let maxAdjustment = -Infinity;
  let minAdjustment = Infinity;
  let numIncreased = 0;
  let numDecreased = 0;

  for (const adjustment of adjustments.values()) {
    const delta = adjustment.adjustedValue - adjustment.debug.rawValue;
    totalAdjustment += Math.abs(delta);

    if (delta > maxAdjustment) maxAdjustment = delta;
    if (delta < minAdjustment) minAdjustment = delta;

    if (delta > 0) numIncreased++;
    if (delta < 0) numDecreased++;

    // Check for extreme adjustments
    const pctChange = Math.abs(delta) / adjustment.debug.rawValue;
    if (pctChange > 0.5 && adjustment.debug.rawValue > 1000) {
      warnings.push(
        `Large adjustment: ${adjustment.debug.rawValue} → ${adjustment.adjustedValue} (${(pctChange * 100).toFixed(0)}%)`
      );
    }
  }

  const avgAdjustment = totalAdjustment / adjustments.size;

  // Validate overall adjustment is reasonable
  if (avgAdjustment > 1000) {
    warnings.push(
      `Average adjustment ${avgAdjustment.toFixed(0)} seems high`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      avgAdjustment,
      maxAdjustment,
      minAdjustment,
      numIncreased,
      numDecreased,
    },
  };
}

/**
 * Get position distribution in top N
 */
export function getPositionDistribution(
  players: PlayerForScarcity[],
  adjustments: Map<string, ScarcityAdjustment>,
  topN: number = 100
): Record<string, { count: number; share: number }> {
  // Sort by adjusted value
  const sorted = [...players]
    .map((p) => ({
      ...p,
      adjustedValue: adjustments.get(p.player_id)!.adjustedValue,
    }))
    .sort((a, b) => b.adjustedValue - a.adjustedValue);

  const topPlayers = sorted.slice(0, topN);

  // Count positions
  const counts: Record<string, number> = {};
  for (const player of topPlayers) {
    counts[player.position] = (counts[player.position] || 0) + 1;
  }

  // Calculate shares
  const distribution: Record<string, { count: number; share: number }> = {};
  for (const [position, count] of Object.entries(counts)) {
    distribution[position] = {
      count,
      share: count / topN,
    };
  }

  return distribution;
}

/**
 * Calculate scarcity score for a player
 *
 * Higher score = more scarce/valuable relative to position
 */
export function calculateScarcityScore(
  positionRank: number,
  replacementRank: number
): number {
  if (positionRank > replacementRank) {
    return 0; // Below replacement
  }

  const distance = replacementRank - positionRank;
  const score = (distance / replacementRank) * 100;

  return Math.round(score);
}
