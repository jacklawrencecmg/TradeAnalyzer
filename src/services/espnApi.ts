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

export interface ESPNLeague {
  id: string;
  name: string;
  seasonId: number;
  size: number;
  scoringPeriodId: number;
  settings: {
    name: string;
    size: number;
    playoffTeamCount: number;
    scoringType: string;
    [key: string]: any;
  };
}

export interface ESPNTeam {
  id: number;
  location: string;
  nickname: string;
  abbrev: string;
  record: {
    overall: {
      wins: number;
      losses: number;
      ties: number;
      percentage: number;
    };
  };
  roster: {
    entries: Array<{
      playerId: number;
      playerPoolEntry: {
        player: ESPNPlayer;
      };
    }>;
  };
  valuesByStat?: Record<string, number>;
}

export interface ESPNPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  defaultPositionId: number;
  proTeamId: number;
  injured: boolean;
  injuryStatus?: string;
}

const POSITION_MAP: Record<number, string> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
};

const TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
};

export async function fetchESPNLeague(
  leagueId: string,
  seasonId: number,
  espnS2?: string,
  swid?: string
): Promise<ESPNLeague> {
  const cacheKey = `espn_league_${leagueId}_${seasonId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  if (espnS2 && swid) {
    headers['Cookie'] = `espn_s2=${espnS2}; SWID=${swid}`;
  }

  const response = await fetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonId}/segments/0/leagues/${leagueId}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ESPN league: ${response.statusText}`);
  }

  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function fetchESPNTeams(
  leagueId: string,
  seasonId: number,
  espnS2?: string,
  swid?: string
): Promise<ESPNTeam[]> {
  const cacheKey = `espn_teams_${leagueId}_${seasonId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  if (espnS2 && swid) {
    headers['Cookie'] = `espn_s2=${espnS2}; SWID=${swid}`;
  }

  const response = await fetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonId}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ESPN teams: ${response.statusText}`);
  }

  const data = await response.json();
  const teams = data.teams || [];
  setCachedData(cacheKey, teams);
  return teams;
}

export function getESPNLeagueSettings(league: ESPNLeague): LeagueSettings {
  const isSuperflex = false;
  const isTEPremium = league.settings.scoringType === 'TE_PREMIUM';

  return {
    isSuperflex,
    isTEPremium,
    draftRounds: 15,
    faabBudget: 100,
    numTeams: league.size,
    rosterPositions: [],
    scoringSettings: {},
    hasIDP: false,
    bestBall: false,
  };
}

export function convertESPNPlayer(espnPlayer: ESPNPlayer): {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  injury_status: string | null;
} {
  return {
    player_id: `espn_${espnPlayer.id}`,
    full_name: espnPlayer.fullName,
    first_name: espnPlayer.firstName,
    last_name: espnPlayer.lastName,
    position: POSITION_MAP[espnPlayer.defaultPositionId] || 'UNKNOWN',
    team: TEAM_MAP[espnPlayer.proTeamId] || null,
    injury_status: espnPlayer.injured ? (espnPlayer.injuryStatus || 'Injured') : null,
  };
}

export function getESPNAuthInstructions(): string {
  return `
To connect your ESPN league, you need to get your authentication cookies:

1. Open ESPN Fantasy Football in your browser
2. Log in to your account
3. Open Developer Tools (F12 or Right-click > Inspect)
4. Go to the "Application" or "Storage" tab
5. Find "Cookies" in the left sidebar
6. Look for these two cookies:
   - espn_s2 (a long string)
   - SWID (looks like {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX})
7. Copy both values

Note: These cookies expire periodically, so you may need to update them.
  `.trim();
}
