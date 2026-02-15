/**
 * Trade Fairness Evaluation Engine
 *
 * Evaluates structural balance beyond raw value totals.
 * Detects: tier breaks, positional imbalance, consolidation abuse, pick overpays.
 *
 * IMPORTANT: Does NOT modify displayed values, only evaluates structure.
 */

export interface TradeAsset {
  player_id?: string;
  player_name: string;
  position: string;
  value: number;
  tier?: number;
  is_pick?: boolean;
  pick_round?: number;
  pick_position?: 'early' | 'mid' | 'late';
}

export interface TradeEvaluationResult {
  teamA_value: number;
  teamB_value: number;
  teamA_adjusted_value: number;
  teamB_adjusted_value: number;
  diff: number;
  fairness_score: number; // 0-100
  flags: FairnessFlag[];
  recommendation: 'fair' | 'lean_a' | 'lean_b' | 'risky' | 'unfair';
  warnings: string[];
  tier_analysis: TierAnalysis;
  positional_analysis: PositionalAnalysis;
}

export interface FairnessFlag {
  type: 'ELITE_PLAYER_SPLIT' | 'PACKAGE_FOR_STAR' | 'POSITIONAL_IMBALANCE' |
        'TIER_MISMATCH' | 'PICK_OVERPAY' | 'CONSOLIDATION_ABUSE' | 'SCARCITY_VIOLATION';
  severity: 'low' | 'medium' | 'high' | 'critical';
  penalty: number;
  message: string;
  details?: any;
}

export interface TierAnalysis {
  teamA_tiers: Record<number, number>; // tier -> count
  teamB_tiers: Record<number, number>;
  tier_disparity: number;
  elite_split: boolean;
}

export interface PositionalAnalysis {
  teamA_positions: Record<string, number>; // position -> count
  teamB_positions: Record<string, number>;
  positional_imbalance: number;
  scarcity_violation: boolean;
}

/**
 * Positional scarcity weights (applied to fairness calc only, not display)
 */
const POSITIONAL_WEIGHTS: Record<string, number> = {
  QB: 1.25,  // Superflex premium
  RB: 1.10,  // Scarcity premium
  WR: 1.00,  // Baseline
  TE: 1.15,  // Positional scarcity
  DL: 0.70,  // IDP discount
  LB: 0.70,
  DB: 0.70,
  PICK: 1.00,
};

/**
 * Pick baseline values
 */
const PICK_BASELINES: Record<string, number> = {
  'early_1': 8500,
  'mid_1': 7000,
  'late_1': 5800,
  'early_2': 4200,
  'mid_2': 3500,
  'late_2': 3000,
  'early_3': 2000,
  'mid_3': 1500,
  'late_3': 1000,
};

/**
 * Season phase multipliers for picks
 */
const PICK_PHASE_MULTIPLIERS: Record<string, number> = {
  'preseason': 1.0,
  'regular_season': 0.95,
  'playoffs': 0.85,  // 15% discount during postseason
  'offseason': 1.0,
};

/**
 * Main evaluation function
 */
