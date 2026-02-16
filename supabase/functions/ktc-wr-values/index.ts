import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'dynasty_sf';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Use canonical latest_player_values view
    const { data: players, error } = await supabase
      .from('latest_player_values')
      .select('rank_position, player_name, team, base_value, adjusted_value, market_value, updated_at')
      .eq('format', format)
      .eq('position', 'WR')
      .order('rank_position', { ascending: true });

    if (error) {
      throw error;
    }

    const results = (players || []).map(player => ({
      position_rank: player.rank_position,
      full_name: player.player_name,
      team: player.team,
      value: player.market_value || player.base_value,
      dynasty_value: player.adjusted_value || player.base_value,
      redraft_value: player.market_value || player.base_value,
      value_source: 'latest_player_values',
      captured_at: player.updated_at,
    }));

    return new Response(
      JSON.stringify(results),
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
    console.error('Error fetching WR values:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
