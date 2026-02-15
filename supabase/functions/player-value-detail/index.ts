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
    const url = new URL(req.url);
    const playerId = url.searchParams.get('player_id');
    const format = url.searchParams.get('format') || 'dynasty_sf';
    const days = parseInt(url.searchParams.get('days') || '180', 10);

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'player_id parameter required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: player, error: playerError } = await supabase
      .from('nfl_players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: latestValue } = await supabase
      .from('ktc_value_snapshots')
      .select('*')
      .eq('player_id', playerId)
      .eq('format', format)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: playerValue } = await supabase
      .from('player_values')
      .select('dynasty_value, redraft_value, redraft_value_source')
      .eq('player_id', playerId)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: history } = await supabase
      .from('ktc_value_snapshots')
      .select('captured_at, ktc_value, fdp_value, position_rank')
      .eq('player_id', playerId)
      .eq('format', format)
      .gte('captured_at', sinceDate.toISOString())
      .order('captured_at', { ascending: true });

    const { data: currentTeam } = await supabase
      .from('player_team_history')
      .select('team, from_date')
      .eq('player_id', playerId)
      .eq('is_current', true)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          id: player.id,
          full_name: player.full_name,
          position: player.player_position,
          team: currentTeam?.team || player.team,
          status: player.status,
          rookie_year: player.rookie_year,
          birthdate: player.birthdate,
        },
        latest_value: latestValue ? {
          format,
          position_rank: latestValue.position_rank,
          ktc_value: latestValue.ktc_value,
          fdp_value: latestValue.fdp_value,
          dynasty_value: playerValue?.dynasty_value || latestValue.fdp_value || latestValue.ktc_value,
          redraft_value: playerValue?.redraft_value || latestValue.ktc_value,
          redraft_value_source: playerValue?.redraft_value_source || 'heuristic',
          captured_at: latestValue.captured_at,
        } : null,
        history: history || [],
        team_history: currentTeam,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching player detail:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
