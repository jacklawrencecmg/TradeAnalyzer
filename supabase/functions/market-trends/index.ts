import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const tag = url.searchParams.get('tag');
    const position = url.searchParams.get('pos') || url.searchParams.get('position');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('player_market_trends')
      .select('*')
      .order('signal_strength', { ascending: false })
      .order('value_now', { ascending: false })
      .limit(limit);

    if (tag) {
      query = query.eq('tag', tag);
    }

    if (position) {
      query = query.eq('player_position', position);
    }

    const { data: allTrends, error: trendsError } = await query;

    if (trendsError) {
      throw new Error(`Failed to fetch trends: ${trendsError.message}`);
    }

    const latestByPlayer = new Map();
    allTrends?.forEach(trend => {
      const existing = latestByPlayer.get(trend.player_id);
      if (!existing || new Date(trend.computed_at) > new Date(existing.computed_at)) {
        latestByPlayer.set(trend.player_id, trend);
      }
    });

    let trends = Array.from(latestByPlayer.values());

    trends.sort((a, b) => {
      if (a.signal_strength !== b.signal_strength) {
        return b.signal_strength - a.signal_strength;
      }

      if (tag === 'buy_low' || tag === 'falling') {
        return a.change_30d - b.change_30d;
      }

      if (tag === 'sell_high' || tag === 'rising') {
        return b.change_30d - a.change_30d;
      }

      return b.value_now - a.value_now;
    });

    trends = trends.slice(0, limit);

    const summary = {
      buy_low: trends.filter(t => t.tag === 'buy_low').length,
      sell_high: trends.filter(t => t.tag === 'sell_high').length,
      rising: trends.filter(t => t.tag === 'rising').length,
      falling: trends.filter(t => t.tag === 'falling').length,
      stable: trends.filter(t => t.tag === 'stable').length,
    };

    const lastComputed = trends.length > 0 ? trends[0].computed_at : null;

    return new Response(
      JSON.stringify({
        ok: true,
        trends,
        count: trends.length,
        summary,
        last_computed: lastComputed,
        filters: {
          tag,
          position,
          limit,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching market trends:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
