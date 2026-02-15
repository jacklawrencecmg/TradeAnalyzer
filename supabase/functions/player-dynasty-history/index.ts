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
    const playerId = url.searchParams.get('player_id');
    const days = parseInt(url.searchParams.get('days') || '30');

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'player_id parameter required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get player info
    const { data: player } = await supabase
      .from('player_values')
      .select('player_name, position, fdp_value, base_value')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get adjustment history
    const { data: adjustments } = await supabase.rpc('get_recent_dynasty_adjustments', {
      p_player_id: playerId,
      p_days: days,
    });

    // Get value history
    const { data: history } = await supabase.rpc('get_dynasty_value_history', {
      p_player_id: playerId,
      p_days: Math.max(days, 90),
    });

    // Calculate total adjustment
    const { data: totalAdjustment } = await supabase.rpc(
      'calculate_dynasty_adjustment_total',
      {
        p_player_id: playerId,
        p_days: days,
      }
    );

    // Calculate 7d and 30d changes
    const snapshots = history || [];
    const currentValue = snapshots.length > 0 ? snapshots[0].dynasty_value : player.fdp_value;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const value7d = snapshots.find(
      (s) => new Date(s.snapshot_date) <= sevenDaysAgo
    )?.dynasty_value;
    const value30d = snapshots.find(
      (s) => new Date(s.snapshot_date) <= thirtyDaysAgo
    )?.dynasty_value;

    const result = {
      player_id: playerId,
      player_name: player.player_name,
      position: player.position,
      current_dynasty_value: currentValue,
      base_dynasty_value: player.base_value || player.fdp_value,
      total_adjustment: totalAdjustment || 0,
      change_7d: value7d ? currentValue - value7d : 0,
      change_30d: value30d ? currentValue - value30d : 0,
      recent_adjustments: adjustments || [],
      value_history: snapshots.slice(0, 30), // Last 30 snapshots
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Dynasty history error:', error);
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
