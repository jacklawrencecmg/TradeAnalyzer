/**
 * Trade Explanation Engine
 *
 * Generates detailed human-readable explanations for trade evaluations.
 * Explains WHY trades are fair/unfair, not just numbers.
 *
 * This prevents league arguments: "The calculator is wrong!"
 * Now: "Here's exactly why this trade is imbalanced"
 */

import type { ValueReasoning } from './buildValueReasoning';
import { categorizeReason } from './buildValueReasoning';

export interface TradePlayer {
  playerId: string;
  playerName: string;
  position: string;
  value: number;
  rank: number;
  tier?: number;
  reasoning?: ValueReasoning;
}

export interface TradeAnalysis {
  teamAValue: number;
  teamBValue: number;
  valueDifference: number;
  fairnessScore: number; // 0-1, 1 = perfectly fair

  overallAssessment: string;

  teamAAnalysis: string[];
  teamBAnalysis: string[];

  fairnessFactors: string[];
  warnings: string[];
  recommendations: string[];
}

const FAIR_THRESHOLD = 0.10; // 10% value difference = fair
const CONCERNING_THRESHOLD = 0.20; // 20%+ = concerning
const VERY_UNFAIR_THRESHOLD = 0.35; // 35%+ = very unfair

/**
 * Generate comprehensive trade explanation
 *
 * @param teamAPlayers - Players Team A is trading away
 * @param teamBPlayers - Players Team B is trading away
 * @param format - Dynasty or redraft
 * @returns Detailed trade analysis
 */
export function explainTrade(
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[],
  format: 'dynasty' | 'redraft'
): TradeAnalysis {
  const teamAValue = teamAPlayers.reduce((sum, p) => sum + p.value, 0);
  const teamBValue = teamBPlayers.reduce((sum, p) => sum + p.value, 0);
  const valueDifference = Math.abs(teamAValue - teamBValue);
  const avgValue = (teamAValue + teamBValue) / 2;
  const differencePercent = avgValue > 0 ? valueDifference / avgValue : 0;

  const fairnessScore = Math.max(0, 1 - differencePercent);

  // Determine overall assessment
  const overallAssessment = generateOverallAssessment(
    teamAValue,
    teamBValue,
    differencePercent,
    teamAPlayers,
    teamBPlayers
  );

  // Analyze each team
  const teamAAnalysis = analyzeTeamSide(teamAPlayers, teamBPlayers, 'Team A', format);
  const teamBAnalysis = analyzeTeamSide(teamBPlayers, teamAPlayers, 'Team B', format);

  // Generate fairness factors
  const fairnessFactors = generateFairnessFactors(
    teamAPlayers,
    teamBPlayers,
    differencePercent
  );

  // Generate warnings
  const warnings = generateWarnings(teamAPlayers, teamBPlayers, differencePercent);

  // Generate recommendations
  const recommendations = generateRecommendations(
    teamAPlayers,
    teamBPlayers,
    valueDifference,
    teamAValue,
    teamBValue
  );

  return {
    teamAValue,
    teamBValue,
    valueDifference,
    fairnessScore,
    overallAssessment,
    teamAAnalysis,
    teamBAnalysis,
    fairnessFactors,
    warnings,
    recommendations,
  };
}

/**
 * Generate overall assessment
 */
function generateOverallAssessment(
  teamAValue: number,
  teamBValue: number,
  differencePercent: number,
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[]
): string {
  const winner = teamAValue > teamBValue ? 'Team A' : 'Team B';
  const loser = winner === 'Team A' ? 'Team B' : 'Team A';

  if (differencePercent <= FAIR_THRESHOLD) {
    return `Fair trade with balanced value exchange. Both teams receive comparable assets.`;
  }

  if (differencePercent <= CONCERNING_THRESHOLD) {
    return `Slightly favors ${winner} but within reasonable range. ${winner} gains approximately ${Math.round(differencePercent * 100)}% more value.`;
  }

  if (differencePercent <= VERY_UNFAIR_THRESHOLD) {
    return `Significantly favors ${winner}. ${loser} is giving up substantially more value (${Math.round(differencePercent * 100)}% difference).`;
  }

  return `Very lopsided trade strongly favoring ${winner}. ${loser} should reconsider as they're giving up ${Math.round(differencePercent * 100)}% more value.`;
}

/**
 * Analyze one team's side of the trade
 */
