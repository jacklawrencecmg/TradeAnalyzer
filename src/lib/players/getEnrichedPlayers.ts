import { supabase } from '../supabase';

export interface EnrichedPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string;
  age: number | null;
  years_exp: number | null;
  injury_status: string | null;
  rookie_year: number | null;
}

const enrichedPlayersCache: {
  data: Map<string, EnrichedPlayer> | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache for 5 minutes (much shorter than 24 hours)
const ENRICHED_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Fetches enriched player data from database with current team info
 * This ensures team data is always up-to-date, unlike the 24-hour Sleeper API cache
 */
export async function getEnrichedPlayers(): Promise<Map<string, EnrichedPlayer>> {
  const now = Date.now();

  // Return cached data if fresh
  if (enrichedPlayersCache.data && now - enrichedPlayersCache.timestamp < ENRICHED_CACHE_DURATION) {
    return enrichedPlayersCache.data;
  }

  try {
    const queryPromise = supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team')
      .not('player_id', 'is', null);

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Query timeout') }), 8000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as { data: any; error: any };

    if (error) {
      console.error('Error fetching enriched players:', error);
      if (enrichedPlayersCache.data) {
        return enrichedPlayersCache.data;
      }
      return new Map();
    }

    const playerMap = new Map<string, EnrichedPlayer>();

    data?.forEach((player: any) => {
      playerMap.set(player.player_id, {
        player_id: player.player_id,
        full_name: player.player_name,
        position: player.position,
        team: player.team,
        status: 'Active',
        age: null,
        years_exp: null,
        injury_status: null,
        rookie_year: null,
      });
    });

    // Update cache
    enrichedPlayersCache.data = playerMap;
    enrichedPlayersCache.timestamp = now;

    console.log(`Loaded ${playerMap.size} enriched players from database`);
    return playerMap;
  } catch (error) {
    console.error('Error in getEnrichedPlayers:', error);
    // Return stale cache if available
    if (enrichedPlayersCache.data) {
      return enrichedPlayersCache.data;
    }
    return new Map();
  }
}

/**
 * Gets a single enriched player by ID
 */
export async function getEnrichedPlayer(playerId: string): Promise<EnrichedPlayer | null> {
  const players = await getEnrichedPlayers();
  return players.get(playerId) || null;
}

/**
 * Invalidates the enriched players cache
 * Call this after syncing Sleeper players to force a refresh
 */
export function invalidateEnrichedPlayersCache(): void {
  enrichedPlayersCache.data = null;
  enrichedPlayersCache.timestamp = 0;
  console.log('Enriched players cache invalidated');
}

/**
 * Merges Sleeper API data with database team data
 * Prefers database team data which is more current
 */
export async function mergeSleeperWithDatabase(
  sleeperPlayers: Record<string, any>
): Promise<Record<string, any>> {
  const enrichedMap = await getEnrichedPlayers();

  const merged: Record<string, any> = {};

  for (const [playerId, sleeperData] of Object.entries(sleeperPlayers)) {
    const enriched = enrichedMap.get(playerId);

    if (enriched) {
      // Use database team data (more current) but keep other Sleeper data
      merged[playerId] = {
        ...sleeperData,
        team: enriched.team, // Database team is authoritative
        status: enriched.status,
        injury_status: enriched.injury_status,
      };
    } else {
      // Player not in database, use Sleeper data as-is
      merged[playerId] = sleeperData;
    }
  }

  return merged;
}
