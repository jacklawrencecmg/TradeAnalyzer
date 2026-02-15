/**
 * Replacement Level Calculator
 *
 * Determines the "replacement level" player at each position based on
 * league starting requirements. This is the baseline for VOR (Value Over Replacement)
 * calculations.
 *
 * Replacement level = the worst starter you'd expect to find in a league.
 *
 * Formula:
 *   replacement_rank = (teams * starters_at_position) + flex_adjustment
 *
 * Flex adjustments distribute flex spots based on typical usage patterns.
 */

import type { LeagueProfile } from '../league/resolveLeagueProfile';

export interface ReplacementLevel {
  position: string;
  replacementRank: number;
  reasoning: string;
}

export interface ReplacementLevels {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  DL?: number;
  LB?: number;
  DB?: number;
}

/**
 * Calculate replacement level rank for a position
 *
 * This determines how many players at a position are "starters" vs "bench"
 * in a typical league.
 */
export function getReplacementLevel(
  profile: LeagueProfile,
  position: string,
  numTeams: number = 12
): number {
  const slots = profile.starting_slots;

  // Base starters at position
  const baseStarters = slots[position] || 0;
  const baseRank = numTeams * baseStarters;

  // Calculate flex adjustments
  const flexAdjustment = calculateFlexAdjustment(profile, position, numTeams);

  // Final replacement rank
  const replacementRank = Math.ceil(baseRank + flexAdjustment);

  return Math.max(replacementRank, 1); // At least rank 1
}

/**
 * Calculate how many flex spots this position typically fills
 *
 * Flex distribution based on typical roster construction:
 * - FLEX: 35% RB, 35% WR, 15% TE, 15% others
 * - SF: 75% QB (sometimes you start a QB in SF, sometimes not)
 * - IDP_FLEX: Evenly distributed across IDP positions
 */
function calculateFlexAdjustment(
  profile: LeagueProfile,
  position: string,
  numTeams: number
): number {
  const slots = profile.starting_slots;
  let adjustment = 0;

  // Standard FLEX slots
  const flexSlots = slots.FLEX || 0;
  if (flexSlots > 0) {
    switch (position) {
      case 'RB':
        adjustment += flexSlots * 0.35;
        break;
      case 'WR':
        adjustment += flexSlots * 0.35;
        break;
      case 'TE':
        adjustment += flexSlots * 0.15;
        break;
      case 'QB':
        adjustment += flexSlots * 0.10; // Rarely used in FLEX
        break;
      default:
        adjustment += flexSlots * 0.05;
        break;
    }
  }

  // Superflex slots (mostly QBs)
  const sfSlots = slots.SF || slots.SUPER_FLEX || 0;
  if (sfSlots > 0) {
    switch (position) {
      case 'QB':
        adjustment += sfSlots * 0.75; // 75% of SF slots use QB
        break;
      case 'RB':
        adjustment += sfSlots * 0.10;
        break;
      case 'WR':
        adjustment += sfSlots * 0.10;
        break;
      case 'TE':
        adjustment += sfSlots * 0.05;
        break;
    }
  }

  // W/R/T flex (WR/RB/TE only)
  const wrtSlots = slots.WRT || slots.W_R_T || 0;
  if (wrtSlots > 0) {
    switch (position) {
      case 'RB':
        adjustment += wrtSlots * 0.40;
        break;
      case 'WR':
        adjustment += wrtSlots * 0.40;
        break;
      case 'TE':
        adjustment += wrtSlots * 0.20;
        break;
    }
  }

  // W/R flex (WR/RB only)
  const wrSlots = slots.WR_RB || slots.W_R || 0;
  if (wrSlots > 0) {
    switch (position) {
      case 'RB':
        adjustment += wrSlots * 0.50;
        break;
      case 'WR':
        adjustment += wrSlots * 0.50;
        break;
    }
  }

  // W/T flex (WR/TE only)
  const wtSlots = slots.WR_TE || slots.W_T || 0;
  if (wtSlots > 0) {
    switch (position) {
      case 'WR':
        adjustment += wtSlots * 0.70;
        break;
      case 'TE':
        adjustment += wtSlots * 0.30;
        break;
    }
  }

  // IDP FLEX
  const idpFlexSlots = slots.IDP_FLEX || slots.IDFLEX || 0;
  if (idpFlexSlots > 0 && ['DL', 'LB', 'DB'].includes(position)) {
    // Distribute evenly across IDP positions (can adjust based on preset)
    const idpPositions = ['DL', 'LB', 'DB'].filter(
      (pos) => (slots[pos] || 0) > 0
    );
    adjustment += idpFlexSlots / idpPositions.length;
  }

  // Defensive flex (DB/S)
  const dbFlexSlots = slots.DB_FLEX || 0;
  if (dbFlexSlots > 0 && position === 'DB') {
    adjustment += dbFlexSlots;
  }

  // Multiply by number of teams
  return adjustment * numTeams;
}

