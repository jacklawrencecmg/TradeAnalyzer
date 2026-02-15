import { TrendSignal } from './trendSignals';
import { isInSeason } from '../stats/sleeperWeeklyStats';

export interface BlendedSignal {
  delta: number;
  reason: string;
  performance_delta: number;
  market_delta: number;
  performance_weight: number;
  market_weight: number;
}

/**
 * Get current season phase weights
 */
export function getSeasonWeights(): { performance: number; market: number } {
  const inSeason = isInSeason();

  if (inSeason) {
    return {
      performance: 0.65,
      market: 0.35,
    };
  } else {
    // Offseason: market/news matters more
    return {
      performance: 0.35,
      market: 0.65,
    };
  }
}

/**
 * Blend performance and market signals with seasonal weights
 */
export function blendSignals(
  performanceTrend: TrendSignal,
  marketTrend: TrendSignal
): BlendedSignal {
  const weights = getSeasonWeights();

  // Weighted average
  const blendedDelta =
    performanceTrend.delta * weights.performance +
    marketTrend.delta * weights.market;

  // Apply weekly cap
  const weeklyMax = 500;
  const cappedDelta = Math.max(-weeklyMax, Math.min(weeklyMax, Math.round(blendedDelta)));

  // Build comprehensive reason
  let reason = '';
  if (performanceTrend.delta !== 0 && marketTrend.delta !== 0) {
    reason = `Performance (${performanceTrend.delta > 0 ? '+' : ''}${performanceTrend.delta}): ${performanceTrend.reason}; Market (${marketTrend.delta > 0 ? '+' : ''}${marketTrend.delta}): ${marketTrend.reason}`;
  } else if (performanceTrend.delta !== 0) {
    reason = `Performance: ${performanceTrend.reason}`;
  } else if (marketTrend.delta !== 0) {
    reason = `Market: ${marketTrend.reason}`;
  } else {
    reason = 'No significant change';
  }

  if (cappedDelta !== Math.round(blendedDelta)) {
    reason += ` (capped to ±${weeklyMax})`;
  }

  return {
    delta: cappedDelta,
    reason,
    performance_delta: performanceTrend.delta,
    market_delta: marketTrend.delta,
    performance_weight: weights.performance,
    market_weight: weights.market,
  };
}

/**
 * Apply monthly rolling cap to prevent excessive accumulated changes
 */
export async function applyMonthlyRollingCap(
  playerId: string,
  proposedDelta: number,
  supabase: any
): Promise<{ delta: number; capped: boolean; reason?: string }> {
  // Get total adjustments in last 30 days
  const { data: recentAdjustments } = await supabase
    .from('dynasty_adjustments')
    .select('delta')
    .eq('player_id', playerId)
    .gte('as_of_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const monthlyTotal =
    (recentAdjustments || []).reduce((sum: number, adj: any) => sum + adj.delta, 0) +
    proposedDelta;

  const monthlyMax = 1200;

  // If adding this would exceed monthly cap
  if (Math.abs(monthlyTotal) > monthlyMax) {
    // Calculate how much we can still add
    const currentTotal = monthlyTotal - proposedDelta;
    const remainingBudget = monthlyMax - Math.abs(currentTotal);

    if (remainingBudget <= 0) {
      return {
        delta: 0,
        capped: true,
        reason: `Monthly cap reached (${currentTotal} in last 30 days)`,
      };
    }

    // Scale down the proposed delta
    const sign = proposedDelta > 0 ? 1 : -1;
    const cappedDelta = sign * Math.min(Math.abs(proposedDelta), remainingBudget);

    return {
      delta: cappedDelta,
      capped: true,
      reason: `Monthly cap applied (${currentTotal} + ${proposedDelta} > ${monthlyMax})`,
    };
  }

  return {
    delta: proposedDelta,
    capped: false,
  };
}

/**
 * Handle inactive/retired players with gradual decay
 */
export async function applyStatusAdjustment(
  playerId: string,
  baseDelta: number,
  supabase: any
): Promise<{ delta: number; reason?: string }> {
  // Check player status
  const { data: player } = await supabase
    .from('nfl_players')
    .select('status, injury_status')
    .eq('id', playerId)
    .maybeSingle();

  if (!player) {
    return { delta: baseDelta };
  }

  // Retired player: apply gradual decay
  if (player.status === 'Retired') {
    // Get weeks since retirement (simplified check)
    const retirementDelta = -250; // Gradual weekly decline

    return {
      delta: retirementDelta,
      reason: 'Retired player decay',
    };
  }

  // Inactive for season: apply moderate decline
  if (player.status === 'Inactive' || player.injury_status === 'Out for Season') {
    const inactiveDelta = Math.min(baseDelta, -150);

    return {
      delta: inactiveDelta,
      reason: 'Inactive/injured player adjustment',
    };
  }

  return { delta: baseDelta };
}

/**
 * Complete blending pipeline with all safety checks
 */
export async function blendAndApplySafety(
  playerId: string,
  performanceTrend: TrendSignal,
  marketTrend: TrendSignal,
  supabase: any
): Promise<BlendedSignal> {
  // Step 1: Blend signals
  const blended = blendSignals(performanceTrend, marketTrend);

  // Step 2: Apply status adjustments
  const statusResult = await applyStatusAdjustment(playerId, blended.delta, supabase);
  let finalDelta = statusResult.delta;
  let finalReason = statusResult.reason || blended.reason;

  // Step 3: Apply monthly rolling cap
  const capResult = await applyMonthlyRollingCap(playerId, finalDelta, supabase);
  if (capResult.capped) {
    finalDelta = capResult.delta;
    if (capResult.reason) {
      finalReason += `; ${capResult.reason}`;
    }
  }

  return {
    ...blended,
    delta: finalDelta,
    reason: finalReason,
  };
}
