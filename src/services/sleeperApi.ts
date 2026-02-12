const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000;
const PLAYER_CACHE_DURATION = 24 * 60 * 60 * 1000;

function getCachedData(key: string, maxAge: number = CACHE_DURATION): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  age: number;
  injury_status: string | null;
  fantasy_positions?: string[];
  years_exp?: number;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  settings: {
    num_teams: number;
    playoff_teams: number;
    playoff_week_start: number;
    league_average_match: number;
    [key: string]: any;
  };
  scoring_settings: Record<string, number>;
  roster_positions: string[];
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_against: number;
    [key: string]: any;
  };
  metadata?: {
    record?: string;
    [key: string]: any;
  };
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
    [key: string]: any;
  };
}

export interface DraftPick {
  id: string;
  year: number;
  round: number;
  displayName: string;
}

export interface TradeItem {
  type: 'player' | 'pick' | 'faab';
  id: string;
  name: string;
  position?: string;
  value: number;
}

export interface TradeAnalysis {
  teamAValue: number;
  teamBValue: number;
  difference: number;
  winner: 'A' | 'B' | 'Fair';
  fairness: string;
  teamAItems: TradeItem[];
  teamBItems: TradeItem[];
}

export async function fetchLeagueDetails(leagueId: string): Promise<SleeperLeague> {
  const cacheKey = `league_${leagueId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch league details: ${response.statusText}`);
  }

  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const cacheKey = `rosters_${leagueId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rosters: ${response.statusText}`);
  }

  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function fetchLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  const cacheKey = `users_${leagueId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/users`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  const cacheKey = 'all_players';
  const cached = getCachedData(cacheKey, PLAYER_CACHE_DURATION);
  if (cached) return cached;

  const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.statusText}`);
  }

  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

const POSITION_BASE_VALUES: Record<string, number> = {
  QB: 2500,
  RB: 2800,
  WR: 2600,
  TE: 2000,
  K: 400,
  DEF: 800,
  DL: 1000,
  LB: 1100,
  DB: 1000,
  DE: 1050,
  DT: 950,
  CB: 1000,
  S: 950,
};

let ktcValues: Record<string, number> = {};

export async function fetchPlayerValues(): Promise<void> {
  const cacheKey = 'ktc_values';
  const cached = getCachedData(cacheKey, PLAYER_CACHE_DURATION);
  if (cached) {
    ktcValues = cached;
    return;
  }

  try {
    const response = await fetch('https://api.keeptradecut.com/bff/dynasty/players', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const values: Record<string, number> = {};

      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.sleeperId && item.value) {
            values[item.sleeperId] = parseInt(item.value, 10);
          }
        });
      }

      if (Object.keys(values).length > 0) {
        ktcValues = values;
        setCachedData(cacheKey, values);
        console.log(`Loaded ${Object.keys(values).length} player values from KTC`);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch KTC values, using fallback values:', error);
  }
}

export function getDraftPickValue(round: number, year: number): number {
  const currentYear = new Date().getFullYear();
  const yearDiff = year - currentYear;

  const baseValues: Record<number, number> = {
    1: 8000,
    2: 4500,
    3: 2500,
    4: 1200,
  };

  let value = baseValues[round] || 500;

  if (yearDiff > 0) {
    value *= Math.pow(0.85, yearDiff);
  } else if (yearDiff < 0) {
    value *= 1.15;
  }

  return Math.round(value);
}

export function getFAABValue(amount: number): number {
  return amount * 5;
}

export interface LeagueSettings {
  isSuperflex: boolean;
  isTEPremium: boolean;
}

export function getPlayerValue(
  player: SleeperPlayer,
  settings: LeagueSettings = { isSuperflex: false, isTEPremium: false }
): number {
  if (ktcValues[player.player_id]) {
    let value = ktcValues[player.player_id];

    if (player.position === 'QB' && settings.isSuperflex) {
      value *= 1.3;
    }

    if (player.position === 'TE' && settings.isTEPremium) {
      value *= 1.4;
    }

    return Math.round(value);
  }

  if (!player.position || !POSITION_BASE_VALUES[player.position]) {
    return 0;
  }

  let baseValue = POSITION_BASE_VALUES[player.position];

  if (player.position === 'QB' && settings.isSuperflex) {
    baseValue *= 1.8;
  }

  if (player.position === 'TE' && settings.isTEPremium) {
    baseValue *= 1.5;
  }

  if (player.years_exp !== undefined) {
    if (player.years_exp === 0) {
      baseValue *= 1.3;
    } else if (player.years_exp <= 2) {
      baseValue *= 1.2;
    } else if (player.years_exp >= 10) {
      baseValue *= 0.6;
    } else if (player.years_exp >= 8) {
      baseValue *= 0.75;
    }
  }

  if (player.age) {
    if (player.age < 23) {
      baseValue *= 1.2;
    } else if (player.age < 25) {
      baseValue *= 1.1;
    } else if (player.age > 32) {
      baseValue *= 0.5;
    } else if (player.age > 29) {
      baseValue *= 0.7;
    }
  }

  if (player.injury_status) {
    const injuryMultipliers: Record<string, number> = {
      Out: 0.6,
      Doubtful: 0.75,
      Questionable: 0.95,
      IR: 0.4,
      PUP: 0.5,
      COV: 0.3,
    };
    const multiplier = injuryMultipliers[player.injury_status] || 1;
    baseValue *= multiplier;
  }

  if (player.status === 'Inactive' || player.status === 'Retired') {
    baseValue *= 0.1;
  }

  return Math.round(baseValue);
}

export async function analyzeTrade(
  leagueId: string | undefined,
  teamAGives: string[],
  teamAGets: string[],
  teamAGivesPicks: DraftPick[] = [],
  teamAGetsPicks: DraftPick[] = [],
  teamAGivesFAAB: number = 0,
  teamAGetsFAAB: number = 0,
  leagueSettings?: LeagueSettings
): Promise<TradeAnalysis> {
  await fetchPlayerValues();

  const players = await fetchAllPlayers();

  let settings: LeagueSettings = leagueSettings || { isSuperflex: false, isTEPremium: false };

  if (leagueId && !leagueSettings) {
    const league = await fetchLeagueDetails(leagueId);
    settings.isSuperflex = league.roster_positions.filter((pos) => pos === 'SUPER_FLEX').length > 0;

    const tePremiumPoints = league.scoring_settings?.rec_te || 0;
    const standardRecPoints = league.scoring_settings?.rec || 0;
    settings.isTEPremium = tePremiumPoints > standardRecPoints;
  }

  const teamAItems: TradeItem[] = [];
  let teamAValue = 0;

  for (const playerId of teamAGives) {
    const player = players[playerId];
    if (player) {
      const value = getPlayerValue(player, settings);
      teamAValue += value;
      teamAItems.push({
        type: 'player',
        id: playerId,
        name: player.full_name,
        position: player.position,
        value,
      });
    }
  }

  for (const pick of teamAGivesPicks) {
    const value = getDraftPickValue(pick.round, pick.year);
    teamAValue += value;
    teamAItems.push({
      type: 'pick',
      id: pick.id,
      name: pick.displayName,
      value,
    });
  }

  if (teamAGivesFAAB > 0) {
    const value = getFAABValue(teamAGivesFAAB);
    teamAValue += value;
    teamAItems.push({
      type: 'faab',
      id: 'faab-gives',
      name: `$${teamAGivesFAAB} FAAB`,
      value,
    });
  }

  const teamBItems: TradeItem[] = [];
  let teamBValue = 0;

  for (const playerId of teamAGets) {
    const player = players[playerId];
    if (player) {
      const value = getPlayerValue(player, settings);
      teamBValue += value;
      teamBItems.push({
        type: 'player',
        id: playerId,
        name: player.full_name,
        position: player.position,
        value,
      });
    }
  }

  for (const pick of teamAGetsPicks) {
    const value = getDraftPickValue(pick.round, pick.year);
    teamBValue += value;
    teamBItems.push({
      type: 'pick',
      id: pick.id,
      name: pick.displayName,
      value,
    });
  }

  if (teamAGetsFAAB > 0) {
    const value = getFAABValue(teamAGetsFAAB);
    teamBValue += value;
    teamBItems.push({
      type: 'faab',
      id: 'faab-gets',
      name: `$${teamAGetsFAAB} FAAB`,
      value,
    });
  }

  const difference = Math.abs(teamAValue - teamBValue);
  const percentDiff = (difference / Math.max(teamAValue, teamBValue)) * 100;

  let winner: 'A' | 'B' | 'Fair';
  let fairness: string;

  if (percentDiff < 10) {
    winner = 'Fair';
    fairness = 'This is a fair trade with balanced value on both sides.';
  } else if (teamAValue > teamBValue) {
    winner = 'B';
    fairness = `Team B wins this trade by approximately ${Math.round(percentDiff)}%.`;
  } else {
    winner = 'A';
    fairness = `Team A wins this trade by approximately ${Math.round(percentDiff)}%.`;
  }

  return {
    teamAValue,
    teamBValue,
    difference,
    winner,
    fairness,
    teamAItems,
    teamBItems,
  };
}

export interface TeamRanking {
  roster_id: number;
  owner_id: string;
  team_name: string;
  total_value: number;
  record: string;
  points_for: number;
  top_players: Array<{
    player_id: string;
    name: string;
    position: string;
    value: number;
  }>;
  rank: number;
}

export async function calculatePowerRankings(leagueId: string): Promise<TeamRanking[]> {
  const [league, rosters, users, players] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchLeagueRosters(leagueId),
    fetchLeagueUsers(leagueId),
    fetchAllPlayers(),
  ]);

  const settings: LeagueSettings = {
    isSuperflex: league.roster_positions.filter((pos) => pos === 'SUPER_FLEX').length > 0,
    isTEPremium: (league.scoring_settings?.rec_te || 0) > (league.scoring_settings?.rec || 0),
  };

  const rankings: TeamRanking[] = rosters.map((roster) => {
    const user = users.find((u) => u.user_id === roster.owner_id);
    const teamName =
      user?.metadata?.team_name || user?.display_name || user?.username || 'Unknown Team';

    const playerValues = (roster.players || [])
      .map((playerId) => {
        const player = players[playerId];
        if (!player) return null;

        return {
          player_id: playerId,
          name: player.full_name || 'Unknown Player',
          position: player.position || 'N/A',
          value: getPlayerValue(player, settings),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.value - a.value);

    const totalValue = playerValues.reduce((sum, p) => sum + p.value, 0);
    const topPlayers = playerValues.slice(0, 5);

    return {
      roster_id: roster.roster_id,
      owner_id: roster.owner_id,
      team_name: teamName,
      total_value: totalValue,
      record: `${roster.settings.wins}-${roster.settings.losses}${
        roster.settings.ties > 0 ? `-${roster.settings.ties}` : ''
      }`,
      points_for: Math.round(roster.settings.fpts || 0),
      top_players: topPlayers,
      rank: 0,
    };
  });

  rankings.sort((a, b) => b.total_value - a.total_value);
  rankings.forEach((team, index) => {
    team.rank = index + 1;
  });

  return rankings;
}

export interface PlayoffOdds {
  roster_id: number;
  team_name: string;
  current_record: string;
  projected_wins: number;
  playoff_odds: number;
  championship_odds: number;
}

export async function simulatePlayoffOdds(
  leagueId: string,
  simulations: number = 1000
): Promise<PlayoffOdds[]> {
  const [league, rosters, users] = await Promise.all([
    fetchLeagueDetails(leagueId),
    fetchLeagueRosters(leagueId),
    fetchLeagueUsers(leagueId),
  ]);

  const playoffTeams = league.settings.playoff_teams || 6;
  const totalWeeks = 14;

  const teamStats = rosters.map((roster) => {
    const user = users.find((u) => u.user_id === roster.owner_id);
    const teamName =
      user?.metadata?.team_name || user?.display_name || user?.username || 'Unknown Team';

    const gamesPlayed = roster.settings.wins + roster.settings.losses + roster.settings.ties;
    const remainingGames = Math.max(0, totalWeeks - gamesPlayed);
    const winPct = gamesPlayed > 0 ? roster.settings.wins / gamesPlayed : 0.5;

    return {
      roster_id: roster.roster_id,
      team_name: teamName,
      current_wins: roster.settings.wins,
      current_losses: roster.settings.losses,
      remaining_games: remainingGames,
      win_probability: winPct,
      playoff_count: 0,
      championship_count: 0,
    };
  });

  for (let sim = 0; sim < simulations; sim++) {
    const simResults = teamStats.map((team) => {
      let simulatedWins = team.current_wins;

      for (let game = 0; game < team.remaining_games; game++) {
        const randomWin = Math.random() < team.win_probability;
        if (randomWin) simulatedWins++;
      }

      return {
        roster_id: team.roster_id,
        total_wins: simulatedWins,
      };
    });

    simResults.sort((a, b) => b.total_wins - a.total_wins);

    for (let i = 0; i < Math.min(playoffTeams, simResults.length); i++) {
      const team = teamStats.find((t) => t.roster_id === simResults[i].roster_id);
      if (team) {
        team.playoff_count++;
        if (i === 0) {
          team.championship_count++;
        }
      }
    }
  }

  return teamStats.map((team) => ({
    roster_id: team.roster_id,
    team_name: team.team_name,
    current_record: `${team.current_wins}-${team.current_losses}`,
    projected_wins: team.current_wins + team.remaining_games * team.win_probability,
    playoff_odds: (team.playoff_count / simulations) * 100,
    championship_odds: (team.championship_count / simulations) * 100,
  }));
}
