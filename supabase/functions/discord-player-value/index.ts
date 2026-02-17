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
    const format = url.searchParams.get('format') || 'text';

    if (!playerName && !playerId) {
      return new Response(
        'Error: Missing name or id parameter\nUsage: /api/discord/player-value?name=jaxon-smith-njigba',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
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
      const normalizedName = playerName!.toLowerCase().trim().replace(/-/g, ' ');
      const { data } = await supabase
        .rpc('get_latest_player_values', {})
        .ilike('full_name', `%${normalizedName}%`)
        .limit(1)
        .maybeSingle();
      player = data;
    }

    if (!player) {
      return new Response(
        'Player not found. Try using their full name.',
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
      );
    }

    const value = player.fdp_value || player.base_value || 0;

    const { data: trend } = await supabase
      .from('player_value_trends')
      .select('trend_direction, change_amount')
      .eq('player_id', player.player_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tier = determineTier(value, player.position);
    const rank = player.overall_rank || 0;
    const positionRank = player.position_rank || 0;
    const trendIcon = getTrendIcon(trend?.trend_direction);

    const playerSlug = player.full_name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if (format === 'json') {
      return new Response(
        JSON.stringify({
          name: player.full_name,
          position: player.position,
          team: player.team,
          value: Math.round(value),
          tier,
          overall_rank: rank,
          position_rank: positionRank,
          trend: trend?.trend_direction || 'stable',
          trend_change: trend?.change_amount || 0,
          url: `https://www.fantasydraftpros.com/dynasty-value/${playerSlug}`
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trendText = trend?.change_amount
      ? `${trendIcon} ${Math.abs(Math.round(trend.change_amount))} pts`
      : trendIcon;

    const discordText = `**${player.full_name}** — Dynasty ${player.position}${positionRank > 0 ? positionRank : ''} (${tier})
Value: **${Math.round(value)}** ${trendText}
Rank: #${rank} Overall${positionRank > 0 ? ` | #${positionRank} ${player.position}` : ''}
Updated today
https://www.fantasydraftpros.com/dynasty-value/${playerSlug}`;

    return new Response(
      discordText,
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Discord Bot Error:', error);
    return new Response(
      'Internal server error. Please try again.',
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } }
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

function getTrendIcon(trend?: string): string {
  if (trend === 'rising' || trend === 'up') return '📈';
  if (trend === 'declining' || trend === 'down') return '📉';
  return '➡️';
}
