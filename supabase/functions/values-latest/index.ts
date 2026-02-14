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
    const format = url.searchParams.get('format') || 'dynasty_sf';
    const position = url.searchParams.get('position');

    if (!position) {
      return new Response(
        JSON.stringify({ error: 'Position parameter required' }),
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

    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        WITH latest_values AS (
          SELECT DISTINCT ON (player_id)
            player_id,
            position_rank,
            ktc_value,
            fdp_value,
            captured_at
          FROM ktc_value_snapshots
          WHERE format = '${format}'
            AND player_position = '${position}'
          ORDER BY player_id, captured_at DESC
        )
        SELECT
          lv.player_id,
          np.full_name,
          np.player_position,
          np.team,
          lv.position_rank,
          lv.ktc_value,
          lv.fdp_value,
          lv.captured_at
        FROM latest_values lv
        JOIN nfl_players np ON np.id = lv.player_id
        WHERE np.status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR')
        ORDER BY lv.position_rank ASC NULLS LAST, lv.ktc_value DESC
      `,
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        format,
        position,
        count: data?.length || 0,
        players: data || [],
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
    console.error('Error fetching latest values:', error);
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
