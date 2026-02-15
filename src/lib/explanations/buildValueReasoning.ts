/**
 * Value Reasoning Builder
 *
 * Generates structured reasoning for player value changes.
 * NEVER halluc

inates - only references actual pipeline factors.
 *
 * Tracks deltas from:
 * - Production changes
 * - Scarcity adjustments
 * - Age curve impact
 * - Availability modifiers
 * - Market anchor corrections
 * - Role changes
 * - Injury status
 * - Breakout/regression indicators
 */

export interface ValueReasoning {
  playerId: string;
  playerName: string;
  position: string;
  format: 'dynasty' | 'redraft';
  oldValue: number;
  newValue: number;
  delta: number;

  components: {
    production?: number;
    scarcity?: number;
    age_curve?: number;
    availability?: number;
    market_anchor?: number;
    role_change?: number;
    injury?: number;
    breakout?: number;
    regression?: number;
    opportunity?: number;
    efficiency?: number;
    draft_capital?: number;
    landing_spot?: number;
    trade_impact?: number;
  };

  primaryReason: string;
  primaryReasonDelta: number;
  secondaryReasons: Array<{
    reason: string;
    delta: number;
  }>;
}

export interface ValueContext {
  // Previous value components
  previousValue: number;
  previousRank: number;
  previousConfidence?: number;

  // New value components
  newValue: number;
  newRank: number;
  newConfidence?: number;

  // Component breakdowns
  baseValue: number;
  productionAdjustment: number;
  scarcityAdjustment: number;
  ageCurveAdjustment: number;
  availabilityModifier: number;
  marketAnchorDelta: number;
  roleChangeImpact: number;

  // Player context
  age?: number;
  yearsExp?: number;
  injuryStatus?: string;
  recentProduction?: number;
  opportunityChange?: number;
  efficiencyTrend?: number;

  // League context
  leagueProfileId?: string;
  positionScarcity?: number;
  positionDepth?: number;
}

/**
 * Build structured reasoning for a value change
 *
 * @param context - Value change context with component breakdowns
 * @returns Structured reasoning with primary/secondary factors
 */
export function buildValueReasoning(context: ValueContext): ValueReasoning {
  const delta = context.newValue - context.previousValue;

  // Build component map
  const components: ValueReasoning['components'] = {};

  if (context.productionAdjustment) {
    components.production = context.productionAdjustment;
  }

  if (context.scarcityAdjustment) {
    components.scarcity = context.scarcityAdjustment;
  }

  if (context.ageCurveAdjustment) {
    components.age_curve = context.ageCurveAdjustment;
  }

  if (context.availabilityModifier) {
    components.availability = context.availabilityModifier;

    // If availability is injury-related
    if (context.injuryStatus && context.injuryStatus !== 'Healthy') {
      components.injury = context.availabilityModifier;
    }
  }

  if (context.marketAnchorDelta) {
    components.market_anchor = context.marketAnchorDelta;
  }

  if (context.roleChangeImpact) {
    components.role_change = context.roleChangeImpact;
  }

  if (context.opportunityChange) {
    components.opportunity = context.opportunityChange;
  }

  if (context.efficiencyTrend) {
    components.efficiency = context.efficiencyTrend;
  }

  // Detect breakout (large positive production + opportunity)
  if (
    context.productionAdjustment > 500 &&
    context.opportunityChange &&
    context.opportunityChange > 0 &&
    context.yearsExp !== undefined &&
    context.yearsExp <= 3
  ) {
    components.breakout = context.productionAdjustment + context.opportunityChange;
  }

  // Detect regression (negative production + negative efficiency)
  if (
    context.productionAdjustment < -300 &&
    context.efficiencyTrend &&
    context.efficiencyTrend < 0
  ) {
    components.regression = context.productionAdjustment + context.efficiencyTrend;
  }

  // Determine primary reason (largest absolute delta)
  const reasonEntries = Object.entries(components).map(([reason, delta]) => ({
    reason,
    delta,
    absDelta: Math.abs(delta),
  }));

  reasonEntries.sort((a, b) => b.absDelta - a.absDelta);

  const primaryEntry = reasonEntries[0];
  const secondaryEntries = reasonEntries.slice(1, 4); // Top 3 secondary reasons

  return {
    playerId: '', // Will be filled by caller
    playerName: '', // Will be filled by caller
    position: '', // Will be filled by caller
    format: 'dynasty', // Will be filled by caller
    oldValue: context.previousValue,
    newValue: context.newValue,
    delta,
    components,
    primaryReason: primaryEntry?.reason || 'Other',
    primaryReasonDelta: primaryEntry?.delta || 0,
    secondaryReasons: secondaryEntries.map((entry) => ({
      reason: entry.reason,
      delta: entry.delta,
    })),
  };
}