export function evaluateTrade(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[],
  format: 'dynasty' | 'redraft' = 'dynasty',
  options: {
    isSuperflex?: boolean;
    currentPhase?: 'preseason' | 'regular_season' | 'playoffs' | 'offseason';
  } = {}
): TradeEvaluationResult {
  const { isSuperflex = false, currentPhase = 'regular_season' } = options;

  // Calculate raw totals
  const teamA_value = teamAAssets.reduce((sum, a) => sum + a.value, 0);
  const teamB_value = teamBAssets.reduce((sum, a) => sum + a.value, 0);
  const diff = Math.abs(teamA_value - teamB_value);

  // Apply positional weights for adjusted values
  const teamA_adjusted = calculateAdjustedValue(teamAAssets, isSuperflex, currentPhase);
  const teamB_adjusted = calculateAdjustedValue(teamBAssets, isSuperflex, currentPhase);

  // Start fairness score at 100
  let fairness_score = 100;
  const flags: FairnessFlag[] = [];
  const warnings: string[] = [];

  // 1. Tier analysis
  const tier_analysis = analyzeTiers(teamAAssets, teamBAssets);
  const { tierFlags, tierPenalty } = evaluateTierBreaks(tier_analysis);
  flags.push(...tierFlags);
  fairness_score -= tierPenalty;

  // 2. Package-for-star detection
  const packageFlags = detectPackageForStar(teamAAssets, teamBAssets);
  flags.push(...packageFlags);
  fairness_score -= packageFlags.reduce((sum, f) => sum + f.penalty, 0);

  // 3. Positional analysis
  const positional_analysis = analyzePositions(teamAAssets, teamBAssets);
  const { positionalFlags, positionalPenalty } = evaluatePositionalBalance(
    positional_analysis,
    teamA_adjusted,
    teamB_adjusted
  );
  flags.push(...positionalFlags);
  fairness_score -= positionalPenalty;

  // 4. Pick protection
  const pickFlags = evaluatePickTrades(teamAAssets, teamBAssets, currentPhase);
  flags.push(...pickFlags);
  fairness_score -= pickFlags.reduce((sum, f) => sum + f.penalty, 0);

  // 5. Raw value disparity penalty
  const valueDisparityPenalty = calculateValueDisparityPenalty(teamA_value, teamB_value);
  fairness_score -= valueDisparityPenalty;
  if (valueDisparityPenalty > 0) {
    flags.push({
      type: 'CONSOLIDATION_ABUSE',
      severity: valueDisparityPenalty > 15 ? 'high' : 'medium',
      penalty: valueDisparityPenalty,
      message: `Value gap: ${diff} points (${((diff / Math.max(teamA_value, teamB_value)) * 100).toFixed(1)}%)`,
    });
  }

  // Clamp fairness score to 0-100
  fairness_score = Math.max(0, Math.min(100, fairness_score));

  // Determine recommendation
  const recommendation = determineRecommendation(fairness_score, flags);

  // Generate warnings
  if (tier_analysis.elite_split) {
    warnings.push('⚠️ Elite player given up without elite return');
  }
  if (packageFlags.length > 0) {
    warnings.push('⚠️ Consolidation trade detected - verify package value');
  }
  if (positional_analysis.scarcity_violation) {
    warnings.push('⚠️ Positional scarcity imbalance detected');
  }
  if (fairness_score < 75) {
    warnings.push('⚠️ Structural concerns detected - review carefully');
  }

  return {
    teamA_value,
    teamB_value,
    teamA_adjusted_value: teamA_adjusted,
    teamB_adjusted_value: teamB_adjusted,
    diff,
    fairness_score,
    flags,
    recommendation,
    warnings,
    tier_analysis,
    positional_analysis,
  };
}

/**
 * Calculate adjusted value with positional weights
 */
function calculateAdjustedValue(
  assets: TradeAsset[],
  isSuperflex: boolean,
  currentPhase: string
): number {
  return assets.reduce((sum, asset) => {
    let adjustedValue = asset.value;

    // Apply positional weight
    const weight = POSITIONAL_WEIGHTS[asset.position] || 1.0;

    // QB gets extra weight in superflex
    const qbBonus = isSuperflex && asset.position === 'QB' ? 1.15 : 1.0;

    adjustedValue *= (weight * qbBonus);

    // Apply pick phase discount
    if (asset.is_pick) {
      const phaseMultiplier = PICK_PHASE_MULTIPLIERS[currentPhase] || 1.0;
      adjustedValue *= phaseMultiplier;
    }

    return sum + adjustedValue;
  }, 0);
}

/**
 * Analyze tier distribution
 */
function analyzeTiers(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[]
): TierAnalysis {
  const teamA_tiers: Record<number, number> = {};
  const teamB_tiers: Record<number, number> = {};

  // Count tiers for team A
  for (const asset of teamAAssets) {
    if (asset.tier && !asset.is_pick) {
      teamA_tiers[asset.tier] = (teamA_tiers[asset.tier] || 0) + 1;
    }
  }

  // Count tiers for team B
  for (const asset of teamBAssets) {
    if (asset.tier && !asset.is_pick) {
      teamB_tiers[asset.tier] = (teamB_tiers[asset.tier] || 0) + 1;
    }
  }

  // Check for elite split
  const teamA_tier1 = teamA_tiers[1] || 0;
  const teamB_tier1 = teamB_tiers[1] || 0;
  const elite_split = (teamA_tier1 > 0 && teamB_tier1 === 0) ||
                      (teamB_tier1 > 0 && teamA_tier1 === 0);

  // Calculate tier disparity
  const tier_disparity = Math.abs(teamA_tier1 - teamB_tier1);

  return {
    teamA_tiers,
    teamB_tiers,
    tier_disparity,
    elite_split,
  };
}

/**
 * Evaluate tier breaks and create flags
 */
