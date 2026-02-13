import type { LeagueSettings } from './sleeperApi';

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000;

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export interface YahooLeague {
  league_key: string;
  league_id: string;
  name: string;
  season: string;
  num_teams: number;
  scoring_type: string;
  settings: {
    playoff_start_week: string;
    num_playoff_teams: string;
    uses_playoff: string;
    [key: string]: any;
  };
}

export interface YahooTeam {
  team_key: string;
  team_id: string;
  name: string;
  managers: Array<{
    manager_id: string;
    nickname: string;
  }>;
  team_standings: {
    rank: string;
    outcome_totals: {
      wins: string;
      losses: string;
      ties: string;
    };
    points_for: string;
    points_against: string;
  };
  roster?: {
    players: YahooPlayer[];
  };
}

export interface YahooPlayer {
  player_key: string;
  player_id: string;
  name: {
    full: string;
    first: string;
    last: string;
  };
  editorial_team_abbr: string;
  display_position: string;
  position_type: string;
  injury_note?: string;
  status?: string;
}

const POSITION_MAP: Record<string, string> = {
  'QB': 'QB',
  'RB': 'RB',
  'WR': 'WR',
  'TE': 'TE',
  'K': 'K',
  'DEF': 'DEF',
  'D/ST': 'DEF',
};

export async function fetchYahooLeague(
  leagueKey: string,
  accessToken: string
): Promise<YahooLeague> {
  const cacheKey = `yahoo_league_${leagueKey}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}?format=json`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Yahoo league: ${response.statusText}`);
  }

  const data = await response.json();
  const league = data.fantasy_content?.league?.[0] || {};
  setCachedData(cacheKey, league);
  return league;
}

export async function fetchYahooTeams(
  leagueKey: string,
  accessToken: string
): Promise<YahooTeam[]> {
  const cacheKey = `yahoo_teams_${leagueKey}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Yahoo teams: ${response.statusText}`);
  }

  const data = await response.json();
  const teams = data.fantasy_content?.league?.[1]?.teams || [];
  setCachedData(cacheKey, teams);
  return Object.values(teams).filter((t: any) => t.team);
}

export function getYahooLeagueSettings(league: YahooLeague): LeagueSettings {
  const isSuperflex = false;
  const isTEPremium = league.scoring_type?.includes('TE') || false;

  return {
    isSuperflex,
    isTEPremium,
    draftRounds: 15,
    faabBudget: 100,
    numTeams: league.num_teams,
    rosterPositions: [],
    scoringSettings: {},
    hasIDP: false,
    bestBall: false,
  };
}

export function convertYahooPlayer(yahooPlayer: YahooPlayer): {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  injury_status: string | null;
} {
  return {
    player_id: `yahoo_${yahooPlayer.player_id}`,
    full_name: yahooPlayer.name.full,
    first_name: yahooPlayer.name.first,
    last_name: yahooPlayer.name.last,
    position: POSITION_MAP[yahooPlayer.display_position] || yahooPlayer.display_position,
    team: yahooPlayer.editorial_team_abbr || null,
    injury_status: yahooPlayer.injury_note || null,
  };
}

export function getYahooAuthInstructions(): string {
  return `
Yahoo Fantasy requires OAuth authentication, which is more complex:

Option 1 - Use Yahoo League ID (Read-Only, Public Leagues):
1. Open your Yahoo Fantasy league
2. Look at the URL: https://football.fantasysports.yahoo.com/f1/[LEAGUE_ID]
3. Copy the league ID from the URL
4. Note: Only works for public leagues

Option 2 - Full Access (Private Leagues):
Yahoo requires OAuth 2.0 authentication. This feature is coming soon!
For now, you can:
1. Export your league data manually
2. Use the import feature to load rosters
3. Or use a public league ID if available

We're working on implementing full Yahoo OAuth support.
  `.trim();
}