/**
 * Build reasoning from minimal context
 *
 * Used when full pipeline breakdown isn't available.
 * Makes best-effort inferences from available data.
 */
export function buildBasicReasoning(
  oldValue: number,
  newValue: number,
  playerContext?: {
    age?: number;
    injuryStatus?: string;
    position?: string;
    yearsExp?: number;
  }
): Partial<ValueReasoning> {
  const delta = newValue - oldValue;
  const components: ValueReasoning['components'] = {};

  // If injury status changed
  if (playerContext?.injuryStatus && playerContext.injuryStatus !== 'Healthy') {
    // Estimate injury impact (usually negative)
    const injuryImpact = delta < 0 ? Math.max(delta, -1000) : 0;
    if (injuryImpact !== 0) {
      components.injury = injuryImpact;
      components.availability = injuryImpact;
    }
  }

  // If significant age-related decline
  if (playerContext?.age && playerContext.age >= 30 && delta < 0) {
    const estimatedAgePenalty = Math.floor(delta * 0.3); // ~30% of decline
    if (Math.abs(estimatedAgePenalty) > 100) {
      components.age_curve = estimatedAgePenalty;
    }
  }

  // If young player gaining value
  if (
    playerContext?.yearsExp !== undefined &&
    playerContext.yearsExp <= 2 &&
    delta > 500
  ) {
    components.breakout = Math.floor(delta * 0.6); // ~60% breakout factor
    components.production = Math.floor(delta * 0.4); // ~40% production
  }

  // Default to production change
  if (Object.keys(components).length === 0) {
    components.production = delta;
  }

  // Determine primary reason
  const reasonEntries = Object.entries(components).map(([reason, delta]) => ({
    reason,
    delta,
    absDelta: Math.abs(delta),
  }));

  reasonEntries.sort((a, b) => b.absDelta - a.absDelta);

  const primaryEntry = reasonEntries[0];

  return {
    oldValue,
    newValue,
    delta,
    components,
    primaryReason: primaryEntry?.reason || 'production',
    primaryReasonDelta: primaryEntry?.delta || delta,
    secondaryReasons: reasonEntries.slice(1, 3).map((entry) => ({
      reason: entry.reason,
      delta: entry.delta,
    })),
  };
}

/**
 * Categorize reason for display
 */
export function categorizeReason(reasonKey: string): string {
  const categories: Record<string, string> = {
    production: 'Production',
    scarcity: 'Scarcity',
    age_curve: 'Age',
    availability: 'Availability',
    market_anchor: 'Market',
    role_change: 'Role',
    injury: 'Injury',
    trade_impact: 'Trade',
    breakout: 'Breakout',
    regression: 'Regression',
    opportunity: 'Opportunity',
    efficiency: 'Efficiency',
    draft_capital: 'Draft Capital',
    landing_spot: 'Landing Spot',
  };

  return categories[reasonKey] || 'Other';
}

/**
 * Calculate component percentages
 *
 * Shows what % of the change was due to each factor.
 */
export function calculateComponentPercentages(
  reasoning: ValueReasoning
): Record<string, number> {
  const totalAbsChange = Math.abs(reasoning.delta);
  const percentages: Record<string, number> = {};

  if (totalAbsChange === 0) {
    return percentages;
  }

  for (const [reason, delta] of Object.entries(reasoning.components)) {
    const percentage = (Math.abs(delta) / totalAbsChange) * 100;
    percentages[reason] = Math.round(percentage);
  }

  return percentages;
}

/**
 * Get confidence in reasoning quality
 *
 * Higher confidence when more component data is available.
 */
export function getReasoningConfidence(reasoning: ValueReasoning): number {
  const componentCount = Object.keys(reasoning.components).length;

  // More components = higher confidence we captured the full picture
  if (componentCount >= 4) return 0.95;
  if (componentCount === 3) return 0.85;
  if (componentCount === 2) return 0.75;
  if (componentCount === 1) return 0.60;

  return 0.50; // Low confidence - incomplete data
}

/**
 * Validate reasoning doesn't exceed delta
 *
 * Component deltas should roughly sum to total delta.
 * Large discrepancies indicate missing factors.
 */
export function validateReasoning(reasoning: ValueReasoning): {
  valid: boolean;
  componentSum: number;
  discrepancy: number;
  missingFactors: boolean;
} {
  const componentSum = Object.values(reasoning.components).reduce(
    (sum, delta) => sum + delta,
    0
  );

  const discrepancy = Math.abs(reasoning.delta - componentSum);
  const discrepancyPercent = (discrepancy / Math.abs(reasoning.delta)) * 100;

  // Allow 20% discrepancy (rounding, etc.)
  const valid = discrepancyPercent <= 20;
  const missingFactors = discrepancyPercent > 20;

  return {
    valid,
    componentSum,
    discrepancy,
    missingFactors,
  };
}
