interface RosterPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  fdp_value: number;
  is_starter: boolean;
}

interface PositionalStrength {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
}

interface TeamStrength {
  team_name: string;
  owner_name: string;
  roster_id: number;
  total_value: number;
  starter_value: number;
  bench_value: number;
  positional_strength: PositionalStrength;
  starter_strength: number;
  depth_strength: number;
  overall_score: number;
  badges: string[];
  rank: number;
}

export function calculatePositionalStrength(players: RosterPlayer[]): PositionalStrength {
  const strength: PositionalStrength = {
    qb: 0,
    rb: 0,
    wr: 0,
    te: 0,
    flex: 0,
  };

  const qbs = players.filter(p => p.position === 'QB').sort((a, b) => b.fdp_value - a.fdp_value);
  const rbs = players.filter(p => p.position === 'RB').sort((a, b) => b.fdp_value - a.fdp_value);
  const wrs = players.filter(p => p.position === 'WR').sort((a, b) => b.fdp_value - a.fdp_value);
  const tes = players.filter(p => p.position === 'TE').sort((a, b) => b.fdp_value - a.fdp_value);

  strength.qb = qbs.slice(0, 2).reduce((sum, p) => sum + p.fdp_value, 0);
  strength.rb = rbs.slice(0, 3).reduce((sum, p) => sum + p.fdp_value, 0);
  strength.wr = wrs.slice(0, 3).reduce((sum, p) => sum + p.fdp_value, 0);
  strength.te = tes.slice(0, 2).reduce((sum, p) => sum + p.fdp_value, 0);

  const flexPlayers = [...rbs.slice(3), ...wrs.slice(3), ...tes.slice(2)]
    .sort((a, b) => b.fdp_value - a.fdp_value);
  strength.flex = flexPlayers.slice(0, 2).reduce((sum, p) => sum + p.fdp_value, 0);

  return strength;
}

export function calculateTeamBadges(
  players: RosterPlayer[],
  strength: PositionalStrength,
  totalValue: number,
  starterValue: number
): string[] {
  const badges: string[] = [];

  const avgValue = totalValue / players.length;
  const starterPercent = (starterValue / totalValue) * 100;

  if (starterPercent > 70) {
    badges.push('Win-Now Team');
  }

  if (starterPercent < 55 && players.length > 20) {
    badges.push('Rebuilding');
  }

  if (strength.qb > 18000) {
    badges.push('Elite QB');
  }

  if (strength.rb < 8000) {
    badges.push('Needs RB');
  }

  if (strength.wr < 10000) {
    badges.push('Needs WR');
  }

  if (strength.te < 4000) {
    badges.push('Needs TE');
  }

  const topPlayers = players
    .sort((a, b) => b.fdp_value - a.fdp_value)
    .slice(0, 5);
  const topFiveValue = topPlayers.reduce((sum, p) => sum + p.fdp_value, 0);

  if (topFiveValue > 45000) {
    badges.push('Elite Depth');
  }

  const youngStars = players.filter(p => p.fdp_value > 5000);
  if (youngStars.length > 8 && starterPercent < 60) {
    badges.push('Future Contender');
  }

  return badges;
}

export function analyzeTeamStrength(
  rosterId: number,
  teamName: string,
  ownerName: string,
  players: RosterPlayer[]
): TeamStrength {
  const totalValue = players.reduce((sum, p) => sum + p.fdp_value, 0);
  const starters = players.filter(p => p.is_starter);
  const starterValue = starters.reduce((sum, p) => sum + p.fdp_value, 0);
  const benchValue = totalValue - starterValue;

  const positionalStrength = calculatePositionalStrength(players);

  const starterStrength = starterValue / Math.max(starters.length, 1);
  const depthStrength = benchValue / Math.max(players.length - starters.length, 1);

  const overallScore = (starterValue * 0.7) + (benchValue * 0.3);

  const badges = calculateTeamBadges(players, positionalStrength, totalValue, starterValue);

  return {
    team_name: teamName,
    owner_name: ownerName,
    roster_id: rosterId,
    total_value: Math.round(totalValue),
    starter_value: Math.round(starterValue),
    bench_value: Math.round(benchValue),
    positional_strength: {
      qb: Math.round(positionalStrength.qb),
      rb: Math.round(positionalStrength.rb),
      wr: Math.round(positionalStrength.wr),
      te: Math.round(positionalStrength.te),
      flex: Math.round(positionalStrength.flex),
    },
    starter_strength: Math.round(starterStrength),
    depth_strength: Math.round(depthStrength),
    overall_score: Math.round(overallScore),
    badges,
    rank: 0,
  };
}

export function rankTeams(teams: TeamStrength[]): TeamStrength[] {
  const sorted = [...teams].sort((a, b) => b.overall_score - a.overall_score);

  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));
}

export function identifyPositionalNeeds(team: TeamStrength): string[] {
  const needs: string[] = [];
  const { positional_strength } = team;

  if (positional_strength.qb < 12000) needs.push('QB');
  if (positional_strength.rb < 10000) needs.push('RB');
  if (positional_strength.wr < 12000) needs.push('WR');
  if (positional_strength.te < 5000) needs.push('TE');

  return needs;
}

export function identifyPositionalSurplus(team: TeamStrength, players: RosterPlayer[]): string[] {
  const surplus: string[] = [];
  const { positional_strength } = team;

  const qbs = players.filter(p => p.position === 'QB');
  const rbs = players.filter(p => p.position === 'RB');
  const wrs = players.filter(p => p.position === 'WR');
  const tes = players.filter(p => p.position === 'TE');

  if (positional_strength.qb > 18000 && qbs.length > 2) surplus.push('QB');
  if (positional_strength.rb > 15000 && rbs.length > 5) surplus.push('RB');
  if (positional_strength.wr > 18000 && wrs.length > 6) surplus.push('WR');
  if (positional_strength.te > 8000 && tes.length > 3) surplus.push('TE');

  return surplus;
}