function analyzeTeamSide(
  givingPlayers: TradePlayer[],
  receivingPlayers: TradePlayer[],
  teamName: string,
  format: 'dynasty' | 'redraft'
): string[] {
  const analysis: string[] = [];

  // Sort players by value
  const givingSorted = [...givingPlayers].sort((a, b) => b.value - a.value);
  const receivingSorted = [...receivingPlayers].sort((a, b) => b.value - a.value);

  // Best player analysis
  const bestGiving = givingSorted[0];
  const bestReceiving = receivingSorted[0];

  if (bestGiving && bestReceiving) {
    if (bestGiving.value > bestReceiving.value * 1.2) {
      analysis.push(
        `Trading away the best player in the deal (${bestGiving.playerName}, ${bestGiving.value} value)`
      );
    } else if (bestReceiving.value > bestGiving.value * 1.2) {
      analysis.push(
        `Acquiring the best player in the deal (${bestReceiving.playerName}, ${bestReceiving.value} value)`
      );
    }
  }

  // Quantity analysis
  if (givingPlayers.length > receivingPlayers.length + 1) {
    analysis.push(
      `Consolidating ${givingPlayers.length} players into ${receivingPlayers.length} - upgrading quality`
    );
  } else if (receivingPlayers.length > givingPlayers.length + 1) {
    analysis.push(
      `Acquiring ${receivingPlayers.length} players for ${givingPlayers.length} - adding depth`
    );
  }

  // Position analysis
  const givingPositions = countPositions(givingPlayers);
  const receivingPositions = countPositions(receivingPlayers);

  for (const [pos, count] of Object.entries(givingPositions)) {
    const receivingCount = receivingPositions[pos] || 0;
    if (count > receivingCount) {
      analysis.push(`Losing positional advantage at ${pos} (giving ${count}, receiving ${receivingCount})`);
    }
  }

  for (const [pos, count] of Object.entries(receivingPositions)) {
    const givingCount = givingPositions[pos] || 0;
    if (count > givingCount) {
      analysis.push(`Gaining positional strength at ${pos} (giving ${givingCount}, receiving ${count})`);
    }
  }

  // Tier analysis
  const givingElite = givingPlayers.filter((p) => p.rank && p.rank <= 24).length;
  const receivingElite = receivingPlayers.filter((p) => p.rank && p.rank <= 24).length;

  if (givingElite > receivingElite) {
    analysis.push(`Trading down from elite tier (giving ${givingElite} top-24 players, receiving ${receivingElite})`);
  } else if (receivingElite > givingElite) {
    analysis.push(`Trading up to elite tier (giving ${givingElite} top-24 players, receiving ${receivingElite})`);
  }

  // Dynasty-specific analysis
  if (format === 'dynasty') {
    const hasRookies = receivingPlayers.some((p) => p.playerName.includes('2024') || p.playerName.includes('Pick'));
    const tradingRookies = givingPlayers.some((p) => p.playerName.includes('2024') || p.playerName.includes('Pick'));

    if (hasRookies && !tradingRookies) {
      analysis.push('Acquiring draft capital for future flexibility');
    } else if (tradingRookies && !hasRookies) {
      analysis.push('Trading draft picks to compete now');
    }
  }

  return analysis;
}

/**
 * Count players by position
 */
function countPositions(players: TradePlayer[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const player of players) {
    counts[player.position] = (counts[player.position] || 0) + 1;
  }

  return counts;
}

/**
 * Generate fairness factors
 */
function generateFairnessFactors(
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[],
  differencePercent: number
): string[] {
  const factors: string[] = [];

  // Value difference factor
  if (differencePercent <= FAIR_THRESHOLD) {
    factors.push('Value difference within fair range (≤10%)');
  } else if (differencePercent <= CONCERNING_THRESHOLD) {
    factors.push('Value difference notable but acceptable (10-20%)');
  } else {
    factors.push(`Value difference significant (${Math.round(differencePercent * 100)}%)`);
  }

  // Player count factor
  const countDiff = Math.abs(teamAPlayers.length - teamBPlayers.length);
  if (countDiff === 0) {
    factors.push('Equal number of players exchanged');
  } else if (countDiff === 1) {
    factors.push('Slight player count imbalance (acceptable for quality upgrade)');
  } else {
    factors.push(`${countDiff} player difference - ensure depth is considered`);
  }

  // Best player factor
  const allPlayers = [...teamAPlayers, ...teamBPlayers].sort((a, b) => b.value - a.value);
  const bestPlayer = allPlayers[0];

  if (bestPlayer) {
    const bestPlayerTeam = teamAPlayers.includes(bestPlayer) ? 'Team A' : 'Team B';
    const bestPlayerPercent = (bestPlayer.value / (teamAPlayers.reduce((s, p) => s + p.value, 0) + teamBPlayers.reduce((s, p) => s + p.value, 0))) * 100;

    if (bestPlayerPercent > 40) {
      factors.push(`Best player (${bestPlayer.playerName}) represents ${Math.round(bestPlayerPercent)}% of total value - heavily influences fairness`);
    }
  }

  return factors;
}

