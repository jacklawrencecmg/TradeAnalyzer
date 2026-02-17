import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const forceUpdate = url.searchParams.get('force') === 'true';
    const missingOnly = url.searchParams.get('missing_only') === 'true';

    if (missingOnly) {
      const { data: missingPlayers, error: missingError } = await supabaseClient.rpc(
        'get_players_missing_headshots',
        { p_limit: 100 }
      );

      if (missingError) {
        throw missingError;
      }

      let synced = 0;

      for (const player of missingPlayers || []) {
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
          headshotUrl = 'https://sleepercdn.com/images/v2/icons/player_default.webp';
          source = 'default';
        }

        const { error: updateError } = await supabaseClient.rpc('update_player_headshot', {
          p_player_id: player.player_id,
          p_headshot_url: headshotUrl,
          p_source: source,
          p_force_update: false,
        });

        if (!updateError) {
          synced++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          synced,
          message: `Synced ${synced} missing headshots`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Fetching Sleeper players...');
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');

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

        const { data: playerIdentity, error: identityError } = await supabaseClient
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

        const { data: updateResult, error: updateError } = await supabaseClient.rpc(
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

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        errors,
        message: `Synced ${synced} headshots, skipped ${skipped}, ${errors} errors`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing player headshots:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
