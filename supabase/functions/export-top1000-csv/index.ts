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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch cached Top 1000
    const { data: players, error } = await supabase
      .from('fantasypros_top1000_cache')
      .select('*')
      .order('rank_overall', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Top 1000 data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No Top 1000 data available. Please run the import first.',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build CSV
    const headers = [
      'rank_overall',
      'player_name',
      'team',
      'pos',
      'subpos',
      'value_dynasty',
      'value_redraft',
      'dynasty_source',
      'redraft_source',
      'value_source',
      'as_of_date',
      'bye_week',
    ];

    const rows = [headers.join(',')];

    for (const player of players) {
      const row = [
        player.rank_overall || '',
        `"${(player.player_name || '').replace(/"/g, '""')}"`,
        player.team || '',
        player.pos || '',
        player.subpos || '',
        player.value_dynasty || '',
        player.value_redraft || '',
        player.dynasty_source || 'fantasypros_dynasty_rank_curve',
        player.redraft_source || 'fallback',
        player.value_source || '',
        player.as_of_date || '',
        player.bye_week || '',
      ];

      rows.push(row.join(','));
    }

    const csvText = rows.join('\n');

    // Return CSV file
    return new Response(csvText, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="top1000.csv"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
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
