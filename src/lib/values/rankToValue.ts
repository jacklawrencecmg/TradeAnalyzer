/**
 * Convert ranking to dynasty value using exponential decay curve
 *
 * Formula: value = 10000 * exp(-0.0045 * (rank - 1))
 *
 * This creates a smooth curve where:
 * - Rank 1 = 10,000
 * - Rank 10 = 9,560
 * - Rank 50 = 8,004
 * - Rank 100 = 6,397
 * - Rank 200 = 4,092
 * - Rank 500 = 906
 * - Rank 1000 = 82
 */
export function rankToValue(rank: number, maxValue: number = 10000): number {
  if (rank < 1) return maxValue;

  const decayRate = 0.0045;
  const value = maxValue * Math.exp(-decayRate * (rank - 1));

  return Math.round(Math.max(0, Math.min(maxValue, value)));
}

/**
 * Convert ranking to redraft value (steeper curve for single season)
 *
 * Redraft values decay faster since longevity doesn't matter
 * Formula: value = 10000 * exp(-0.008 * (rank - 1))
 */
export function rankToRedraftValue(rank: number, maxValue: number = 10000): number {
  if (rank < 1) return maxValue;

  const decayRate = 0.008; // Steeper decay
  const value = maxValue * Math.exp(-decayRate * (rank - 1));

  return Math.round(Math.max(0, Math.min(maxValue, value)));
}

/**
 * Convert value back to estimated rank
 */
export function valueToRank(value: number, maxValue: number = 10000): number {
  if (value >= maxValue) return 1;
  if (value <= 0) return 1000;

  const decayRate = 0.0045;
  const rank = 1 + Math.log(maxValue / value) / decayRate;

  return Math.round(Math.max(1, rank));
}

/**
 * Get value curve points for charting
 */
export function getValueCurve(maxRank: number = 500): Array<{ rank: number; value: number }> {
  const points: Array<{ rank: number; value: number }> = [];

  for (let rank = 1; rank <= maxRank; rank += Math.ceil(maxRank / 100)) {
    points.push({
      rank,
      value: rankToValue(rank),
    });
  }

  return points;
}

/**
 * Calculate value tiers based on natural breakpoints
 */
export function getValueTier(value: number): {
  tier: number;
  label: string;
  color: string;
} {
  if (value >= 9000) {
    return { tier: 1, label: 'Elite', color: '#10b981' };
  } else if (value >= 7500) {
    return { tier: 2, label: 'High-End', color: '#3b82f6' };
  } else if (value >= 6000) {
    return { tier: 3, label: 'Mid-Tier', color: '#8b5cf6' };
  } else if (value >= 4000) {
    return { tier: 4, label: 'Flex', color: '#f59e0b' };
  } else if (value >= 2000) {
    return { tier: 5, label: 'Deep Bench', color: '#ef4444' };
  } else {
    return { tier: 6, label: 'Fringe', color: '#6b7280' };
  }
}

/**
 * Apply position-specific multipliers to values
 */
export function applyPositionMultiplier(
  value: number,
  position: string,
  format: 'standard' | 'superflex' | 'premium_te' = 'standard'
): number {
  let multiplier = 1.0;

  if (format === 'superflex') {
    if (position === 'QB') {
      multiplier = 1.4; // QBs more valuable in SF
    }
  } else if (format === 'standard') {
    if (position === 'QB') {
      multiplier = 0.7; // QBs less valuable in 1QB
    }
  }

  if (format === 'premium_te') {
    if (position === 'TE') {
      multiplier = 1.2; // TEs more valuable in TE premium
    }
  }

  return Math.round(value * multiplier);
}

/**
 * IDP-specific value scaling
 */
export function rankToIdpValue(rank: number, position: string): number {
  // IDP players generally worth less than offensive players
  const baseValue = rankToValue(rank);
  let multiplier = 0.4; // Default IDP multiplier

  // Position-specific adjustments
  if (position === 'LB') {
    multiplier = 0.45; // LBs slightly more valuable (consistent scoring)
  } else if (position === 'DL') {
    multiplier = 0.35; // DL more volatile
  } else if (position === 'DB') {
    multiplier = 0.35; // DBs also volatile
  }

  return Math.round(baseValue * multiplier);
}

/**
 * Calculate value difference between two players
 */
export function calculateValueGap(
  higherRank: number,
  lowerRank: number
): { valueDiff: number; percentDiff: number } {
  const higherValue = rankToValue(higherRank);
  const lowerValue = rankToValue(lowerRank);

  const valueDiff = higherValue - lowerValue;
  const percentDiff = lowerValue > 0 ? (valueDiff / lowerValue) * 100 : 0;

  return {
    valueDiff,
    percentDiff,
  };
}
