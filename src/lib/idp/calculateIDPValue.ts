import { getIDPMultiplier, isIDPPosition, type IDPPosition, type IDPFormat, type ScoringStyle } from './idpMultipliers';
import { calculateIDPAdjustments, clampIDPValue } from './idpAdjustments';

export interface IDPPlayer {
  player_id: string;
  full_name: string;
  position: IDPPosition;
  sub_position?: string;
  team?: string;
  age?: number;
  base_value: number;
}

export interface IDPValueCalculation {
  player_id: string;
  base_value: number;
  format_multiplier: number;
  scoring_style_multiplier: number;
  total_multiplier: number;
  idp_adjustments: number;
  fdp_value: number;
  breakdown: Array<{
    factor: string;
    adjustment: number;
    description: string;
  }>;
}

export function calculateIDPValue(
  player: IDPPlayer,
  format: IDPFormat = 'dynasty_sf_idp',
  scoringStyle: ScoringStyle = 'balanced',
  teamDefenseRank?: number,
  snapSharePercent?: number
): IDPValueCalculation {
  if (!isIDPPosition(player.position)) {
    throw new Error(`Position ${player.position} is not a valid IDP position`);
  }

  const totalMultiplier = getIDPMultiplier(player.position, format, scoringStyle);

  const adjustmentResult = calculateIDPAdjustments(
    player.position,
    player.sub_position,
    player.age,
    teamDefenseRank,
    snapSharePercent
  );

  const baseAdjusted = player.base_value * totalMultiplier;
  const withAdjustments = baseAdjusted + adjustmentResult.total;
  const fdpValue = clampIDPValue(withAdjustments);

  return {
    player_id: player.player_id,
    base_value: player.base_value,
    format_multiplier: totalMultiplier,
    scoring_style_multiplier: 1.0,
    total_multiplier: totalMultiplier,
    idp_adjustments: adjustmentResult.total,
    fdp_value,
    breakdown: adjustmentResult.breakdown,
  };
}

export function calculateBulkIDPValues(
  players: IDPPlayer[],
  format: IDPFormat = 'dynasty_sf_idp',
  scoringStyle: ScoringStyle = 'balanced'
): IDPValueCalculation[] {
  return players.map(player => calculateIDPValue(player, format, scoringStyle));
}

export function compareIDPValues(
  playerA: IDPPlayer,
  playerB: IDPPlayer,
  format: IDPFormat = 'dynasty_sf_idp',
  scoringStyle: ScoringStyle = 'balanced'
): {
  playerA: IDPValueCalculation;
  playerB: IDPValueCalculation;
  difference: number;
  winner: 'A' | 'B' | 'Equal';
} {
  const valueA = calculateIDPValue(playerA, format, scoringStyle);
  const valueB = calculateIDPValue(playerB, format, scoringStyle);
  const difference = valueA.fdp_value - valueB.fdp_value;

  let winner: 'A' | 'B' | 'Equal' = 'Equal';
  if (Math.abs(difference) > 50) {
    winner = difference > 0 ? 'A' : 'B';
  }

  return {
    playerA: valueA,
    playerB: valueB,
    difference: Math.abs(difference),
    winner,
  };
}

export interface IDPTradeEvaluation {
  sideA: IDPPlayer[];
  sideB: IDPPlayer[];
  sideA_total: number;
  sideB_total: number;
  difference: number;
  fairness_percentage: number;
  winner: 'A' | 'B' | 'Fair';
  recommendation: string;
}

export function evaluateIDPTrade(
  sideA: IDPPlayer[],
  sideB: IDPPlayer[],
  format: IDPFormat = 'dynasty_sf_idp',
  scoringStyle: ScoringStyle = 'balanced'
): IDPTradeEvaluation {
  const sideAValues = calculateBulkIDPValues(sideA, format, scoringStyle);
  const sideBValues = calculateBulkIDPValues(sideB, format, scoringStyle);

  const sideA_total = sideAValues.reduce((sum, calc) => sum + calc.fdp_value, 0);
  const sideB_total = sideBValues.reduce((sum, calc) => sum + calc.fdp_value, 0);

  const difference = Math.abs(sideA_total - sideB_total);
  const maxValue = Math.max(sideA_total, sideB_total);
  const fairness_percentage = maxValue > 0
    ? Math.round((Math.min(sideA_total, sideB_total) / maxValue) * 100)
    : 100;

  let winner: 'A' | 'B' | 'Fair' = 'Fair';
  if (difference > 500) {
    winner = sideA_total > sideB_total ? 'A' : 'B';
  } else if (difference > 200) {
    winner = sideA_total > sideB_total ? 'A' : 'B';
  }

  let recommendation = '';
  if (difference < 200) {
    recommendation = 'Fair trade - values are very close';
  } else if (fairness_percentage >= 90) {
    recommendation = 'Fair trade - slight value difference';
  } else if (fairness_percentage >= 75) {
    recommendation = `Side ${winner} wins - consider adding ${difference} value`;
  } else {
    recommendation = `Side ${winner} strongly favored - needs ${difference} more value`;
  }

  return {
    sideA,
    sideB,
    sideA_total,
    sideB_total,
    difference,
    fairness_percentage,
    winner,
    recommendation,
  };
}

export function getIDPValueTier(fdpValue: number): {
  tier: string;
  color: string;
  label: string;
} {
  if (fdpValue >= 4000) {
    return { tier: 'elite', color: '#FFD700', label: 'Elite' };
  }
  if (fdpValue >= 3000) {
    return { tier: 'strong', color: '#00D4FF', label: 'Strong Starter' };
  }
  if (fdpValue >= 2000) {
    return { tier: 'solid', color: '#4ADE80', label: 'Solid Starter' };
  }
  if (fdpValue >= 1000) {
    return { tier: 'flex', color: '#60A5FA', label: 'Flex/Low-End Starter' };
  }
  if (fdpValue >= 500) {
    return { tier: 'depth', color: '#94A3B8', label: 'Depth/Backup' };
  }
  return { tier: 'streamer', color: '#64748B', label: 'Streamer/Waiver' };
}
