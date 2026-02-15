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
      .select('position_rank, full_name, team, ktc_value, dynasty_value, redraft_value, redraft_value_source, captured_at')
      .eq('format', format)
      .eq('position', 'WR')
      .order('position_rank', { ascending: true });

    if (error) {
      throw error;
    }

    const results = (players || []).map(player => ({
      position_rank: player.position_rank,
      full_name: player.full_name,
      team: player.team,
      value: player.ktc_value,
      dynasty_value: player.dynasty_value || player.ktc_value,
      redraft_value: player.redraft_value || player.ktc_value,
      value_source: player.redraft_value_source || 'heuristic',
      captured_at: player.captured_at,
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
