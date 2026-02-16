import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const url = new URL(req.url);
    const position = url.searchParams.get('position');
    const format = url.searchParams.get('format') || 'dynasty_sf_idp';
    const limit = parseInt(url.searchParams.get('limit') || '100');

    if (!position || !['DL', 'LB', 'DB'].includes(position.toUpperCase())) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or missing position. Use DL, LB, or DB.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Use canonical latest_player_values view
    const { data: players, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, rank_position, base_value, adjusted_value, market_value, updated_at')
      .eq('position', position.toUpperCase())
      .eq('format', format)
      .order('rank_position', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const rankings = (players || []).map((player, index) => ({
      player_id: player.player_id,
      full_name: player.player_name,
      position: player.position,
      team: player.team,
      position_rank: player.rank_position,
      ktc_value: player.base_value,
      fdp_value: player.adjusted_value,
      captured_at: player.updated_at,
      fdp_rank: index + 1,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        position: position.toUpperCase(),
        format,
        count: rankings.length,
        players: rankings,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('Error in idp-rankings function:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
