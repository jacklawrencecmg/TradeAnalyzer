import { SEASON_CONTEXT } from '../../config/seasonContext';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
}

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  settings: {
    type: number;
    num_teams: number;
  };
  roster_positions: string[];
  scoring_settings: Record<string, number>;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
  };
}

interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string;
}

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string;
  injury_status: string | null;
}

const playerCache = new Map<string, { data: Record<string, SleeperPlayer>; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/user/${username}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching Sleeper user:', error);
    return null;
  }
}

export async function getUserLeagues(userId: string, season: string = SEASON_CONTEXT.last_completed_season.toString()): Promise<SleeperLeague[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${season}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching user leagues:', error);
    return [];
  }
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching league rosters:', error);
    return [];
  }
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/users`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching league users:', error);
    return [];
  }
}

export async function getLeaguePlayers(): Promise<Record<string, SleeperPlayer>> {
  const cacheKey = 'all_players';
  const cached = playerCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/players/nfl`);
    if (!response.ok) return {};
    const data = await response.json();

    playerCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Error fetching league players:', error);
    return {};
  }
}

export async function getLeagueInfo(leagueId: string): Promise<SleeperLeague | null> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching league info:', error);
    return null;
  }
}

export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchSleeperPlayerToDatabase(
  sleeperPlayer: SleeperPlayer,
  databasePlayers: Array<{ player_id: string; full_name: string; position: string }>
): string | null {
  const sleeperName = normalizePlayerName(sleeperPlayer.full_name);
  const sleeperPos = sleeperPlayer.position;

  for (const dbPlayer of databasePlayers) {
    const dbName = normalizePlayerName(dbPlayer.full_name);

    if (dbName === sleeperName && dbPlayer.position === sleeperPos) {
      return dbPlayer.player_id;
    }
  }

  for (const dbPlayer of databasePlayers) {
    const dbName = normalizePlayerName(dbPlayer.full_name);

    if (dbName.includes(sleeperName) || sleeperName.includes(dbName)) {
      if (dbPlayer.position === sleeperPos) {
        return dbPlayer.player_id;
      }
    }
  }

  return null;
}
