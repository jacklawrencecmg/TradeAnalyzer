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

    const { data: latestSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('*')
      .eq('format', format)
      .eq('position', 'RB')
      .order('captured_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw error;
    }

    const latestByPlayer = new Map<string, any>();

    for (const snapshot of latestSnapshots || []) {
      const key = snapshot.full_name;
      if (!latestByPlayer.has(key) ||
          new Date(snapshot.captured_at) > new Date(latestByPlayer.get(key).captured_at)) {
        latestByPlayer.set(key, snapshot);
      }
    }

    const results = Array.from(latestByPlayer.values())
      .sort((a, b) => a.position_rank - b.position_rank)
      .map(snapshot => ({
        position_rank: snapshot.position_rank,
        full_name: snapshot.full_name,
        team: snapshot.team,
        ktc_value: snapshot.ktc_value,
        fdp_value: snapshot.fdp_value,
        value: snapshot.ktc_value,
        captured_at: snapshot.captured_at,
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