/**
 * Generate warnings
 */
function generateWarnings(
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[],
  differencePercent: number
): string[] {
  const warnings: string[] = [];

  // Lopsided warning
  if (differencePercent > CONCERNING_THRESHOLD) {
    warnings.push('Significantly imbalanced trade - consider additional compensation');
  }

  // Elite player warning
  const teamAElite = teamAPlayers.filter((p) => p.rank && p.rank <= 12);
  const teamBElite = teamBPlayers.filter((p) => p.rank && p.rank <= 12);

  if (teamAElite.length > 0 && teamBElite.length === 0) {
    warnings.push('Team A trading elite tier player without receiving equivalent back');
  } else if (teamBElite.length > 0 && teamAElite.length === 0) {
    warnings.push('Team B trading elite tier player without receiving equivalent back');
  }

  // Package value warning
  if (teamAPlayers.length >= 3 && teamBPlayers.length === 1) {
    const packageValue = teamAPlayers.reduce((s, p) => s + p.value, 0);
    const singleValue = teamBPlayers[0].value;

    if (packageValue < singleValue * 0.85) {
      warnings.push('Package value does not sufficiently compensate for elite tier drop');
    }
  } else if (teamBPlayers.length >= 3 && teamAPlayers.length === 1) {
    const packageValue = teamBPlayers.reduce((s, p) => s + p.value, 0);
    const singleValue = teamAPlayers[0].value;

    if (packageValue < singleValue * 0.85) {
      warnings.push('Package value does not sufficiently compensate for elite tier drop');
    }
  }

  return warnings;
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[],
  valueDifference: number,
  teamAValue: number,
  teamBValue: number
): string[] {
  const recommendations: string[] = [];

  // Compensation recommendation
  if (valueDifference > 0) {
    const needsCompensation = teamAValue < teamBValue ? 'Team A' : 'Team B';
    const shouldAdd = teamAValue < teamBValue ? 'Team B' : 'Team A';

    if (valueDifference >= 500) {
      recommendations.push(
        `${shouldAdd} should add approximately ${valueDifference} value points to balance the trade`
      );

      // Suggest player tier
      if (valueDifference >= 3000) {
        recommendations.push('Consider adding a starter-level player (Top 50)');
      } else if (valueDifference >= 1500) {
        recommendations.push('Consider adding a flex-worthy player or early draft pick');
      } else if (valueDifference >= 800) {
        recommendations.push('Consider adding a bench player or mid-round pick');
      } else {
        recommendations.push('Consider adding a late-round pick or handcuff');
      }
    }
  }

  // Strategic recommendations
  const teamAElite = teamAPlayers.filter((p) => p.rank && p.rank <= 24).length;
  const teamBElite = teamBPlayers.filter((p) => p.rank && p.rank <= 24).length;

  if (teamAElite > teamBElite && teamAPlayers.length > teamBPlayers.length) {
    recommendations.push('Team A: Consider if quality upgrade justifies losing depth');
  }

  if (teamBElite > teamAElite && teamBPlayers.length > teamAPlayers.length) {
    recommendations.push('Team B: Consider if quality upgrade justifies losing depth');
  }

  return recommendations;
}

/**
 * Generate short trade summary
 *
 * One-line summary for UI.
 */
export function generateTradeSummary(analysis: TradeAnalysis): string {
  const differencePercent = (analysis.valueDifference / ((analysis.teamAValue + analysis.teamBValue) / 2)) * 100;

  if (differencePercent <= FAIR_THRESHOLD * 100) {
    return '✅ Fair trade';
  }

  const winner = analysis.teamAValue > analysis.teamBValue ? 'Team A' : 'Team B';

  if (differencePercent <= CONCERNING_THRESHOLD * 100) {
    return `⚠️ Slightly favors ${winner}`;
  }

  return `❌ Significantly favors ${winner}`;
}
