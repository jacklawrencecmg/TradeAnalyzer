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
  byName: Map<string, EnrichedPlayer> | null;
  timestamp: number;
} = {
  data: null,
  byName: null,
  timestamp: 0,
};

const ENRICHED_CACHE_DURATION = 5 * 60 * 1000;

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

export async function getEnrichedPlayers(): Promise<Map<string, EnrichedPlayer>> {
  const now = Date.now();

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
    const byNameMap = new Map<string, EnrichedPlayer>();

    data?.forEach((player: any) => {
      const enriched: EnrichedPlayer = {
        player_id: player.player_id,
        full_name: player.player_name,
        position: player.position,
        team: player.team,
        status: 'Active',
        age: null,
        years_exp: null,
        injury_status: null,
        rookie_year: null,
      };
      playerMap.set(player.player_id, enriched);
      if (player.player_name) {
        byNameMap.set(normalizeName(player.player_name), enriched);
      }
    });

    enrichedPlayersCache.data = playerMap;
    enrichedPlayersCache.byName = byNameMap;
    enrichedPlayersCache.timestamp = now;

    console.log(`Loaded ${playerMap.size} enriched players from database`);
    return playerMap;
  } catch (error) {
    console.error('Error in getEnrichedPlayers:', error);
    if (enrichedPlayersCache.data) {
      return enrichedPlayersCache.data;
    }
    return new Map();
  }
}

export async function getEnrichedPlayerByName(name: string): Promise<EnrichedPlayer | null> {
  await getEnrichedPlayers();
  return enrichedPlayersCache.byName?.get(normalizeName(name)) || null;
}

export async function getEnrichedPlayer(playerId: string): Promise<EnrichedPlayer | null> {
  const players = await getEnrichedPlayers();
  return players.get(playerId) || null;
}

export function invalidateEnrichedPlayersCache(): void {
  enrichedPlayersCache.data = null;
  enrichedPlayersCache.byName = null;
  enrichedPlayersCache.timestamp = 0;
  console.log('Enriched players cache invalidated');
}

export async function mergeSleeperWithDatabase(
  sleeperPlayers: Record<string, any>
): Promise<Record<string, any>> {
  await getEnrichedPlayers();
  const enrichedMap = enrichedPlayersCache.data!;
  const byNameMap = enrichedPlayersCache.byName!;

  const merged: Record<string, any> = {};

  for (const [playerId, sleeperData] of Object.entries(sleeperPlayers)) {
    const enrichedById = enrichedMap.get(playerId);
    const sleeperName = sleeperData.full_name || `${sleeperData.first_name || ''} ${sleeperData.last_name || ''}`.trim();
    const enrichedByName = sleeperName ? byNameMap.get(normalizeName(sleeperName)) : undefined;
    const enriched = enrichedById || enrichedByName;

    if (enriched) {
      merged[playerId] = {
        ...sleeperData,
        team: enriched.team,
        status: enriched.status,
        injury_status: enriched.injury_status,
      };
    } else {
      merged[playerId] = sleeperData;
    }
  }

  return merged;
}
