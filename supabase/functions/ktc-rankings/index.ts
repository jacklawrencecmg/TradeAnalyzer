import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PlayerRanking {
  player_id: string;
  position_rank: number;
  full_name: string;
  position: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
  trend?: 'up' | 'down' | 'stable';
}

function calculateTrend(allSnapshots: any[], playerId: string): 'up' | 'down' | 'stable' {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const playerSnapshots = allSnapshots
    .filter(s => s.player_id === playerId)
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());

  if (playerSnapshots.length < 2) return 'stable';

  const recentSnapshots = playerSnapshots.filter(
    s => new Date(s.captured_at) >= sevenDaysAgo
  );

  if (recentSnapshots.length < 2) {
    const oldest = playerSnapshots[0];
    const newest = playerSnapshots[playerSnapshots.length - 1];
    const diff = newest.fdp_value - oldest.fdp_value;

    if (diff > 200) return 'up';
    if (diff < -200) return 'down';
    return 'stable';
  }

  const oldest = recentSnapshots[0];
  const newest = recentSnapshots[recentSnapshots.length - 1];
  const diff = newest.fdp_value - oldest.fdp_value;

  if (diff > 200) return 'up';
  if (diff < -200) return 'down';
  return 'stable';
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
    const requestedFormat = url.searchParams.get('format') || 'dynasty_sf';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const canonicalFormat = requestedFormat.includes('redraft') ? 'redraft' : 'dynasty';

    const { data: players, error } = await supabase
      .from('player_values_canonical')
      .select('player_id, player_name, position, team, rank_position, rank_overall, base_value, adjusted_value, updated_at')
      .eq('position', position)
      .eq('format', canonicalFormat)
      .is('league_profile_id', null)
      .order('adjusted_value', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify([]),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
          },
        }
      );
    }

    const rankings: PlayerRanking[] = players.map((player, index) => ({
      player_id: player.player_id,
      position_rank: player.rank_position || (index + 1),
      full_name: player.player_name,
      position: player.position,
      team: player.team,
      ktc_value: Math.round(player.base_value),
      fdp_value: Math.round(player.adjusted_value),
      captured_at: player.updated_at,
      trend: 'stable',
    }));

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
