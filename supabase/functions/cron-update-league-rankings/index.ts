import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting weekly league rankings update...');

    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, sleeper_league_id, name');

    if (leaguesError) {
      throw new Error(`Failed to fetch leagues: ${leaguesError.message}`);
    }

    if (!leagues || leagues.length === 0) {
      console.log('No leagues found to update');
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No leagues to update',
          leagues_updated: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${leagues.length} leagues to update`);

    const results = [];
    const errors = [];

    for (const league of leagues) {
      try {
        console.log(`Updating rankings for league: ${league.name} (${league.id})`);

        const calculateUrl = `${supabaseUrl}/functions/v1/calculate-league-rankings`;
        const response = await fetch(calculateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            league_id: league.id,
          }),
        });

        const data = await response.json();

        if (response.ok && data.ok) {
          console.log(`✓ Successfully updated ${league.name}: ${data.teams_ranked} teams ranked`);
          results.push({
            league_id: league.id,
            league_name: league.name,
            success: true,
            teams_ranked: data.teams_ranked,
            week: data.week,
          });
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        console.error(`✗ Failed to update ${league.name}:`, error);
        errors.push({
          league_id: league.id,
          league_name: league.name,
          error: error.message,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Weekly league rankings update complete');
    console.log(`Successes: ${results.length}, Failures: ${errors.length}`);

    return new Response(
      JSON.stringify({
        ok: true,
        leagues_updated: results.length,
        leagues_failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in cron job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
