interface PlayerValue {
  player_id: string;
  full_name: string;
  position: string;
  age: number | null;
  fdp_value: number;
  team: string | null;
}

interface RosterSettings {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
  superflex: number;
  idp_dl?: number;
  idp_lb?: number;
  idp_db?: number;
  idp_flex?: number;
}

interface LeagueSettings {
  total_rosters: number;
  roster_positions: RosterSettings;
  scoring_type?: string;
}

interface TeamStrategy {
  window: 'contend' | 'retool' | 'rebuild';
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  metrics: {
    starter_strength: number;
    future_value: number;
    aging_risk: number;
    depth_score: number;
    positional_scores: Record<string, number>;
    league_percentile: number;
  };
}

interface RosterAnalysis {
  total_value: number;
  starter_value: number;
  bench_value: number;
  young_value: number;
  aging_value: number;
  positional_values: Record<string, number>;
  starter_positions: Record<string, PlayerValue[]>;
}

function getPositionEligibility(position: string): string[] {
  const flexEligible = ['RB', 'WR', 'TE'];
  const idpFlexEligible = ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'];

  const eligible = [position];

  if (flexEligible.includes(position)) {
    eligible.push('FLEX');
  }

  if (['QB', 'RB', 'WR', 'TE'].includes(position)) {
    eligible.push('SUPER_FLEX');
  }

  if (idpFlexEligible.includes(position)) {
    eligible.push('IDP_FLEX');
  }

  return eligible;
}

function selectOptimalStarters(
  players: PlayerValue[],
  settings: RosterSettings
): { starters: PlayerValue[]; bench: PlayerValue[] } {
  const sortedPlayers = [...players].sort((a, b) => b.fdp_value - a.fdp_value);

  const slots: Record<string, number> = {
    QB: settings.qb || 0,
    RB: settings.rb || 0,
    WR: settings.wr || 0,
    TE: settings.te || 0,
    FLEX: settings.flex || 0,
    SUPER_FLEX: settings.superflex || 0,
    DL: settings.idp_dl || 0,
    LB: settings.idp_lb || 0,
    DB: settings.idp_db || 0,
    IDP_FLEX: settings.idp_flex || 0,
  };

  const starters: PlayerValue[] = [];
  const used = new Set<string>();

  for (const [slotType, count] of Object.entries(slots)) {
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      const eligible = sortedPlayers.filter(
        p => !used.has(p.player_id) && getPositionEligibility(p.position).includes(slotType)
      );

      if (eligible.length > 0) {
        const player = eligible[0];
        starters.push(player);
        used.add(player.player_id);
      }
    }
  }

  const bench = sortedPlayers.filter(p => !used.has(p.player_id));

  return { starters, bench };
}

function analyzeRoster(
  roster: PlayerValue[],
  settings: RosterSettings
): RosterAnalysis {
  const { starters, bench } = selectOptimalStarters(roster, settings);

  const total_value = roster.reduce((sum, p) => sum + p.fdp_value, 0);
  const starter_value = starters.reduce((sum, p) => sum + p.fdp_value, 0);
  const bench_value = bench.reduce((sum, p) => sum + p.fdp_value, 0);

  const young_value = roster
    .filter(p => p.age !== null && p.age <= 24)
    .reduce((sum, p) => sum + p.fdp_value, 0);

  const aging_value = roster
    .filter(p => {
      if (p.age === null) return false;
      if (p.position === 'RB') return p.age >= 26;
      return p.age >= 28;
    })
    .reduce((sum, p) => sum + p.fdp_value, 0);

  const positional_values: Record<string, number> = {};
  const starter_positions: Record<string, PlayerValue[]> = {};

  const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];
  positions.forEach(pos => {
    const posPlayers = roster.filter(p => p.position === pos);
    positional_values[pos] = posPlayers.reduce((sum, p) => sum + p.fdp_value, 0);

    const posStarters = starters.filter(p => p.position === pos);
    starter_positions[pos] = posStarters;
  });

  return {
    total_value,
    starter_value,
    bench_value,
    young_value,
    aging_value,
    positional_values,
    starter_positions,
  };
}