/**
 * Calculate all replacement levels for a profile
 */
export function calculateReplacementLevels(
  profile: LeagueProfile,
  numTeams: number = 12
): ReplacementLevels {
  const levels: ReplacementLevels = {
    QB: getReplacementLevel(profile, 'QB', numTeams),
    RB: getReplacementLevel(profile, 'RB', numTeams),
    WR: getReplacementLevel(profile, 'WR', numTeams),
    TE: getReplacementLevel(profile, 'TE', numTeams),
  };

  // Add IDP positions if enabled
  if (profile.idp_enabled) {
    levels.DL = getReplacementLevel(profile, 'DL', numTeams);
    levels.LB = getReplacementLevel(profile, 'LB', numTeams);
    levels.DB = getReplacementLevel(profile, 'DB', numTeams);
  }

  return levels;
}

/**
 * Get replacement level with detailed reasoning
 */
export function getReplacementLevelWithReasoning(
  profile: LeagueProfile,
  position: string,
  numTeams: number = 12
): ReplacementLevel {
  const slots = profile.starting_slots;
  const baseStarters = slots[position] || 0;
  const baseRank = numTeams * baseStarters;
  const flexAdjustment = calculateFlexAdjustment(profile, position, numTeams);
  const replacementRank = Math.ceil(baseRank + flexAdjustment);

  // Build reasoning string
  let reasoning = `${numTeams} teams × ${baseStarters} starters`;

  if (flexAdjustment > 0) {
    reasoning += ` + ${flexAdjustment.toFixed(1)} flex = ${position}${replacementRank}`;
  } else {
    reasoning += ` = ${position}${replacementRank}`;
  }

  return {
    position,
    replacementRank: Math.max(replacementRank, 1),
    reasoning,
  };
}

/**
 * Get all replacement levels with reasoning
 */
export function getAllReplacementLevels(
  profile: LeagueProfile,
  numTeams: number = 12
): ReplacementLevel[] {
  const positions = ['QB', 'RB', 'WR', 'TE'];

  if (profile.idp_enabled) {
    positions.push('DL', 'LB', 'DB');
  }

  return positions.map((pos) =>
    getReplacementLevelWithReasoning(profile, pos, numTeams)
  );
}

/**
 * Determine if a player is above/below replacement level
 */
export function isAboveReplacement(
  positionRank: number,
  replacementRank: number
): boolean {
  return positionRank <= replacementRank;
}

/**
 * Calculate distance from replacement (for VOR calculation)
 */
export function getDistanceFromReplacement(
  positionRank: number,
  replacementRank: number
): number {
  return replacementRank - positionRank;
}

/**
 * Get typical league size from profile
 * (can be overridden, but we need a default)
 */
export function getTypicalLeagueSize(profile: LeagueProfile): number {
  // Most dynasty leagues are 10-12 teams
  if (profile.is_dynasty) {
    return 12;
  }

  // Redraft can vary more
  return 12;
}

