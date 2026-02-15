import { supabase } from '../supabase';
import { getRecentStats, getSeasonAverage } from '../stats/sleeperWeeklyStats';

export interface TrendSignal {
  delta: number;
  reason: string;
  confidence: number;
}

interface PlayerStats {
  player_id: string;
  season: number;
  week: number;
  fantasy_points: number;
}

/**
 * Calculate performance-based trend signal for a player
 */
export async function calculatePerformanceTrend(
  playerId: string,
  currentSeason: number
): Promise<TrendSignal> {
  const recentStats = await getRecentStats(playerId, 4);
  const seasonAvg = await getSeasonAverage(playerId, currentSeason);

  // Not enough data
  if (recentStats.length < 2) {
    return {
      delta: 0,
      reason: 'Insufficient data for trend analysis',
      confidence: 0,
    };
  }

  // Calculate recent averages
  const last2Weeks = recentStats.slice(0, 2);
  const last4Weeks = recentStats.slice(0, 4);

  const last2Avg =
    last2Weeks.reduce((sum, s) => sum + s.fantasy_points, 0) / last2Weeks.length;
  const last4Avg =
    last4Weeks.reduce((sum, s) => sum + s.fantasy_points, 0) / last4Weeks.length;

  // Check for injury/absence (multiple near-zero weeks)
  const zeroWeeks = recentStats.filter((s) => s.fantasy_points < 2).length;
  if (zeroWeeks >= 2) {
    return {
      delta: -200, // Moderate negative for injury concern
      reason: `${zeroWeeks} low-scoring weeks (injury concern)`,
      confidence: 0.6,
    };
  }

  // No season average yet (early season)
  if (!seasonAvg) {
    // Just look at recent trend
    if (last2Avg > last4Avg * 1.2) {
      return {
        delta: 150,
        reason: 'Strong recent performance (early season)',
        confidence: 0.5,
      };
    } else if (last2Avg < last4Avg * 0.8) {
      return {
        delta: -150,
        reason: 'Declining recent performance (early season)',
        confidence: 0.5,
      };
    }

    return {
      delta: 0,
      reason: 'Stable early season performance',
      confidence: 0.4,
    };
  }

  // Breakout detection: last 2-week avg ≥ season avg + 35%
  const breakoutThreshold = seasonAvg * 1.35;
  if (last2Avg >= breakoutThreshold) {
    // Check if sustained (all 4 weeks above season avg)
    const sustained = last4Weeks.every((s) => s.fantasy_points >= seasonAvg);

    if (sustained) {
      return {
        delta: 650,
        reason: `Sustained breakout: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
        confidence: 0.85,
      };
    } else {
      return {
        delta: 400,
        reason: `Recent breakout: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
        confidence: 0.65,
      };
    }
  }

  // Slump detection: last 2-week avg ≤ season avg - 35%
  const slumpThreshold = seasonAvg * 0.65;
  if (last2Avg <= slumpThreshold) {
    // Check if sustained slump
    const sustained = last4Weeks.every((s) => s.fantasy_points <= seasonAvg);

    if (sustained) {
      return {
        delta: -650,
        reason: `Sustained slump: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
        confidence: 0.85,
      };
    } else {
      return {
        delta: -400,
        reason: `Recent slump: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
        confidence: 0.65,
      };
    }
  }

  // Moderate upward trend
  if (last2Avg > seasonAvg * 1.15) {
    return {
      delta: 200,
      reason: `Trending up: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
      confidence: 0.6,
    };
  }

  // Moderate downward trend
  if (last2Avg < seasonAvg * 0.85) {
    return {
      delta: -200,
      reason: `Trending down: ${last2Avg.toFixed(1)} PPG vs ${seasonAvg.toFixed(1)} season avg`,
      confidence: 0.6,
    };
  }

  // Stable performance
  return {
    delta: 0,
    reason: `Stable performance: ${last2Avg.toFixed(1)} PPG`,
    confidence: 0.7,
  };
}

/**
 * Calculate market-based trend signal using recent value changes
 */
export async function calculateMarketTrend(playerId: string): Promise<TrendSignal> {
  const { data: recentSnapshots } = await supabase
    .from('ktc_value_snapshots')
    .select('captured_at, fdp_value')
    .eq('player_id', playerId)
    .eq('format', 'dynasty_sf')
    .order('captured_at', { ascending: false })
    .limit(4);

  if (!recentSnapshots || recentSnapshots.length < 2) {
    return {
      delta: 0,
      reason: 'Insufficient market data',
      confidence: 0,
    };
  }

  const current = recentSnapshots[0].fdp_value;
  const previous = recentSnapshots[1].fdp_value;
  const marketChange = current - previous;

  // Significant market move
  if (Math.abs(marketChange) >= 500) {
    const direction = marketChange > 0 ? 'rising' : 'falling';
    const delta = Math.round(marketChange * 0.3); // 30% of market change

    return {
      delta: Math.max(-500, Math.min(500, delta)),
      reason: `Market ${direction}: ${Math.abs(marketChange)} point move`,
      confidence: 0.7,
    };
  }

  // Moderate market move
  if (Math.abs(marketChange) >= 200) {
    const direction = marketChange > 0 ? 'rising' : 'falling';
    const delta = Math.round(marketChange * 0.4);

    return {
      delta: Math.max(-300, Math.min(300, delta)),
      reason: `Market ${direction}: ${Math.abs(marketChange)} point move`,
      confidence: 0.5,
    };
  }

  // Stable market
  return {
    delta: 0,
    reason: 'Stable market value',
    confidence: 0.6,
  };
}

/**
 * Apply safety caps to prevent extreme swings
 */
export function applySafetyCaps(delta: number, reason: string): TrendSignal {
  const weeklyMax = 500;
  const capped = Math.max(-weeklyMax, Math.min(weeklyMax, delta));

  if (capped !== delta) {
    return {
      delta: capped,
      reason: `${reason} (capped from ${delta})`,
      confidence: 0.9,
    };
  }

  return {
    delta: capped,
    reason,
    confidence: 0.8,
  };
}

/**
 * Calculate combined trend signal for a player
 */
export async function calculateTrendSignal(
  playerId: string,
  currentSeason: number
): Promise<TrendSignal> {
  try {
    const [perfTrend, marketTrend] = await Promise.all([
      calculatePerformanceTrend(playerId, currentSeason),
      calculateMarketTrend(playerId),
    ]);

    // If one signal has very low confidence, use the other
    if (perfTrend.confidence < 0.3 && marketTrend.confidence >= 0.5) {
      return applySafetyCaps(marketTrend.delta, `Market: ${marketTrend.reason}`);
    }

    if (marketTrend.confidence < 0.3 && perfTrend.confidence >= 0.5) {
      return applySafetyCaps(perfTrend.delta, `Performance: ${perfTrend.reason}`);
    }

    // Both signals available: will be blended in next step
    // For now, return performance trend as primary
    return applySafetyCaps(perfTrend.delta, perfTrend.reason);
  } catch (error) {
    console.error(`Error calculating trend for player ${playerId}:`, error);
    return {
      delta: 0,
      reason: 'Error calculating trend',
      confidence: 0,
    };
  }
}

/**
 * Batch calculate trends for multiple players
 */
export async function calculateTrendsForPlayers(
  playerIds: string[],
  currentSeason: number
): Promise<Map<string, TrendSignal>> {
  const results = new Map<string, TrendSignal>();

  // Process in batches to avoid overwhelming the system
  const batchSize = 50;
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const signals = await Promise.all(
      batch.map((id) => calculateTrendSignal(id, currentSeason))
    );

    batch.forEach((id, index) => {
      results.set(id, signals[index]);
    });
  }

  return results;
}
