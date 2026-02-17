import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const playerName = url.searchParams.get('name');
    const playerId = url.searchParams.get('id');

    if (!playerName && !playerId) {
      return new Response(
        JSON.stringify({ error: 'Missing name or id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let player;

    if (playerId) {
      const { data } = await supabase
        .rpc('get_latest_player_values', {})
        .eq('player_id', playerId)
        .maybeSingle();
      player = data;
    } else {
      const normalizedName = playerName!.toLowerCase().trim();
      const { data } = await supabase
        .rpc('get_latest_player_values', {})
        .ilike('full_name', `%${normalizedName}%`)
        .limit(1)
        .maybeSingle();
      player = data;
    }

    if (!player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const value = player.fdp_value || player.base_value || 0;

    const { data: trend } = await supabase
      .from('player_value_trends')
      .select('trend_direction')
      .eq('player_id', player.player_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tier = determineTier(value, player.position);
    const rank = player.overall_rank || 0;

    const widgetData = {
      player_id: player.player_id,
      full_name: player.full_name,
      position: player.position,
      team: player.team,
      value: Math.round(value),
      tier,
      rank,
      trend: trend?.trend_direction || 'stable',
      last_updated: 'today'
    };

    return new Response(
      JSON.stringify(widgetData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Widget Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function determineTier(value: number, position: string): string {
  const thresholds: Record<string, { elite: number; tier1: number; tier2: number }> = {
    'QB': { elite: 5000, tier1: 3500, tier2: 2000 },
    'RB': { elite: 4500, tier1: 3000, tier2: 1800 },
    'WR': { elite: 4500, tier1: 3000, tier2: 1800 },
    'TE': { elite: 4000, tier1: 2500, tier2: 1500 }
  };

  const t = thresholds[position] || thresholds['WR'];

  if (value >= t.elite) return 'Elite';
  if (value >= t.tier1) return 'Tier 1';
  if (value >= t.tier2) return 'Tier 2';
  return 'Tier 3';
}
