import { supabase } from '../supabase';

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  fantasy_positions: string[];
  status: string;
}

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';

const DEFAULT_HEADSHOT = 'https://sleepercdn.com/images/v2/icons/player_default.webp';

export async function syncPlayerHeadshotsFromSleeper(
  forceUpdate: boolean = false
): Promise<{
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  try {
    console.log('Fetching Sleeper players...');
    const response = await fetch(SLEEPER_PLAYERS_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch Sleeper players: ${response.statusText}`);
    }

    const sleeperPlayers: Record<string, SleeperPlayer> = await response.json();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`Processing ${Object.keys(sleeperPlayers).length} Sleeper players...`);

    for (const [sleeperId, player] of Object.entries(sleeperPlayers)) {
      try {
        const headshotUrl = `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;

        const { data: playerIdentity, error: identityError } = await supabase
          .from('player_identity')
          .select('player_id, headshot_verified')
          .eq('sleeper_id', sleeperId)
          .maybeSingle();

        if (identityError) {
          console.error(`Error fetching identity for ${sleeperId}:`, identityError);
          errors++;
          continue;
        }

        if (!playerIdentity) {
          skipped++;
          continue;
        }

        if (playerIdentity.headshot_verified && !forceUpdate) {
          skipped++;
          continue;
        }

        const { data: updateResult, error: updateError } = await supabase.rpc(
          'update_player_headshot',
          {
            p_player_id: playerIdentity.player_id,
            p_headshot_url: headshotUrl,
            p_source: 'sleeper',
            p_force_update: forceUpdate,
          }
        );

        if (updateError) {
          console.error(`Error updating headshot for ${playerIdentity.player_id}:`, updateError);
          errors++;
          continue;
        }

        if (updateResult) {
          synced++;
        } else {
          skipped++;
        }

        if (synced % 100 === 0) {
          console.log(`Progress: ${synced} synced, ${skipped} skipped, ${errors} errors`);
        }
      } catch (error) {
        console.error(`Error processing player ${sleeperId}:`, error);
        errors++;
      }
    }

    return {
      success: true,
      synced,
      skipped,
      errors,
      message: `Synced ${synced} headshots, skipped ${skipped}, ${errors} errors`,
    };
  } catch (error) {
    console.error('Error syncing headshots:', error);
    return {
      success: false,
      synced: 0,
      skipped: 0,
      errors: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function syncMissingHeadshots(
  limit: number = 100
): Promise<{
  success: boolean;
  synced: number;
  message: string;
}> {
  try {
    const { data: missingPlayers, error: missingError } = await supabase.rpc(
      'get_players_missing_headshots',
      { p_limit: limit }
    );

    if (missingError) {
      throw missingError;
    }

    if (!missingPlayers || missingPlayers.length === 0) {
      return {
        success: true,
        synced: 0,
        message: 'No players missing headshots',
      };
    }

    let synced = 0;

    for (const player of missingPlayers) {
      let headshotUrl: string | null = null;
      let source: string | null = null;

      if (player.sleeper_id) {
        headshotUrl = `https://sleepercdn.com/content/nfl/players/thumb/${player.sleeper_id}.jpg`;
        source = 'sleeper';
      } else if (player.gsis_id) {
        headshotUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.gsis_id}.png`;
        source = 'espn';
      } else if (player.espn_id) {
        headshotUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.espn_id}.png`;
        source = 'espn';
      }

      if (!headshotUrl || !source) {
        headshotUrl = DEFAULT_HEADSHOT;
        source = 'default';
      }

      const { error: updateError } = await supabase.rpc('update_player_headshot', {
        p_player_id: player.player_id,
        p_headshot_url: headshotUrl,
        p_source: source,
        p_force_update: false,
      });

      if (!updateError) {
        synced++;
      }
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} missing headshots`,
    };
  } catch (error) {
    console.error('Error syncing missing headshots:', error);
    return {
      success: false,
      synced: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getHeadshotStats(): Promise<{
  total_players: number;
  with_headshot: number;
  missing_headshot: number;
  verified_headshot: number;
  percent_complete: number;
} | null> {
  try {
    const { data, error } = await supabase.rpc('get_headshot_stats');

    if (error) {
      console.error('Error getting headshot stats:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0];
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

export async function detectDuplicateHeadshots(): Promise<
  Array<{
    headshot_url: string;
    player_count: number;
    player_names: string[];
  }>
> {
  try {
    const { data, error } = await supabase.rpc('detect_duplicate_headshots');

    if (error) {
      console.error('Error detecting duplicate headshots:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

export async function verifyHeadshotUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function verifyAllHeadshots(
  batchSize: number = 50
): Promise<{
  success: boolean;
  verified: number;
  broken: number;
  message: string;
}> {
  try {
    const { data: players, error } = await supabase
      .from('player_identity')
      .select('player_id, headshot_url, headshot_source')
      .not('headshot_url', 'is', null)
      .limit(batchSize);

    if (error) {
      throw error;
    }

    if (!players || players.length === 0) {
      return {
        success: true,
        verified: 0,
        broken: 0,
        message: 'No headshots to verify',
      };
    }

    let verified = 0;
    let broken = 0;

    for (const player of players) {
      const isValid = await verifyHeadshotUrl(player.headshot_url!);

      if (!isValid) {
        console.log(`Broken headshot for ${player.player_id}: ${player.headshot_url}`);
        broken++;

        await supabase
          .from('player_identity')
          .update({
            headshot_url: null,
            headshot_source: null,
            headshot_updated_at: null,
          })
          .eq('player_id', player.player_id);
      } else {
        verified++;
      }
    }

    return {
      success: true,
      verified,
      broken,
      message: `Verified ${verified} headshots, found ${broken} broken`,
    };
  } catch (error) {
    console.error('Error verifying headshots:', error);
    return {
      success: false,
      verified: 0,
      broken: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
