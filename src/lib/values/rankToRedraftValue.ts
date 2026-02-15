/**
 * Convert redraft ranking/ADP to value using exponential decay curve
 *
 * Formula: value = 10,000 * exp(-0.005 * (rank - 1))
 *
 * Redraft curve characteristics:
 * - Faster decay than dynasty (single season)
 * - Top picks much more valuable
 * - No longevity premium
 * - Current performance heavily weighted
 *
 * Sample values:
 * - Rank 1 = 10,000
 * - Rank 10 = 9,512
 * - Rank 25 = 8,825
 * - Rank 50 = 7,788
 * - Rank 100 = 6,065
 * - Rank 200 = 3,679
 * - Rank 300 = 2,231
 * - Rank 500 = 820
 */
export function rankToRedraftValue(rank: number, maxValue: number = 10000): number {
  if (rank < 1) return maxValue;

  const decayRate = 0.005;
  const value = maxValue * Math.exp(-decayRate * (rank - 1));

  return Math.round(Math.max(0, Math.min(maxValue, value)));
}

/**
 * Convert ADP to redraft value
 * ADP is essentially a rank, so use same curve
 */
export function adpToRedraftValue(adp: number, maxValue: number = 10000): number {
  return rankToRedraftValue(Math.round(adp), maxValue);
}

/**
 * IDP-specific redraft value scaling
 *
 * IDP players rare in redraft, so scale down significantly
 */
export function rankToIdpRedraftValue(rank: number, position: string): number {
  const baseValue = rankToRedraftValue(rank);
  let multiplier = 0.3;

  if (position === 'LB') {
    multiplier = 0.35;
  } else if (position === 'DL') {
    multiplier = 0.25;
  } else if (position === 'DB') {
    multiplier = 0.25;
  }

  return Math.round(baseValue * multiplier);
}

/**
 * Get redraft value curve points for visualization
 */
export function getRedraftValueCurve(
  maxRank: number = 500
): Array<{ rank: number; value: number }> {
  const points: Array<{ rank: number; value: number }> = [];

  for (let rank = 1; rank <= maxRank; rank += Math.ceil(maxRank / 100)) {
    points.push({
      rank,
      value: rankToRedraftValue(rank),
    });
  }

  return points;
}

/**
 * Convert redraft value back to estimated rank
 */
export function redraftValueToRank(value: number, maxValue: number = 10000): number {
  if (value >= maxValue) return 1;
  if (value <= 0) return 500;

  const decayRate = 0.005;
  const rank = 1 + Math.log(maxValue / value) / decayRate;

  return Math.round(Math.max(1, rank));
}

/**
 * Compare dynasty vs redraft value curves
 */
export function compareDynastyVsRedraft(
  rank: number
): { dynasty: number; redraft: number; diff: number } {
  const dynastyValue = 10000 * Math.exp(-0.0045 * (rank - 1));
  const redraftValue = 10000 * Math.exp(-0.005 * (rank - 1));

  return {
    dynasty: Math.round(dynastyValue),
    redraft: Math.round(redraftValue),
    diff: Math.round(dynastyValue - redraftValue),
  };
}
