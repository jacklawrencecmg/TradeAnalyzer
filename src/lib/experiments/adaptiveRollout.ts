/**
 * Adaptive Feature Rollout
 *
 * Gradually increases traffic to winning experiment variants.
 * Automatically rolls out features that perform better.
 *
 * Safety mechanism: Never blindly change the model again.
 */

import { supabase } from '../supabase';
import {
  getExperimentVariants,
  updateVariantTraffic,
  deactivateExperiment,
} from './getExperimentVariant';

export interface VariantPerformance {
  variant: string;
  totalUsers: number;
  successRate: number;
  sampleSize: number;
  confidence: number;
}

export interface RolloutDecision {
  action: 'increase_traffic' | 'decrease_traffic' | 'maintain' | 'winner_declared' | 'stop_test';
  variant: string;
  currentTraffic: number;
  recommendedTraffic: number;
  reason: string;
  confidence: number;
}

/**
 * Evaluate experiment and recommend rollout action
 *
 * Compares variant performance and suggests traffic adjustments
 */
export async function evaluateExperimentRollout(
  experimentId: string,
  metric: 'advice_success' | 'trade_success' | 'user_engagement'
): Promise<RolloutDecision[]> {
  const variants = await getExperimentVariants(experimentId);
  const performances = await Promise.all(
    variants.map((v) => getVariantPerformance(experimentId, v.variant, metric))
  );

  const decisions: RolloutDecision[] = [];

  // Find best performing variant
  const sortedPerformances = [...performances].sort((a, b) => b.successRate - a.successRate);
  const bestVariant = sortedPerformances[0];
  const controlVariant = performances.find((p) => p.variant === 'control') || sortedPerformances[1];

  // Check if best variant is significantly better than control
  const improvement = bestVariant.successRate - controlVariant.successRate;
  const isSignificant = isStatisticallySignificant(bestVariant, controlVariant);

  // Minimum sample size for making decisions
  const MIN_SAMPLE_SIZE = 50;
  const hasEnoughData =
    bestVariant.sampleSize >= MIN_SAMPLE_SIZE &&
    controlVariant.sampleSize >= MIN_SAMPLE_SIZE;

  if (!hasEnoughData) {
    return [
      {
        action: 'maintain',
        variant: 'all',
        currentTraffic: 0,
        recommendedTraffic: 0,
        reason: `Insufficient data (need ${MIN_SAMPLE_SIZE} samples per variant)`,
        confidence: 0,
      },
    ];
  }

  // Decision logic
  if (isSignificant && improvement > 10) {
    // Best variant is significantly better (>10% improvement)
    const currentVariant = variants.find((v) => v.variant === bestVariant.variant);

    if (!currentVariant) {
      return decisions;
    }

    if (currentVariant.trafficPercent >= 95) {
      // Already at max traffic - declare winner
      decisions.push({
        action: 'winner_declared',
        variant: bestVariant.variant,
        currentTraffic: currentVariant.trafficPercent,
        recommendedTraffic: 100,
        reason: `Variant ${bestVariant.variant} is clear winner (+${improvement.toFixed(1)}% improvement)`,
        confidence: bestVariant.confidence,
      });
    } else {
      // Gradually increase traffic
      const newTraffic = Math.min(
        100,
        currentVariant.trafficPercent + calculateTrafficIncrease(improvement)
      );

      decisions.push({
        action: 'increase_traffic',
        variant: bestVariant.variant,
        currentTraffic: currentVariant.trafficPercent,
        recommendedTraffic: newTraffic,
        reason: `Strong performance (+${improvement.toFixed(1)}% improvement), increasing traffic`,
        confidence: bestVariant.confidence,
      });
    }
  } else if (isSignificant && improvement < -10) {
    // Best variant is significantly worse
    const currentVariant = variants.find((v) => v.variant === bestVariant.variant);

    if (!currentVariant) {
      return decisions;
    }

    decisions.push({
      action: 'decrease_traffic',
      variant: bestVariant.variant,
      currentTraffic: currentVariant.trafficPercent,
      recommendedTraffic: Math.max(0, currentVariant.trafficPercent - 20),
      reason: `Poor performance (${improvement.toFixed(1)}% worse), reducing traffic`,
      confidence: bestVariant.confidence,
    });
  } else if (Math.abs(improvement) < 2) {
    // No significant difference
    decisions.push({
      action: 'maintain',
      variant: 'all',
      currentTraffic: 0,
      recommendedTraffic: 0,
      reason: 'No significant difference between variants, maintaining current traffic',
      confidence: Math.min(...performances.map((p) => p.confidence)),
    });
  } else {
    // Moderate improvement but not significant yet
    decisions.push({
      action: 'maintain',
      variant: bestVariant.variant,
      currentTraffic: 0,
      recommendedTraffic: 0,
      reason: `Moderate improvement (+${improvement.toFixed(1)}%) but not statistically significant yet`,
      confidence: bestVariant.confidence,
    });
  }

  return decisions;
}

/**
 * Get variant performance for metric
 */