/**
 * Estimate replacement level value for a position
 *
 * This requires knowing the value at the replacement rank.
 * Should be called with sorted player list.
 */
export function estimateReplacementValue(
  sortedPlayers: Array<{ position: string; value: number; positionRank: number }>,
  position: string,
  replacementRank: number
): number {
  // Find players at this position
  const positionPlayers = sortedPlayers.filter((p) => p.position === position);

  // Find player at replacement rank
  const replacementPlayer = positionPlayers.find(
    (p) => p.positionRank === replacementRank
  );

  if (replacementPlayer) {
    return replacementPlayer.value;
  }

  // If exact rank not found, interpolate
  const below = positionPlayers
    .filter((p) => p.positionRank < replacementRank)
    .sort((a, b) => b.positionRank - a.positionRank)[0];

  const above = positionPlayers
    .filter((p) => p.positionRank > replacementRank)
    .sort((a, b) => a.positionRank - b.positionRank)[0];

  if (below && above) {
    // Linear interpolation
    const ratio =
      (replacementRank - below.positionRank) /
      (above.positionRank - below.positionRank);
    return below.value + (above.value - below.value) * ratio;
  }

  if (below) {
    return below.value * 0.9; // Slightly lower
  }

  if (above) {
    return above.value * 1.1; // Slightly higher
  }

  // Fallback
  return 3000;
}

/**
 * Calculate expected starters at each position
 * (useful for validation and debugging)
 */
export function getExpectedStarterCounts(
  profile: LeagueProfile,
  numTeams: number = 12
): Record<string, number> {
  const slots = profile.starting_slots;
  const counts: Record<string, number> = {};

  // Direct starters
  for (const [position, count] of Object.entries(slots)) {
    if (['FLEX', 'SF', 'SUPER_FLEX', 'BN', 'BENCH', 'IDP_FLEX'].includes(position)) {
      continue; // Skip flex/bench
    }
    counts[position] = (count as number) * numTeams;
  }

  return counts;
}

/**
 * Validate replacement levels are reasonable
 */
export function validateReplacementLevels(levels: ReplacementLevels): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // QB should be 12-36 typically (1-3 per team)
  if (levels.QB < 10 || levels.QB > 40) {
    warnings.push(`QB replacement level ${levels.QB} seems unusual`);
  }

  // RB should be 24-48 typically
  if (levels.RB < 20 || levels.RB > 60) {
    warnings.push(`RB replacement level ${levels.RB} seems unusual`);
  }

  // WR should be 36-60 typically
  if (levels.WR < 30 || levels.WR > 80) {
    warnings.push(`WR replacement level ${levels.WR} seems unusual`);
  }

  // TE should be 12-24 typically
  if (levels.TE < 10 || levels.TE > 30) {
    warnings.push(`TE replacement level ${levels.TE} seems unusual`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Example replacement levels for common formats
 */
export const EXAMPLE_REPLACEMENT_LEVELS = {
  dynasty_sf_12team: {
    QB: 21, // 12×1 + 12×0.75(SF) = 21
    RB: 30, // 12×2 + ~6(flex) = 30
    WR: 42, // 12×3 + ~6(flex) = 42
    TE: 16, // 12×1 + ~4(flex) = 16
  },
  dynasty_1qb_12team: {
    QB: 13, // 12×1 + ~1(flex) = 13
    RB: 32, // 12×2 + ~8(flex) = 32
    WR: 44, // 12×3 + ~8(flex) = 44
    TE: 17, // 12×1 + ~5(flex) = 17
  },
  redraft_sf_12team: {
    QB: 21,
    RB: 28,
    WR: 40,
    TE: 15,
  },
  redraft_1qb_12team: {
    QB: 13,
    RB: 30,
    WR: 42,
    TE: 16,
  },
};
