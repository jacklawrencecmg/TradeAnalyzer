import { identifyPositionalNeeds, identifyPositionalSurplus } from './teamStrength';

interface RosterPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  fdp_value: number;
  is_starter: boolean;
}

interface TeamData {
  roster_id: number;
  team_name: string;
  owner_name: string;
  players: RosterPlayer[];
  needs: string[];
  surplus: string[];
}

interface TradeSuggestion {
  team_a: {
    roster_id: number;
    team_name: string;
    owner_name: string;
  };
  team_b: {
    roster_id: number;
    team_name: string;
    owner_name: string;
  };
  team_a_gives: RosterPlayer[];
  team_a_receives: RosterPlayer[];
  team_b_gives: RosterPlayer[];
  team_b_receives: RosterPlayer[];
  value_difference: number;
  fairness_score: number;
  improves_both: boolean;
  improves_starters: boolean;
  trade_type: '1-for-1' | '2-for-1' | '2-for-2' | '3-for-2';
  rationale: string;
}

const VALUE_TOLERANCE = 1200;

function calculateValueDifference(give: RosterPlayer[], receive: RosterPlayer[]): number {
  const giveValue = give.reduce((sum, p) => sum + p.fdp_value, 0);
  const receiveValue = receive.reduce((sum, p) => sum + p.fdp_value, 0);
  return Math.abs(giveValue - receiveValue);
}

function calculateFairnessScore(valueDiff: number): number {
  if (valueDiff === 0) return 100;
  const penalty = (valueDiff / VALUE_TOLERANCE) * 20;
  return Math.max(60, Math.round(100 - penalty));
}

function addressesNeeds(team: TeamData, receives: RosterPlayer[]): boolean {
  if (team.needs.length === 0) return false;

  return receives.some(player => team.needs.includes(player.position));
}

function usagesSurplus(team: TeamData, gives: RosterPlayer[]): boolean {
  if (team.surplus.length === 0) return false;

  return gives.some(player => team.surplus.includes(player.position));
}

function improvesStartingLineup(team: TeamData, receives: RosterPlayer[]): boolean {
  const starters = team.players
    .filter(p => p.is_starter)
    .sort((a, b) => b.fdp_value - a.fdp_value);

  return receives.some(player => {
    const positionStarters = starters.filter(s => s.position === player.position);
    if (positionStarters.length === 0) return true;

    const weakestStarter = positionStarters[positionStarters.length - 1];
    return player.fdp_value > weakestStarter.fdp_value;
  });
}

function generateRationale(teamA: TeamData, teamB: TeamData, gives: RosterPlayer[], receives: RosterPlayer[]): string {
  const reasons: string[] = [];

  if (addressesNeeds(teamA, receives)) {
    const positions = [...new Set(receives.map(p => p.position))];
    reasons.push(`Fills ${teamA.team_name}'s need at ${positions.join(', ')}`);
  }

  if (usagesSurplus(teamA, gives)) {
    const positions = [...new Set(gives.map(p => p.position))];
    reasons.push(`Uses ${teamA.team_name}'s ${positions.join(', ')} depth`);
  }

  if (addressesNeeds(teamB, gives)) {
    const positions = [...new Set(gives.map(p => p.position))];
    reasons.push(`Fills ${teamB.team_name}'s need at ${positions.join(', ')}`);
  }

  if (gives.length > receives.length) {
    reasons.push('Consolidation trade for quality');
  }

  return reasons.join('; ') || 'Fair value swap';
}

function tryOneForOne(teamA: TeamData, teamB: TeamData): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  for (const playerA of teamA.players) {
    if (playerA.fdp_value < 1000) continue;

    for (const playerB of teamB.players) {
      if (playerB.fdp_value < 1000) continue;

      const valueDiff = Math.abs(playerA.fdp_value - playerB.fdp_value);
      if (valueDiff > VALUE_TOLERANCE) continue;

      const aGets = [playerB];
      const bGets = [playerA];

      const improvesA = addressesNeeds(teamA, aGets) || improvesStartingLineup(teamA, aGets);
      const improvesB = addressesNeeds(teamB, bGets) || improvesStartingLineup(teamB, bGets);

      if (!improvesA && !improvesB) continue;

      const improvesBoth = improvesA && improvesB;
      const improvesStarters = improvesStartingLineup(teamA, aGets) && improvesStartingLineup(teamB, bGets);

      suggestions.push({
        team_a: {
          roster_id: teamA.roster_id,
          team_name: teamA.team_name,
          owner_name: teamA.owner_name,
        },
        team_b: {
          roster_id: teamB.roster_id,
          team_name: teamB.team_name,
          owner_name: teamB.owner_name,
        },
        team_a_gives: [playerA],
        team_a_receives: aGets,
        team_b_gives: [playerB],
        team_b_receives: bGets,
        value_difference: valueDiff,
        fairness_score: calculateFairnessScore(valueDiff),
        improves_both: improvesBoth,
        improves_starters: improvesStarters,
        trade_type: '1-for-1',
        rationale: generateRationale(teamA, teamB, [playerA], aGets),
      });
    }
  }

  return suggestions;
}