function calculateLeaguePercentile(
  starterValue: number,
  allTeamValues: number[]
): number {
  const sorted = [...allTeamValues].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < starterValue).length;
  return (rank / sorted.length) * 100;
}

function determineWindow(
  analysis: RosterAnalysis,
  leaguePercentile: number,
  totalValue: number
): { window: 'contend' | 'retool' | 'rebuild'; confidence: number } {
  const starterRatio = analysis.starter_value / analysis.total_value;
  const youngRatio = analysis.young_value / analysis.total_value;
  const agingRatio = analysis.aging_value / analysis.total_value;

  let window: 'contend' | 'retool' | 'rebuild';
  let confidence = 50;

  if (leaguePercentile >= 70) {
    window = 'contend';
    confidence = 60 + (leaguePercentile - 70) * 1.3;

    if (starterRatio > 0.7) confidence += 10;
    if (agingRatio > 0.3) confidence += 5;
    if (youngRatio < 0.2) confidence += 5;
  } else if (leaguePercentile <= 40) {
    window = 'rebuild';
    confidence = 60 + (40 - leaguePercentile) * 1.5;

    if (youngRatio > 0.4) confidence += 10;
    if (agingRatio < 0.2) confidence += 5;
    if (starterRatio < 0.6) confidence += 5;
  } else {
    window = 'retool';
    confidence = 50 + Math.abs(55 - leaguePercentile) * 0.5;

    if (youngRatio > 0.25 && youngRatio < 0.45) confidence += 10;
    if (starterRatio >= 0.6 && starterRatio <= 0.75) confidence += 5;
  }

  confidence = Math.min(95, Math.max(50, confidence));

  return { window, confidence };
}

function detectStrengthsWeaknesses(
  analysis: RosterAnalysis,
  allTeamAnalyses: RosterAnalysis[]
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];

  positions.forEach(pos => {
    const myValue = analysis.positional_values[pos] || 0;
    if (myValue === 0) return;

    const allValues = allTeamAnalyses
      .map(a => a.positional_values[pos] || 0)
      .filter(v => v > 0);

    if (allValues.length === 0) return;

    const sorted = [...allValues].sort((a, b) => a - b);
    const percentile = (sorted.filter(v => v < myValue).length / sorted.length) * 100;

    const posName = pos === 'DL' ? 'D-Line' :
                    pos === 'LB' ? 'Linebacker' :
                    pos === 'DB' ? 'Defensive Back' : pos;

    if (percentile >= 70) {
      const starterCount = analysis.starter_positions[pos]?.length || 0;
      if (starterCount > 0) {
        strengths.push(`${posName} (Top ${Math.round(100 - percentile)}%)`);
      }
    } else if (percentile <= 35) {
      weaknesses.push(`${posName} (Bottom ${Math.round(percentile)}%)`);
    }
  });

  const depthRatio = analysis.bench_value / analysis.total_value;
  if (depthRatio > 0.4) {
    strengths.push('Roster Depth');
  } else if (depthRatio < 0.2) {
    weaknesses.push('Lack of Depth');
  }

  const youngRatio = analysis.young_value / analysis.total_value;
  if (youngRatio > 0.4) {
    strengths.push('Young Core (Age ≤24)');
  } else if (youngRatio < 0.15) {
    weaknesses.push('Aging Roster');
  }

  return { strengths, weaknesses };
}

