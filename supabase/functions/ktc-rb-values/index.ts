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
      .select('player_id, rank_position, player_name, team, base_value, adjusted_value, market_value, updated_at, metadata')
      .eq('format', format)
      .eq('position', 'RB')
      .order('rank_position', { ascending: true });

    if (error) {
      throw error;
    }

    const results = (players || []).map(player => ({
      player_id: player.player_id,
      position_rank: player.rank_position,
      full_name: player.player_name,
      team: player.team,
      ktc_value: player.base_value,
      fdp_value: player.adjusted_value,
      value: player.market_value || player.base_value,
      captured_at: player.updated_at,
      age: player.metadata?.age,
      depth_role: player.metadata?.depth_role,
      workload_tier: player.metadata?.workload_tier,
      injury_risk: player.metadata?.injury_risk,
      contract_security: player.metadata?.contract_security,
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
    console.error('Error fetching RB values:', error);
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
