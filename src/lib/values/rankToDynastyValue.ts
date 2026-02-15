/**
 * Convert dynasty ranking to value using exponential decay curve
 *
 * Formula: value = 10,000 * exp(-0.0045 * (rank - 1))
 *
 * Dynasty curve characteristics:
 * - Slower decay (longevity matters)
 * - Rewards youth and upside
 * - Multi-year production weighted
 *
 * Sample values:
 * - Rank 1 = 10,000
 * - Rank 10 = 9,560
 * - Rank 25 = 8,951
 * - Rank 50 = 8,004
 * - Rank 100 = 6,397
 * - Rank 200 = 4,092
 * - Rank 500 = 906
 * - Rank 1000 = 82
 */
export function rankToDynastyValue(rank: number, maxValue: number = 10000): number {
  if (rank < 1) return maxValue;

  const decayRate = 0.0045;
  const value = maxValue * Math.exp(-decayRate * (rank - 1));

  return Math.round(Math.max(0, Math.min(maxValue, value)));
}

/**
 * IDP-specific dynasty value scaling
 *
 * IDP players generally worth less than offensive players
 * but still benefit from dynasty longevity premium
 */
export function rankToIdpDynastyValue(rank: number, position: string): number {
  const baseValue = rankToDynastyValue(rank);
  let multiplier = 0.4;

  if (position === 'LB') {
    multiplier = 0.45;
  } else if (position === 'DL') {
    multiplier = 0.35;
  } else if (position === 'DB') {
    multiplier = 0.35;
  }

  return Math.round(baseValue * multiplier);
}

/**
 * Get dynasty value curve points for visualization
 */
export function getDynastyValueCurve(
  maxRank: number = 500
): Array<{ rank: number; value: number }> {
  const points: Array<{ rank: number; value: number }> = [];

  for (let rank = 1; rank <= maxRank; rank += Math.ceil(maxRank / 100)) {
    points.push({
      rank,
      value: rankToDynastyValue(rank),
    });
  }

  return points;
}

/**
 * Convert dynasty value back to estimated rank
 */
export function dynastyValueToRank(value: number, maxValue: number = 10000): number {
  if (value >= maxValue) return 1;
  if (value <= 0) return 1000;

  const decayRate = 0.0045;
  const rank = 1 + Math.log(maxValue / value) / decayRate;

  return Math.round(Math.max(1, rank));
}
