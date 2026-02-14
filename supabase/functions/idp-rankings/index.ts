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

    const { data: allSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, team, position_rank, ktc_value, fdp_value, captured_at')
      .eq('position', position.toUpperCase())
      .eq('format', format)
      .order('captured_at', { ascending: false });

    if (error) throw error;

    const latestByPlayer = new Map<string, any>();
    for (const snapshot of allSnapshots || []) {
      const key = `${snapshot.player_id}_${snapshot.position}`;
      if (!latestByPlayer.has(key)) {
        latestByPlayer.set(key, snapshot);
      }
    }

    const rankings = Array.from(latestByPlayer.values())
      .sort((a, b) => (b.fdp_value || 0) - (a.fdp_value || 0))
      .slice(0, limit)
      .map((player, index) => ({
        ...player,
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
