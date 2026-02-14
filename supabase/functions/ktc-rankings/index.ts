import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PlayerRanking {
  position_rank: number;
  full_name: string;
  position: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const position = url.searchParams.get('position') || 'QB';
    const format = url.searchParams.get('format') || 'dynasty_sf';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: allSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, team, position_rank, ktc_value, fdp_value, captured_at')
      .eq('position', position)
      .eq('format', format)
      .order('captured_at', { ascending: false });

    if (error) {
      throw error;
    }

    const latestByPlayer = new Map<string, PlayerRanking>();
    for (const snapshot of allSnapshots || []) {
      const key = `${snapshot.player_id}`;
      if (!latestByPlayer.has(key)) {
        latestByPlayer.set(key, {
          position_rank: snapshot.position_rank,
          full_name: snapshot.full_name,
          position: snapshot.position,
          team: snapshot.team,
          ktc_value: snapshot.ktc_value,
          fdp_value: snapshot.fdp_value || snapshot.ktc_value,
          captured_at: snapshot.captured_at,
        });
      }
    }

    const rankings = Array.from(latestByPlayer.values())
      .sort((a, b) => a.position_rank - b.position_rank);

    return new Response(
      JSON.stringify(rankings),
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
    console.error('Error fetching rankings:', error);
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
