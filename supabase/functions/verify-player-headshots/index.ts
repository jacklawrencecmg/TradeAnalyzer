import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const batchSize = parseInt(url.searchParams.get('batch_size') || '50', 10);

    const { data: stats, error: statsError } = await supabaseClient.rpc('get_headshot_stats');

    if (statsError) {
      throw statsError;
    }

    const { data: duplicates, error: duplicatesError } = await supabaseClient.rpc(
      'detect_duplicate_headshots'
    );

    if (duplicatesError) {
      throw duplicatesError;
    }

    const { data: players, error: playersError } = await supabaseClient
      .from('player_identity')
      .select('player_id, headshot_url, headshot_source')
      .not('headshot_url', 'is', null)
      .limit(batchSize);

    if (playersError) {
      throw playersError;
    }

    let verified = 0;
    let broken = 0;

    for (const player of players || []) {
      try {
        const response = await fetch(player.headshot_url!, { method: 'HEAD' });

        if (!response.ok) {
          console.log(`Broken headshot for ${player.player_id}: ${player.headshot_url}`);
          broken++;

          await supabaseClient
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
      } catch (error) {
        console.error(`Error verifying headshot for ${player.player_id}:`, error);
        broken++;

        await supabaseClient
          .from('player_identity')
          .update({
            headshot_url: null,
            headshot_source: null,
            headshot_updated_at: null,
          })
          .eq('player_id', player.player_id);
      }
    }

    const issues = [];

    if (stats && stats[0]) {
      const { percent_complete, missing_headshot, total_players } = stats[0];

      if (percent_complete < 80) {
        issues.push({
          type: 'low_coverage',
          severity: 'warning',
          message: `Only ${percent_complete}% of players have headshots (${missing_headshot}/${total_players} missing)`,
        });
      }
    }

    if (duplicates && duplicates.length > 0) {
      issues.push({
        type: 'duplicate_headshots',
        severity: 'error',
        message: `Found ${duplicates.length} duplicate headshots`,
        details: duplicates.slice(0, 5),
      });
    }

    if (broken > 0) {
      issues.push({
        type: 'broken_urls',
        severity: 'error',
        message: `Found ${broken} broken headshot URLs`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: stats?.[0] || null,
        verification: {
          verified,
          broken,
          batch_size: batchSize,
        },
        issues,
        duplicates: duplicates?.slice(0, 10) || [],
        message: `Verified ${verified} headshots, found ${broken} broken, ${issues.length} issues detected`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error verifying player headshots:', error);

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
