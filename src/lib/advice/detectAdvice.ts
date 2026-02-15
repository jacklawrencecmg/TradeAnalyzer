/**
 * Advice Detectors
 *
 * Rule-based detection for each advice type:
 * - buy_low: Undervalued by market
 * - sell_high: Overvalued by market
 * - breakout: Rising usage + value
 * - waiver: Low rostered%, high value
 * - stash: Young player with upside
 * - avoid: Trap players
 */

import type { PlayerMarketPosition } from './evaluateMarketPosition';

export interface AdviceRecommendation {
  adviceType: 'buy_low' | 'sell_high' | 'breakout' | 'waiver' | 'stash' | 'avoid';
  confidence: number; // 1-100
  score: number; // Sortable score
  reason: string;
  supportingFactors: string[];
  expiresAt?: Date;
}

/**
 * Detect buy low opportunity
 *
 * Criteria:
 * - value_delta > +600 (model higher than market)
 * - recent_change_7d <= 0 (price declining or stable)
 * - availability != out_longterm
 */
export function detectBuyLow(position: PlayerMarketPosition): AdviceRecommendation | null {
  const MIN_VALUE_DELTA = 600;

  // Check basic criteria
  if (position.valueDelta < MIN_VALUE_DELTA) {
    return null;
  }

  if (position.recentChange7d > 200) {
    return null; // Price is rising, not a buy low
  }

  if (position.availabilityStatus === 'Out' || position.availabilityStatus === 'IR') {
    // Long-term injury, not a buy low (too risky)
    return null;
  }

  // Calculate confidence
  const confidence = calculateBuyLowConfidence(position);

  if (confidence < 50) {
    return null; // Below minimum threshold
  }

  // Generate reason
  const reason = generateBuyLowReason(position);

  // Supporting factors
  const supportingFactors = getBuyLowFactors(position);

  // Calculate score for sorting
  const score = position.valueDelta + (position.usageTrend * 500);

  return {
    adviceType: 'buy_low',
    confidence,
    score,
    reason,
    supportingFactors,
  };
}

