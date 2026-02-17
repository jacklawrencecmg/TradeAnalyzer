import { supabase } from '../supabase';

const DEFAULT_HEADSHOT = 'https://sleepercdn.com/images/v2/icons/player_default.webp';

const headshotCache = new Map<string, {
  url: string;
  source: string;
  timestamp: number;
}>();

const CACHE_TTL = 1000 * 60 * 60 * 24;

export interface PlayerHeadshot {
  url: string;
  source: string | null;
  last_verified: string | null;
  is_verified: boolean;
}

export async function getPlayerHeadshot(playerId: string): Promise<PlayerHeadshot> {
  const cached = headshotCache.get(playerId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      url: cached.url,
      source: cached.source,
      last_verified: null,
      is_verified: false,
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_player_headshot', {
      p_player_id: playerId,
    });

    if (error) {
      console.error(`Error fetching headshot for ${playerId}:`, error);
      return {
        url: DEFAULT_HEADSHOT,
        source: 'default',
        last_verified: null,
        is_verified: false,
      };
    }

    if (!data || data.length === 0 || !data[0].url) {
      return {
        url: DEFAULT_HEADSHOT,
        source: 'default',
        last_verified: null,
        is_verified: false,
      };
    }

    const headshot = data[0];

    headshotCache.set(playerId, {
      url: headshot.url,
      source: headshot.source || 'unknown',
      timestamp: Date.now(),
    });

    return {
      url: headshot.url,
      source: headshot.source,
      last_verified: headshot.last_verified,
      is_verified: headshot.is_verified || false,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      url: DEFAULT_HEADSHOT,
      source: 'default',
      last_verified: null,
      is_verified: false,
    };
  }
}

export async function getPlayerHeadshots(
  playerIds: string[]
): Promise<Map<string, PlayerHeadshot>> {
  const results = new Map<string, PlayerHeadshot>();

  const uncachedIds = playerIds.filter((id) => {
    const cached = headshotCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(id, {
        url: cached.url,
        source: cached.source,
        last_verified: null,
        is_verified: false,
      });
      return false;
    }
    return true;
  });

  if (uncachedIds.length === 0) {
    return results;
  }

  try {
    const { data: identities, error } = await supabase
      .from('player_identity')
      .select('player_id, headshot_url, headshot_source, headshot_updated_at, headshot_verified')
      .in('player_id', uncachedIds);

    if (error) {
      console.error('Error fetching headshots:', error);
      uncachedIds.forEach((id) => {
        results.set(id, {
          url: DEFAULT_HEADSHOT,
          source: 'default',
          last_verified: null,
          is_verified: false,
        });
      });
      return results;
    }

    const identityMap = new Map(
      (identities || []).map((identity) => [identity.player_id, identity])
    );

    uncachedIds.forEach((id) => {
      const identity = identityMap.get(id);

      if (!identity || !identity.headshot_url) {
        results.set(id, {
          url: DEFAULT_HEADSHOT,
          source: 'default',
          last_verified: null,
          is_verified: false,
        });
      } else {
        headshotCache.set(id, {
          url: identity.headshot_url,
          source: identity.headshot_source || 'unknown',
          timestamp: Date.now(),
        });

        results.set(id, {
          url: identity.headshot_url,
          source: identity.headshot_source,
          last_verified: identity.headshot_updated_at,
          is_verified: identity.headshot_verified || false,
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Error:', error);
    uncachedIds.forEach((id) => {
      results.set(id, {
        url: DEFAULT_HEADSHOT,
        source: 'default',
        last_verified: null,
        is_verified: false,
      });
    });
    return results;
  }
}

export function clearHeadshotCache(): void {
  headshotCache.clear();
}

export function getHeadshotCacheSize(): number {
  return headshotCache.size;
}

export function getSleeperHeadshotUrl(sleeperId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;
}

export function getESPNHeadshotUrl(espnId: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png`;
}

export function getNFLHeadshotUrl(gsisId: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${gsisId}.png`;
}

export function getDefaultHeadshot(): string {
  return DEFAULT_HEADSHOT;
}