function generateRecommendations(
  window: 'contend' | 'retool' | 'rebuild',
  weaknesses: string[],
  strengths: string[],
  analysis: RosterAnalysis
): string[] {
  const recommendations: string[] = [];

  if (window === 'contend') {
    recommendations.push('Trade future picks for proven starters to maximize your championship window');
    recommendations.push('Consolidate depth pieces into elite players at weak positions');

    if (weaknesses.some(w => w.includes('RB'))) {
      recommendations.push('Target a high-end RB1 - your window is now');
    }

    if (weaknesses.some(w => w.includes('QB'))) {
      recommendations.push('Upgrade at QB immediately - most important position for contending');
    }

    if (analysis.aging_value > analysis.total_value * 0.3) {
      recommendations.push('Monitor aging assets closely - be ready to pivot if values drop');
    }

    recommendations.push('Focus on proven playoff performers over upside plays');
    recommendations.push('Avoid rebuilding trades - your roster can win now');

  } else if (window === 'rebuild') {
    recommendations.push('Trade all veteran assets (age 26+) for future picks and young players');
    recommendations.push('Accumulate 1st round picks - target 2025 and 2026 picks heavily');
    recommendations.push('Focus on QB and WR under age 25 - safest positions for rebuilds');
    recommendations.push('Avoid trading picks for aging RBs - they depreciate fastest');

    if (strengths.some(s => s.includes('QB'))) {
      recommendations.push('Capitalize on QB strength - elite QBs fetch premium prices');
    }

    if (analysis.aging_value > analysis.total_value * 0.25) {
      recommendations.push('Sell aging veterans immediately before value craters further');
    }

    recommendations.push('Target teams in "win-now" mode for best pick returns');
    recommendations.push('Be patient - rebuilds take 1-2 years but position you for sustained success');

  } else {
    recommendations.push('Balance present and future - trade depth for younger starters');
    recommendations.push('Target undervalued breakout candidates (age 23-25)');

    if (weaknesses.some(w => w.includes('RB'))) {
      recommendations.push('Acquire younger RBs (age 22-24) - avoid expensive veterans');
    }

    if (analysis.young_value < analysis.total_value * 0.25) {
      recommendations.push('Increase youth - trade aging depth for younger assets with upside');
    }

    recommendations.push('Convert aging RBs into young WRs or picks before value disappears');
    recommendations.push('Look for buy-low opportunities on injured or underperforming young players');

    if (strengths.length >= 3) {
      recommendations.push('Your roster is close - 1-2 strategic moves could make you a contender');
    } else {
      recommendations.push('Focus on building positional strengths rather than filling all weaknesses');
    }
  }

  return recommendations.slice(0, 8);
}

export function evaluateTeamStrategy(
  roster: PlayerValue[],
  leagueSettings: LeagueSettings,
  allTeamRosters: PlayerValue[][]
): TeamStrategy {
  const analysis = analyzeRoster(roster, leagueSettings.roster_positions);

  const allAnalyses = allTeamRosters.map(r =>
    analyzeRoster(r, leagueSettings.roster_positions)
  );

  const allStarterValues = allAnalyses.map(a => a.starter_value);
  const leaguePercentile = calculateLeaguePercentile(
    analysis.starter_value,
    allStarterValues
  );

  const { window, confidence } = determineWindow(
    analysis,
    leaguePercentile,
    analysis.total_value
  );

  const { strengths, weaknesses } = detectStrengthsWeaknesses(
    analysis,
    allAnalyses
  );

  const recommendations = generateRecommendations(
    window,
    weaknesses,
    strengths,
    analysis
  );

  const positional_scores: Record<string, number> = {};
  const positions = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];

  positions.forEach(pos => {
    const myValue = analysis.positional_values[pos] || 0;
    const allValues = allAnalyses
      .map(a => a.positional_values[pos] || 0)
      .filter(v => v > 0);

    if (allValues.length > 0 && myValue > 0) {
      const sorted = [...allValues].sort((a, b) => a - b);
      positional_scores[pos] = (sorted.filter(v => v < myValue).length / sorted.length) * 100;
    } else {
      positional_scores[pos] = 0;
    }
  });

  return {
    window,
    confidence: Math.round(confidence),
    strengths,
    weaknesses,
    recommendations,
    metrics: {
      starter_strength: analysis.starter_value,
      future_value: analysis.young_value,
      aging_risk: analysis.aging_value,
      depth_score: analysis.bench_value,
      positional_scores,
      league_percentile: Math.round(leaguePercentile),
    },
  };
}