function calculateBuyLowConfidence(position: PlayerMarketPosition): number {
  let confidence = 50;

  // Value delta confidence
  confidence += Math.min(30, position.valueDelta / 40);

  // Usage trend bonus
  if (position.usageTrend > 0.2) {
    confidence += position.usageTrend * 15;
  }

  // Recent decline bonus
  if (position.recentChange7d < -200) {
    confidence += 10;
  }

  // Data quality factor
  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateBuyLowReason(position: PlayerMarketPosition): string {
  if (position.usageTrend > 0.3) {
    return 'Usage rising but market price stagnant';
  }

  if (position.recentChange7d < -300) {
    return 'Market overreacted to recent decline';
  }

  if (position.injuryStatus && position.injuryStatus !== 'Healthy') {
    return 'Post-injury discount opportunity';
  }

  if (Math.abs(position.recentChange7d) < 100) {
    return 'Market slow to react to underlying value';
  }

  return 'Undervalued relative to projected production';
}

function getBuyLowFactors(position: PlayerMarketPosition): string[] {
  const factors: string[] = [];

  factors.push(`Model value ${position.valueDelta} points higher than market`);

  if (position.usageTrend > 0.2) {
    factors.push('Usage trend improving');
  }

  if (position.recentChange7d < 0) {
    factors.push(`Market value declined ${Math.abs(position.recentChange7d)} in last 7 days`);
  }

  if (position.rankDelta && position.rankDelta > 10) {
    factors.push(`Market rank #${position.marketRank} vs model rank #${position.modelRank}`);
  }

  return factors;
}

/**
 * Detect sell high opportunity
 *
 * Criteria:
 * - value_delta < -600 (market higher than model)
 * - recent_change_7d > 0 (price rising)
 */
export function detectSellHigh(position: PlayerMarketPosition): AdviceRecommendation | null {
  const MIN_VALUE_DELTA = -600;

  if (position.valueDelta > MIN_VALUE_DELTA) {
    return null;
  }

  if (position.recentChange7d <= 0) {
    return null; // Price not rising
  }

  const confidence = calculateSellHighConfidence(position);

  if (confidence < 50) {
    return null;
  }

  const reason = generateSellHighReason(position);
  const supportingFactors = getSellHighFactors(position);
  const score = Math.abs(position.valueDelta) + position.recentChange7d;

  return {
    adviceType: 'sell_high',
    confidence,
    score,
    reason,
    supportingFactors,
  };
}

function calculateSellHighConfidence(position: PlayerMarketPosition): number {
  let confidence = 50;

  confidence += Math.min(30, Math.abs(position.valueDelta) / 40);

  if (position.recentChange7d > 300) {
    confidence += 15;
  }

  if (position.usageTrend < -0.2) {
    confidence += 10; // Usage declining, even better sell signal
  }

  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateSellHighReason(position: PlayerMarketPosition): string {
  if (position.recentChange7d > 500) {
    return 'Recent spike likely unsustainable';
  }

  if (position.usageTrend < -0.2) {
    return 'Usage declining but market hasn\'t adjusted';
  }

  if (position.age && position.age >= 29 && position.position === 'RB') {
    return 'Sell before age-related decline';
  }

  return 'Market hype exceeds real value';
}

function getSellHighFactors(position: PlayerMarketPosition): string[] {
  const factors: string[] = [];

  factors.push(`Market value ${Math.abs(position.valueDelta)} points higher than model`);

  if (position.recentChange7d > 0) {
    factors.push(`Market value increased ${position.recentChange7d} in last 7 days`);
  }

  if (position.usageTrend < 0) {
    factors.push('Usage trend declining');
  }

  if (position.rankDelta && position.rankDelta < -10) {
    factors.push(`Overranked: Market #${position.marketRank} vs Model #${position.modelRank}`);
  }

  return factors;
}

/**
 * Detect breakout candidate
 *
 * Criteria:
 * - usage_trend >= 0.25 (strong upward)
 * - recent_change_24h > 150 (momentum)
 * - model_rank improving
 */
export function detectBreakout(position: PlayerMarketPosition): AdviceRecommendation | null {
  if (position.usageTrend < 0.25) {
    return null;
  }

  if (position.recentChange24h < 150) {
    return null;
  }

  const confidence = calculateBreakoutConfidence(position);

  if (confidence < 50) {
    return null;
  }

  const reason = generateBreakoutReason(position);
  const supportingFactors = getBreakoutFactors(position);
  const score = position.recentChange24h + (position.usageTrend * 1000);

  // Breakouts expire in 72 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  return {
    adviceType: 'breakout',
    confidence,
    score,
    reason,
    supportingFactors,
    expiresAt,
  };
}

function calculateBreakoutConfidence(position: PlayerMarketPosition): number {
  let confidence = 50;

  confidence += position.usageTrend * 30;

  if (position.recentChange24h > 300) {
    confidence += 15;
  }

  if (position.age && position.age <= 24) {
    confidence += 10; // Young players more likely to sustain breakout
  }

  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateBreakoutReason(position: PlayerMarketPosition): string {
  if (position.age && position.age <= 23 && position.position === 'WR') {
    return 'Classic year 2-3 WR breakout pattern';
  }

  if (position.recentChange24h > 400) {
    return 'Elite usage surge + production spike';
  }

  return 'Opportunity expanding, production following';
}

function getBreakoutFactors(position: PlayerMarketPosition): string[] {
  const factors: string[] = [];

  factors.push(`Strong usage trend (+${(position.usageTrend * 100).toFixed(0)}%)`);

  if (position.recentChange24h > 0) {
    factors.push(`Value increased ${position.recentChange24h} in last 24h`);
  }

  if (position.age && position.age <= 24) {
    factors.push(`Young player (age ${position.age}) with upside`);
  }

  if (position.rankDelta && position.rankDelta > 0) {
    factors.push('Model projecting continued rise');
  }

  return factors;
}

/**
 * Detect waiver wire target
 *
 * Criteria:
 * - rostered_percent < 60
 * - model_value > replacement_level + 400
 */
export function detectWaiverTarget(
  position: PlayerMarketPosition,
  replacementLevel: number
): AdviceRecommendation | null {
  if (position.rosteredPercent !== null && position.rosteredPercent >= 60) {
    return null; // Too widely rostered
  }

  if (position.modelValue < replacementLevel + 400) {
    return null; // Not valuable enough above replacement
  }

  const confidence = calculateWaiverConfidence(position, replacementLevel);

  if (confidence < 50) {
    return null;
  }

  const reason = generateWaiverReason(position);
  const supportingFactors = getWaiverFactors(position, replacementLevel);
  const score = position.modelValue - replacementLevel;

  return {
    adviceType: 'waiver',
    confidence,
    score,
    reason,
    supportingFactors,
  };
}

function calculateWaiverConfidence(
  position: PlayerMarketPosition,
  replacementLevel: number
): number {
  let confidence = 50;

  const valueAboveReplacement = position.modelValue - replacementLevel;
  confidence += Math.min(25, valueAboveReplacement / 40);

  if (position.rosteredPercent !== null && position.rosteredPercent < 30) {
    confidence += 15; // Very low rostered = hidden gem
  }

  if (position.usageTrend > 0.2) {
    confidence += 10;
  }

  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateWaiverReason(position: PlayerMarketPosition): string {
  if (position.usageTrend > 0.3) {
    return 'Rising usage, likely available on waivers';
  }

  if (position.injuryStatus === 'Questionable') {
    return 'Opportunity opening due to injury ahead';
  }

  if (position.recentChange7d > 200) {
    return 'Emerging value before wider recognition';
  }

  return 'Underrostered relative to projected value';
}

function getWaiverFactors(position: PlayerMarketPosition, replacementLevel: number): string[] {
  const factors: string[] = [];

  const valueAboveReplacement = position.modelValue - replacementLevel;
  factors.push(`Value ${valueAboveReplacement} points above replacement level`);

  if (position.rosteredPercent !== null) {
    factors.push(`Only ${position.rosteredPercent}% rostered`);
  }

  if (position.usageTrend > 0) {
    factors.push('Usage trending upward');
  }

  if (position.recentChange7d > 0) {
    factors.push('Value rising, act quickly');
  }

  return factors;
}

/**
 * Detect stash candidate (dynasty only)
 *
 * Criteria:
 * - age <= 24
 * - snap_share rising (usage_trend > 0)
 * - market_rank >> model_rank (undervalued)
 */
export function detectStash(position: PlayerMarketPosition): AdviceRecommendation | null {
  if (position.format !== 'dynasty') {
    return null; // Stash only relevant for dynasty
  }

  if (!position.age || position.age > 24) {
    return null;
  }

  if (position.usageTrend <= 0) {
    return null; // Want rising usage
  }

  if (!position.rankDelta || position.rankDelta <= 5) {
    return null; // Want significant undervaluation
  }

  const confidence = calculateStashConfidence(position);

  if (confidence < 50) {
    return null;
  }

  const reason = generateStashReason(position);
  const supportingFactors = getStashFactors(position);
  const score = (position.rankDelta || 0) * 10 + (position.usageTrend * 500);

  return {
    adviceType: 'stash',
    confidence,
    score,
    reason,
    supportingFactors,
  };
}

function calculateStashConfidence(position: PlayerMarketPosition): number {
  let confidence = 50;

  if (position.age && position.age <= 22) {
    confidence += 15;
  }

  confidence += position.usageTrend * 20;

  if (position.rankDelta && position.rankDelta > 20) {
    confidence += 15;
  }

  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateStashReason(position: PlayerMarketPosition): string {
  if (position.age && position.age <= 22) {
    return 'Young talent with expanding role';
  }

  if (position.usageTrend > 0.4) {
    return 'Opportunity growing, stash before breakout';
  }

  return 'Market undervaluing long-term upside';
}

function getStashFactors(position: PlayerMarketPosition): string[] {
  const factors: string[] = [];

  if (position.age) {
    factors.push(`Young player (age ${position.age})`);
  }

  factors.push(`Usage trending upward (+${(position.usageTrend * 100).toFixed(0)}%)`);

  if (position.rankDelta) {
    factors.push(`Market underranking by ${position.rankDelta} spots`);
  }

  if (position.modelValue > 2000) {
    factors.push('Significant upside potential');
  }

  return factors;
}

/**
 * Detect avoid/trap player
 *
 * Criteria:
 * - market_value - model_value > 900 (overvalued)
 * - usage declining (usage_trend < -0.2)
 */
export function detectAvoid(position: PlayerMarketPosition): AdviceRecommendation | null {
  const MIN_OVERVALUE = -900;

  if (position.valueDelta > MIN_OVERVALUE) {
    return null;
  }

  if (position.usageTrend >= -0.1) {
    return null; // Want declining usage for avoid
  }

  const confidence = calculateAvoidConfidence(position);

  if (confidence < 50) {
    return null;
  }

  const reason = generateAvoidReason(position);
  const supportingFactors = getAvoidFactors(position);
  const score = Math.abs(position.valueDelta) + Math.abs(position.usageTrend * 500);

  return {
    adviceType: 'avoid',
    confidence,
    score,
    reason,
    supportingFactors,
  };
}

function calculateAvoidConfidence(position: PlayerMarketPosition): number {
  let confidence = 50;

  confidence += Math.min(25, Math.abs(position.valueDelta) / 50);

  if (position.usageTrend < -0.3) {
    confidence += 15;
  }

  if (position.age && position.age >= 29 && position.position === 'RB') {
    confidence += 10; // RB age cliff
  }

  confidence *= position.dataQuality / 100;

  return Math.min(95, Math.round(confidence));
}

function generateAvoidReason(position: PlayerMarketPosition): string {
  if (position.age && position.age >= 30 && position.position === 'RB') {
    return 'Age cliff imminent, market hasn\'t adjusted';
  }

  if (position.usageTrend < -0.4) {
    return 'Declining usage, market overvaluing past production';
  }

  if (position.recentChange7d > 300) {
    return 'Recent spike masking underlying decline';
  }

  return 'Market inflated relative to projected production';
}

function getAvoidFactors(position: PlayerMarketPosition): string[] {
  const factors: string[] = [];

  factors.push(`Market overvaluing by ${Math.abs(position.valueDelta)} points`);

  if (position.usageTrend < 0) {
    factors.push(`Usage declining (${(position.usageTrend * 100).toFixed(0)}%)`);
  }

  if (position.age && position.age >= 28) {
    factors.push(`Aging player (age ${position.age})`);
  }

  if (position.rankDelta && position.rankDelta < -10) {
    factors.push('Model projecting significant decline');
  }

  return factors;
}

/**
 * Detect all applicable advice types for a player
 *
 * Returns sorted by confidence (highest first)
 */
export function detectAllAdvice(
  position: PlayerMarketPosition,
  replacementLevel: number
): AdviceRecommendation[] {
  const recommendations: AdviceRecommendation[] = [];

  const buyLow = detectBuyLow(position);
  if (buyLow) recommendations.push(buyLow);

  const sellHigh = detectSellHigh(position);
  if (sellHigh) recommendations.push(sellHigh);

  const breakout = detectBreakout(position);
  if (breakout) recommendations.push(breakout);

  const waiver = detectWaiverTarget(position, replacementLevel);
  if (waiver) recommendations.push(waiver);

  const stash = detectStash(position);
  if (stash) recommendations.push(stash);

  const avoid = detectAvoid(position);
  if (avoid) recommendations.push(avoid);

  // Sort by confidence descending
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return recommendations;
}