function tryTwoForOne(teamA: TeamData, teamB: TeamData): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  const teamATopPlayers = teamA.players
    .filter(p => p.fdp_value > 3000)
    .sort((a, b) => b.fdp_value - a.fdp_value)
    .slice(0, 8);

  for (const playerB1 of teamB.players) {
    if (playerB1.fdp_value < 1500) continue;

    for (const playerB2 of teamB.players) {
      if (playerB2.player_id === playerB1.player_id) continue;
      if (playerB2.fdp_value < 1500) continue;

      const teamBValue = playerB1.fdp_value + playerB2.fdp_value;

      for (const playerA of teamATopPlayers) {
        const valueDiff = Math.abs(teamBValue - playerA.fdp_value);
        if (valueDiff > VALUE_TOLERANCE) continue;

        const aGets = [playerB1, playerB2];
        const bGets = [playerA];

        const improvesA = addressesNeeds(teamA, aGets);
        const improvesB = improvesStartingLineup(teamB, bGets);

        if (!improvesA && !improvesB) continue;

        const improvesBoth = improvesA && improvesB;

        suggestions.push({
          team_a: {
            roster_id: teamA.roster_id,
            team_name: teamA.team_name,
            owner_name: teamA.owner_name,
          },
          team_b: {
            roster_id: teamB.roster_id,
            team_name: teamB.team_name,
            owner_name: teamB.owner_name,
          },
          team_a_gives: [playerA],
          team_a_receives: aGets,
          team_b_gives: [playerB1, playerB2],
          team_b_receives: bGets,
          value_difference: valueDiff,
          fairness_score: calculateFairnessScore(valueDiff),
          improves_both: improvesBoth,
          improves_starters: improvesStartingLineup(teamA, aGets) && improvesStartingLineup(teamB, bGets),
          trade_type: '2-for-1',
          rationale: generateRationale(teamA, teamB, [playerA], aGets),
        });
      }
    }
  }

  return suggestions;
}

function tryTwoForTwo(teamA: TeamData, teamB: TeamData): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  const teamAPlayers = teamA.players.filter(p => p.fdp_value > 2000).slice(0, 12);
  const teamBPlayers = teamB.players.filter(p => p.fdp_value > 2000).slice(0, 12);

  for (let i = 0; i < teamAPlayers.length; i++) {
    for (let j = i + 1; j < teamAPlayers.length; j++) {
      const playerA1 = teamAPlayers[i];
      const playerA2 = teamAPlayers[j];
      const teamAValue = playerA1.fdp_value + playerA2.fdp_value;

      for (let x = 0; x < teamBPlayers.length; x++) {
        for (let y = x + 1; y < teamBPlayers.length; y++) {
          const playerB1 = teamBPlayers[x];
          const playerB2 = teamBPlayers[y];
          const teamBValue = playerB1.fdp_value + playerB2.fdp_value;

          const valueDiff = Math.abs(teamAValue - teamBValue);
          if (valueDiff > VALUE_TOLERANCE) continue;

          const aGets = [playerB1, playerB2];
          const bGets = [playerA1, playerA2];

          const improvesA = addressesNeeds(teamA, aGets);
          const improvesB = addressesNeeds(teamB, bGets);

          if (!improvesA && !improvesB) continue;

          const improvesBoth = improvesA && improvesB;

          suggestions.push({
            team_a: {
              roster_id: teamA.roster_id,
              team_name: teamA.team_name,
              owner_name: teamA.owner_name,
            },
            team_b: {
              roster_id: teamB.roster_id,
              team_name: teamB.team_name,
              owner_name: teamB.owner_name,
            },
            team_a_gives: [playerA1, playerA2],
            team_a_receives: aGets,
            team_b_gives: [playerB1, playerB2],
            team_b_receives: bGets,
            value_difference: valueDiff,
            fairness_score: calculateFairnessScore(valueDiff),
            improves_both: improvesBoth,
            improves_starters: false,
            trade_type: '2-for-2',
            rationale: generateRationale(teamA, teamB, [playerA1, playerA2], aGets),
          });
        }
      }
    }
  }

  return suggestions;
}

export function generateTradeSuggestions(teams: TeamData[]): TradeSuggestion[] {
  const allSuggestions: TradeSuggestion[] = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i];
      const teamB = teams[j];

      allSuggestions.push(...tryOneForOne(teamA, teamB));
      allSuggestions.push(...tryTwoForOne(teamA, teamB));
      allSuggestions.push(...tryTwoForOne(teamB, teamA));
      allSuggestions.push(...tryTwoForTwo(teamA, teamB));
    }
  }

  const scored = allSuggestions.map(s => ({
    ...s,
    score: (s.fairness_score * 0.4) +
           (s.improves_both ? 40 : 0) +
           (s.improves_starters ? 20 : 10),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