function evaluateTierBreaks(
  analysis: TierAnalysis
): { tierFlags: FairnessFlag[]; tierPenalty: number } {
  const flags: FairnessFlag[] = [];
  let penalty = 0;

  const teamA_tier1 = analysis.teamA_tiers[1] || 0;
  const teamB_tier1 = analysis.teamB_tiers[1] || 0;
  const teamA_tier4 = analysis.teamA_tiers[4] || 0;
  const teamB_tier4 = analysis.teamB_tiers[4] || 0;

  // Elite player split (one side gives Tier 1, other doesn't)
  if (analysis.elite_split) {
    flags.push({
      type: 'ELITE_PLAYER_SPLIT',
      severity: 'critical',
      penalty: 15,
      message: 'Elite player (Tier 1) given up without elite return',
      details: {
        teamA_tier1,
        teamB_tier1,
      },
    });
    penalty += 15;
  }

  // Tier 1 for multiple Tier 4s
  if ((teamA_tier1 > 0 && teamB_tier4 >= 3) || (teamB_tier1 > 0 && teamA_tier4 >= 3)) {
    flags.push({
      type: 'TIER_MISMATCH',
      severity: 'critical',
      penalty: 25,
      message: 'Elite player traded for 3+ depth pieces - severe tier mismatch',
      details: {
        elite_side: teamA_tier1 > 0 ? 'Team A' : 'Team B',
        depth_count: Math.max(teamA_tier4, teamB_tier4),
      },
    });
    penalty += 25;
  }

  // Large tier disparity
  if (analysis.tier_disparity >= 2) {
    flags.push({
      type: 'TIER_MISMATCH',
      severity: 'high',
      penalty: 10,
      message: `Large tier disparity: ${analysis.tier_disparity} elite players unmatched`,
    });
    penalty += 10;
  }

  return { tierFlags: flags, tierPenalty: penalty };
}

/**
 * Detect package-for-star trades (5 for 1 abuse)
 */
function detectPackageForStar(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[]
): FairnessFlag[] {
  const flags: FairnessFlag[] = [];

  // Check both directions
  const scenarios = [
    { many: teamAAssets, few: teamBAssets, manyLabel: 'Team A', fewLabel: 'Team B' },
    { many: teamBAssets, few: teamAAssets, manyLabel: 'Team B', fewLabel: 'Team A' },
  ];

  for (const scenario of scenarios) {
    const manyCount = scenario.many.length;
    const fewCount = scenario.few.length;

    if (manyCount >= 4 && fewCount === 1) {
      const packageValue = scenario.many.reduce((sum, a) => sum + a.value, 0);
      const starValue = scenario.few[0].value;
      const ratio = packageValue / starValue;

      // Package must be worth 165%+ of star to be fair
      if (ratio < 1.65) {
        const shortfall = ((1.65 - ratio) * 100).toFixed(0);
        flags.push({
          type: 'PACKAGE_FOR_STAR',
          severity: ratio < 1.3 ? 'critical' : 'high',
          penalty: 20,
          message: `${scenario.manyLabel} giving ${manyCount} assets for 1 star - package ${shortfall}% short of fair value`,
          details: {
            package_count: manyCount,
            package_value: packageValue,
            star_value: starValue,
            ratio,
          },
        });
      }
    }
  }

  return flags;
}

/**
 * Analyze positional distribution
 */
function analyzePositions(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[]
): PositionalAnalysis {
  const teamA_positions: Record<string, number> = {};
  const teamB_positions: Record<string, number> = {};

  // Count positions for team A
  for (const asset of teamAAssets) {
    if (!asset.is_pick) {
      teamA_positions[asset.position] = (teamA_positions[asset.position] || 0) + 1;
    }
  }

  // Count positions for team B
  for (const asset of teamBAssets) {
    if (!asset.is_pick) {
      teamB_positions[asset.position] = (teamB_positions[asset.position] || 0) + 1;
    }
  }

  // Check for scarcity violation (giving away scarce position without return)
  const scarcePositions = ['QB', 'RB', 'TE'];
  let scarcity_violation = false;

  for (const pos of scarcePositions) {
    const teamA_count = teamA_positions[pos] || 0;
    const teamB_count = teamB_positions[pos] || 0;

    // If one side gives 2+ scarce position, other gives 0
    if ((teamA_count >= 2 && teamB_count === 0) || (teamB_count >= 2 && teamA_count === 0)) {
      scarcity_violation = true;
      break;
    }
  }

  // Calculate positional imbalance score
  const positional_imbalance = calculatePositionalImbalance(teamA_positions, teamB_positions);

  return {
    teamA_positions,
    teamB_positions,
    positional_imbalance,
    scarcity_violation,
  };
}

/**
 * Calculate positional imbalance (0-100, higher = worse)
 */
function calculatePositionalImbalance(
  teamA_positions: Record<string, number>,
  teamB_positions: Record<string, number>
): number {
  const positions = new Set([...Object.keys(teamA_positions), ...Object.keys(teamB_positions)]);
  let totalImbalance = 0;

  for (const pos of positions) {
    const countA = teamA_positions[pos] || 0;
    const countB = teamB_positions[pos] || 0;
    const imbalance = Math.abs(countA - countB);
    const weight = POSITIONAL_WEIGHTS[pos] || 1.0;

    totalImbalance += imbalance * weight;
  }

  return totalImbalance;
}

/**
 * Evaluate positional balance
 */
