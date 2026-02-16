import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ ok: true, results: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cacheKey = `search_${query}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for query: ${query}`);
      return new Response(
        JSON.stringify(cached.data),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const searchTerm = query.trim().toLowerCase();
    console.log(`Searching for: "${searchTerm}"`);

    const { data: players, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, adjusted_value, market_value')
      .eq('format', 'dynasty')
      .ilike('player_name', `%${searchTerm}%`)
      .order('adjusted_value', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log(`Found ${players?.length || 0} players matching "${searchTerm}"`);

    const matches = (players || [])
      .sort((a, b) => {
        const aName = a.player_name.toLowerCase();
        const bName = b.player_name.toLowerCase();

        if (aName.startsWith(searchTerm)) return -1;
        if (bName.startsWith(searchTerm)) return 1;

        return b.adjusted_value - a.adjusted_value;
      })
      .slice(0, limit)
      .map((player) => ({
        id: player.player_id,
        name: player.player_name,
        position: player.position,
        team: player.team,
        value: player.adjusted_value,
      }));

    const result = { ok: true, results: matches };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in player-search function:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