async function getVariantPerformance(
  experimentId: string,
  variant: string,
  metric: 'advice_success' | 'trade_success' | 'user_engagement'
): Promise<VariantPerformance> {
  // Get users assigned to this variant
  const { data: assignments } = await supabase
    .from('user_experiment_assignments')
    .select('user_id')
    .eq('experiment_id', experimentId)
    .eq('variant', variant);

  const totalUsers = assignments?.length || 0;
  const userIds = (assignments || []).map((a) => a.user_id);

  if (userIds.length === 0) {
    return {
      variant,
      totalUsers: 0,
      successRate: 0,
      sampleSize: 0,
      confidence: 0,
    };
  }

  let successRate = 0;
  let sampleSize = 0;

  switch (metric) {
    case 'advice_success':
      // Get advice outcomes for these users
      const { data: adviceData } = await supabase
        .from('advice_outcomes')
        .select('success')
        .in('user_id', userIds)
        .not('success', 'is', null);

      sampleSize = adviceData?.length || 0;
      const successful = adviceData?.filter((a) => a.success === true).length || 0;
      successRate = sampleSize > 0 ? (successful / sampleSize) * 100 : 0;
      break;

    case 'trade_success':
      // Get trade outcomes for these users
      // TODO: Link trades to users
      sampleSize = 0;
      successRate = 0;
      break;

    case 'user_engagement':
      // Get user actions for these users
      const { data: actionsData } = await supabase
        .from('user_actions')
        .select('id')
        .in('user_id', userIds)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      sampleSize = actionsData?.length || 0;
      successRate = sampleSize > 0 ? (sampleSize / totalUsers) * 10 : 0; // Actions per user * 10
      break;
  }

  // Calculate confidence based on sample size
  const confidence = Math.min(100, (sampleSize / 100) * 100);

  return {
    variant,
    totalUsers,
    successRate,
    sampleSize,
    confidence,
  };
}

/**
 * Check if difference is statistically significant
 *
 * Uses simple z-test for proportions
 */
function isStatisticallySignificant(
  variantA: VariantPerformance,
  variantB: VariantPerformance
): boolean {
  if (variantA.sampleSize < 30 || variantB.sampleSize < 30) {
    return false; // Need minimum sample size
  }

  const p1 = variantA.successRate / 100;
  const p2 = variantB.successRate / 100;
  const n1 = variantA.sampleSize;
  const n2 = variantB.sampleSize;

  // Pooled proportion
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  // Z-score
  const z = Math.abs((p1 - p2) / se);

  // Check if z-score exceeds critical value for 95% confidence (1.96)
  return z > 1.96;
}

/**
 * Calculate traffic increase based on improvement
 *
 * Larger improvements = faster rollout
 */
function calculateTrafficIncrease(improvementPercent: number): number {
  if (improvementPercent > 20) return 25; // Large improvement: +25%
  if (improvementPercent > 15) return 20; // Good improvement: +20%
  if (improvementPercent > 10) return 15; // Moderate improvement: +15%
  return 10; // Small improvement: +10%
}

/**
 * Apply rollout decision
 *
 * Updates variant traffic based on decision
 */
export async function applyRolloutDecision(
  experimentId: string,
  decision: RolloutDecision
): Promise<boolean> {
  if (decision.action === 'maintain') {
    return true; // No change needed
  }

  if (decision.action === 'winner_declared') {
    // Set winner to 100%, others to 0%
    const variants = await getExperimentVariants(experimentId);

    for (const variant of variants) {
      const newTraffic = variant.variant === decision.variant ? 100 : 0;
      await updateVariantTraffic(experimentId, variant.variant, newTraffic);
    }

    // Optionally deactivate experiment
    // await deactivateExperiment(experimentId);

    return true;
  }

  if (decision.action === 'increase_traffic' || decision.action === 'decrease_traffic') {
    // Update variant traffic
    await updateVariantTraffic(experimentId, decision.variant, decision.recommendedTraffic);

    // Adjust other variants proportionally
    const variants = await getExperimentVariants(experimentId);
    const otherVariants = variants.filter((v) => v.variant !== decision.variant);
    const remainingTraffic = 100 - decision.recommendedTraffic;
    const trafficPerOther = Math.floor(remainingTraffic / otherVariants.length);

    for (const variant of otherVariants) {
      await updateVariantTraffic(experimentId, variant.variant, trafficPerOther);
    }

    return true;
  }

  return false;
}

/**
 * Auto-rollout experiment (run periodically)
 *
 * Evaluates experiment and applies recommended actions
 */
export async function autoRolloutExperiment(
  experimentId: string,
  metric: 'advice_success' | 'trade_success' | 'user_engagement'
): Promise<RolloutDecision[]> {
  const decisions = await evaluateExperimentRollout(experimentId, metric);

  for (const decision of decisions) {
    if (decision.action !== 'maintain') {
      console.log(`Applying rollout decision for ${experimentId}:`, decision);
      await applyRolloutDecision(experimentId, decision);
    }
  }

  return decisions;
}

/**
 * Get experiment performance summary
 */
export async function getExperimentPerformanceSummary(
  experimentId: string,
  metric: 'advice_success' | 'trade_success' | 'user_engagement'
): Promise<{
  variants: VariantPerformance[];
  recommendation: RolloutDecision[];
  winner?: string;
  improvement?: number;
}> {
  const variants = await getExperimentVariants(experimentId);
  const performances = await Promise.all(
    variants.map((v) => getVariantPerformance(experimentId, v.variant, metric))
  );

  const recommendations = await evaluateExperimentRollout(experimentId, metric);

  // Find winner if declared
  const winnerDecision = recommendations.find((d) => d.action === 'winner_declared');
  const winner = winnerDecision?.variant;

  // Calculate improvement
  const sortedPerformances = [...performances].sort((a, b) => b.successRate - a.successRate);
  const bestVariant = sortedPerformances[0];
  const controlVariant = performances.find((p) => p.variant === 'control') || sortedPerformances[1];
  const improvement = bestVariant.successRate - controlVariant.successRate;

  return {
    variants: performances,
    recommendation: recommendations,
    winner,
    improvement: Math.round(improvement * 100) / 100,
  };
}
