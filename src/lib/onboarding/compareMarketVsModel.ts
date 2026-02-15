/**
 * Market vs Model Comparison
 *
 * Explains WHY our valuations differ from market consensus.
 * This builds trust by showing league-specific reasoning.
 *
 * Example:
 * "We value Garrett Wilson higher because your league starts 3 WR
 * and rewards target volume. Scarcity adjustment: +450 points."
 */

import { supabase } from '../supabase';

export interface MarketComparison {
  playerId: string;
  playerName: string;
  position: string;
  ourValue: number;
  marketValue: number;
  difference: number;
  percentDiff: number;
  direction: 'higher' | 'lower' | 'same';
  reasons: ComparisonReason[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ComparisonReason {
  factor: string;
  impact: number;
  explanation: string;
  category: 'league_settings' | 'scarcity' | 'production' | 'context' | 'market_inefficiency';
}

/**
 * Compare our value vs market consensus for a player
 */
export async function comparePlayerValue(
  playerId: string,
  leagueId?: string
): Promise<MarketComparison | null> {
  // Get player value
  const { data: playerValue, error } = await supabase
    .from('player_values')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle();

  if (error || !playerValue) {
    console.error('Error fetching player value:', error);
    return null;
  }

  const ourValue = playerValue.fdp_value || 0;
  const marketValue = playerValue.ktc_value || ourValue; // Use KTC as market proxy

  const difference = ourValue - marketValue;
  const percentDiff = marketValue > 0 ? (difference / marketValue) * 100 : 0;

  let direction: 'higher' | 'lower' | 'same' = 'same';
  if (Math.abs(percentDiff) > 5) {
    direction = difference > 0 ? 'higher' : 'lower';
  }

  // Generate reasons
  const reasons = await generateReasons(playerId, playerValue, leagueId, difference);

  // Calculate confidence based on data completeness
  const confidence = calculateConfidence(playerValue, reasons);

  return {
    playerId,
    playerName: playerValue.full_name,
    position: playerValue.position,
    ourValue,
    marketValue,
    difference,
    percentDiff,
    direction,
    reasons,
    confidence,
  };
}

/**
 * Generate reasons for value difference
 */
async function generateReasons(
  playerId: string,
  playerValue: any,
  leagueId: string | undefined,
  difference: number
): Promise<ComparisonReason[]> {
  const reasons: ComparisonReason[] = [];

  // 1. League Settings Impact
  if (leagueId) {
    const leagueReason = await getLeagueSettingsReason(playerId, playerValue.position, leagueId);
    if (leagueReason) {
      reasons.push(leagueReason);
    }
  }

  // 2. Scarcity Adjustment
  const scarcityReason = getScarcityReason(playerValue);
  if (scarcityReason) {
    reasons.push(scarcityReason);
  }

  // 3. Production Context (RB specific)
  if (playerValue.position === 'RB') {
    const rbReason = getRBContextReason(playerValue);
    if (rbReason) {
      reasons.push(rbReason);
    }
  }

  // 4. Age/Career Stage
  const ageReason = getAgeReason(playerValue);
  if (ageReason) {
    reasons.push(ageReason);
  }

  // 5. Market Inefficiency
  if (Math.abs(difference) > 500) {
    const marketReason = getMarketInefficiencyReason(playerValue, difference);
    if (marketReason) {
      reasons.push(marketReason);
    }
  }

  return reasons;
}

/**
 * Get league-specific settings reason
 */
async function getLeagueSettingsReason(
  playerId: string,
  position: string,
  leagueId: string
): Promise<ComparisonReason | null> {
  // Get league profile
  const { data: league } = await supabase
    .from('leagues')
    .select('league_profile_id')
    .eq('id', leagueId)
    .maybeSingle();

  if (!league || !league.league_profile_id) {
    return null;
  }

  const { data: profile } = await supabase
    .from('league_profiles')
    .select('*')
    .eq('id', league.league_profile_id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  // Check roster requirements
  const rosterSettings = profile.roster_settings || {};
  let explanation = '';
  let impact = 0;

  if (position === 'WR') {
    const wrSlots = rosterSettings.wr_slots || 2;
    if (wrSlots >= 3) {
      explanation = `Your league starts ${wrSlots} WR (higher than standard 2), increasing WR scarcity`;
      impact = 200;
    }
  }

  if (position === 'RB') {
    const rbSlots = rosterSettings.rb_slots || 2;
    const flexSlots = rosterSettings.flex_slots || 1;
    const totalRbNeeded = rbSlots + flexSlots;
    if (totalRbNeeded >= 4) {
      explanation = `Your league requires ${totalRbNeeded} RB/FLEX spots, creating RB premium`;
      impact = 300;
    }
  }

  if (position === 'TE') {
    const teSlots = rosterSettings.te_slots || 1;
    const tePremium = profile.scoring_multipliers?.te_premium || 1.0;
    if (tePremium > 1.0) {
      explanation = `Your league uses ${tePremium}x TE premium scoring`;
      impact = Math.round((tePremium - 1.0) * 500);
    } else if (teSlots >= 2) {
      explanation = `Your league starts ${teSlots} TE, increasing elite TE value`;
      impact = 400;
    }
  }

  if (!explanation) {
    return null;
  }

  return {
    factor: 'League Settings',
    impact,
    explanation,
    category: 'league_settings',
  };
}

/**
 * Get scarcity adjustment reason
 */
function getScarcityReason(playerValue: any): ComparisonReason | null {
  const scarcityAdj = playerValue.scarcity_adjustment || 0;

  if (Math.abs(scarcityAdj) < 100) {
    return null;
  }

  const position = playerValue.position;
  const positionLabels: Record<string, string> = {
    QB: 'quarterback',
    RB: 'running back',
    WR: 'wide receiver',
    TE: 'tight end',
  };

  const posLabel = positionLabels[position] || position;

  let explanation = '';
  if (scarcityAdj > 0) {
    explanation = `Elite ${posLabel} scarcity premium (top-tier production is rare)`;
  } else {
    explanation = `Replacement-level ${posLabel} discount (similar options widely available)`;
  }

  return {
    factor: 'Position Scarcity',
    impact: Math.round(scarcityAdj),
    explanation,
    category: 'scarcity',
  };
}

/**
 * Get RB context reason
 */
function getRBContextReason(playerValue: any): ComparisonReason | null {
  const rbContext = playerValue.rb_context;

  if (!rbContext || rbContext === 'Unknown') {
    return null;
  }

  const contextImpact: Record<string, { impact: number; explanation: string }> = {
    'Bellcow (85%+ snaps)': {
      impact: 400,
      explanation: 'Bellcow workload (85%+ snaps) provides stable floor and ceiling',
    },
    'Primary (65-84% snaps)': {
      impact: 200,
      explanation: 'Primary role (65-84% snaps) with upside if usage increases',
    },
    'Committee (40-64% snaps)': {
      impact: -100,
      explanation: 'Committee role (40-64% snaps) limits weekly ceiling',
    },
    'Backup (<40% snaps)': {
      impact: -300,
      explanation: 'Backup role (<40% snaps) — value tied to injury opportunity',
    },
  };

  const info = contextImpact[rbContext];
  if (!info) {
    return null;
  }

  return {
    factor: 'RB Role Context',
    impact: info.impact,
    explanation: info.explanation,
    category: 'context',
  };
}

/**
 * Get age/career stage reason
 */
function getAgeReason(playerValue: any): ComparisonReason | null {
  const age = playerValue.age;

  if (!age) {
    return null;
  }

  const position = playerValue.position;

  // Age curves by position
  const ageCurves: Record<string, { peak: [number, number]; decline: number }> = {
    QB: { peak: [25, 35], decline: 36 },
    RB: { peak: [23, 26], decline: 28 },
    WR: { peak: [24, 28], decline: 30 },
    TE: { peak: [25, 29], decline: 31 },
  };

  const curve = ageCurves[position];
  if (!curve) {
    return null;
  }

  const [peakStart, peakEnd] = curve.peak;

  if (age >= peakStart && age <= peakEnd) {
    return {
      factor: 'Age Profile',
      impact: 100,
      explanation: `Age ${age} is peak window for ${position} (typically ${peakStart}-${peakEnd})`,
      category: 'production',
    };
  }

  if (age > curve.decline) {
    const yearsOver = age - curve.decline;
    return {
      factor: 'Age Profile',
      impact: -100 * yearsOver,
      explanation: `Age ${age} is past typical ${position} decline age (${curve.decline})`,
      category: 'production',
    };
  }

  if (age < peakStart) {
    return {
      factor: 'Age Profile',
      impact: 150,
      explanation: `Age ${age} — entering prime years with upside potential`,
      category: 'production',
    };
  }

  return null;
}

/**
 * Get market inefficiency reason
 */
function getMarketInefficiencyReason(
  playerValue: any,
  difference: number
): ComparisonReason | null {
  if (difference > 500) {
    return {
      factor: 'Market Inefficiency',
      impact: Math.round(difference * 0.5), // Attribute half to market lag
      explanation: 'Market consensus has not yet adjusted to recent production or role change',
      category: 'market_inefficiency',
    };
  }

  if (difference < -500) {
    return {
      factor: 'Market Inefficiency',
      impact: Math.round(difference * 0.5),
      explanation: 'Market may be overvaluing based on name recognition rather than production',
      category: 'market_inefficiency',
    };
  }

  return null;
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
  playerValue: any,
  reasons: ComparisonReason[]
): 'low' | 'medium' | 'high' {
  let score = 0;

  // Data completeness
  if (playerValue.fdp_value > 0) score += 1;
  if (playerValue.ktc_value > 0) score += 1;
  if (playerValue.age) score += 1;
  if (playerValue.position) score += 1;

  // Reason quality
  if (reasons.length >= 3) score += 2;
  else if (reasons.length >= 2) score += 1;

  // League-specific data
  const hasLeagueReason = reasons.some((r) => r.category === 'league_settings');
  if (hasLeagueReason) score += 2;

  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Get comparison summary text
 */
export function getComparisonSummary(comparison: MarketComparison): string {
  if (comparison.direction === 'same') {
    return `We value ${comparison.playerName} similarly to market consensus.`;
  }

  const dir = comparison.direction === 'higher' ? 'higher' : 'lower';
  const amount = Math.abs(comparison.difference);
  const pct = Math.abs(comparison.percentDiff).toFixed(0);

  const topReason = comparison.reasons[0];
  const reasonText = topReason ? ` — ${topReason.explanation}` : '';

  return `We value ${comparison.playerName} ${amount} points ${dir} (${pct}% ${dir}) than market${reasonText}`;
}

/**
 * Get comparison for multiple players (team context)
 */
export async function compareTeamValues(
  playerIds: string[],
  leagueId?: string
): Promise<MarketComparison[]> {
  const comparisons: MarketComparison[] = [];

  for (const playerId of playerIds) {
    const comparison = await comparePlayerValue(playerId, leagueId);
    if (comparison && comparison.direction !== 'same') {
      comparisons.push(comparison);
    }
  }

  // Sort by absolute difference
  comparisons.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return comparisons.slice(0, 5); // Top 5
}