function evaluatePositionalBalance(
  analysis: PositionalAnalysis,
  teamA_adjusted: number,
  teamB_adjusted: number
): { positionalFlags: FairnessFlag[]; positionalPenalty: number } {
  const flags: FairnessFlag[] = [];
  let penalty = 0;

  // Scarcity violation
  if (analysis.scarcity_violation) {
    flags.push({
      type: 'SCARCITY_VIOLATION',
      severity: 'high',
      penalty: 12,
      message: 'Scarce position (QB/RB/TE) given up without positional return',
      details: analysis,
    });
    penalty += 12;
  }

  // Positional imbalance penalty (scaled)
  if (analysis.positional_imbalance > 5) {
    const imbalancePenalty = Math.min(15, Math.floor(analysis.positional_imbalance / 2));
    flags.push({
      type: 'POSITIONAL_IMBALANCE',
      severity: imbalancePenalty > 10 ? 'high' : 'medium',
      penalty: imbalancePenalty,
      message: `Significant positional imbalance detected (score: ${analysis.positional_imbalance.toFixed(1)})`,
    });
    penalty += imbalancePenalty;
  }

  return { positionalFlags: flags, positionalPenalty: penalty };
}

/**
 * Evaluate pick trades
 */
function evaluatePickTrades(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[],
  currentPhase: string
): FairnessFlag[] {
  const flags: FairnessFlag[] = [];

  const teamA_picks = teamAAssets.filter(a => a.is_pick);
  const teamB_picks = teamBAssets.filter(a => a.is_pick);
  const teamA_players = teamAAssets.filter(a => !a.is_pick);
  const teamB_players = teamBAssets.filter(a => !a.is_pick);

  // Picks can't outweigh proven elite without +20% premium
  const scenarios = [
    { picks: teamA_picks, players: teamB_players, pickLabel: 'Team A', playerLabel: 'Team B' },
    { picks: teamB_picks, players: teamA_players, pickLabel: 'Team B', playerLabel: 'Team A' },
  ];

  for (const scenario of scenarios) {
    if (scenario.picks.length > 0 && scenario.players.length > 0) {
      const pickValue = scenario.picks.reduce((sum, p) => sum + p.value, 0);
      const playerValue = scenario.players.reduce((sum, p) => sum + p.value, 0);

      // Check if picks dominate (>60% of total)
      const totalValue = pickValue + playerValue;
      const pickRatio = pickValue / totalValue;

      if (pickRatio > 0.6) {
        // Picks dominate - check if they have 20%+ premium
        const ratio = pickValue / playerValue;
        if (ratio < 1.2) {
          flags.push({
            type: 'PICK_OVERPAY',
            severity: 'medium',
            penalty: 8,
            message: `${scenario.pickLabel} giving mostly picks without sufficient premium over proven players`,
            details: {
              pick_value: pickValue,
              player_value: playerValue,
              ratio,
            },
          });
        }
      }

      // Playoff phase discount warning
      if (currentPhase === 'playoffs' && scenario.picks.length >= 2) {
        flags.push({
          type: 'PICK_OVERPAY',
          severity: 'low',
          penalty: 3,
          message: 'Note: Rookie picks discounted 15% during playoffs (uncertainty)',
        });
      }
    }
  }

  return flags;
}

/**
 * Calculate value disparity penalty
 */
function calculateValueDisparityPenalty(
  teamA_value: number,
  teamB_value: number
): number {
  const diff = Math.abs(teamA_value - teamB_value);
  const maxValue = Math.max(teamA_value, teamB_value);
  const percentDiff = (diff / maxValue) * 100;

  // Progressive penalty for value gaps
  if (percentDiff > 30) return 20;  // 30%+ gap
  if (percentDiff > 20) return 15;  // 20-30% gap
  if (percentDiff > 15) return 10;  // 15-20% gap
  if (percentDiff > 10) return 5;   // 10-15% gap

  return 0;
}

/**
 * Determine recommendation based on score and flags
 */
function determineRecommendation(
  fairness_score: number,
  flags: FairnessFlag[]
): 'fair' | 'lean_a' | 'lean_b' | 'risky' | 'unfair' {
  const criticalFlags = flags.filter(f => f.severity === 'critical').length;

  if (criticalFlags >= 2 || fairness_score < 60) return 'unfair';
  if (fairness_score < 75) return 'risky';
  if (fairness_score < 90) {
    // Determine which side is favored by flags
    return 'lean_a'; // Could be refined to detect actual lean
  }
  return 'fair';
}

/**
 * Get pick value from baseline table
 */
export function getPickBaselineValue(
  round: number,
  position: 'early' | 'mid' | 'late'
): number {
  const key = `${position}_${round}`;
  return PICK_BASELINES[key] || 1000;
}
