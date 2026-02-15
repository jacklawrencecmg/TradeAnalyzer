import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function callFunction(functionName: string, secret: string): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const url = `${supabaseUrl}/functions/v1/${functionName}?secret=${secret}`;

  console.log(`Calling ${functionName}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${functionName} failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`${functionName} complete:`, result);

  return result;
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
    const secret = url.searchParams.get('secret');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (secret !== cronSecret && req.headers.get('Authorization') !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pipeline = {
      started_at: new Date().toISOString(),
      steps: [] as any[],
      success: true,
      total_duration_ms: 0,
    };

    const startTime = Date.now();

    console.log('=== FULL SYNC PIPELINE STARTED ===');

    try {
      console.log('\n--- STEP 1: Sync Players from Sleeper ---');
      const step1Start = Date.now();
      const playersResult = await callFunction('sync-sleeper-players', cronSecret!);
      const step1Duration = Date.now() - step1Start;

      pipeline.steps.push({
        step: 1,
        name: 'sync_players',
        status: playersResult.success ? 'success' : 'failed',
        duration_ms: step1Duration,
        result: playersResult,
      });

      if (!playersResult.success) {
        throw new Error('Player sync failed');
      }

      console.log(`Players synced: +${playersResult.inserted} ~${playersResult.updated}`);
    } catch (error) {
      pipeline.success = false;
      pipeline.steps.push({
        step: 1,
        name: 'sync_players',
        status: 'error',
        error: error.message,
      });
      throw error;
    }

    try {
      console.log('\n--- STEP 2: Sync ADP Data ---');
      const step2Start = Date.now();
      const adpResult = await callFunction('sync-adp', cronSecret!);
      const step2Duration = Date.now() - step2Start;

      pipeline.steps.push({
        step: 2,
        name: 'sync_adp',
        status: adpResult.success ? 'success' : 'warning',
        duration_ms: step2Duration,
        result: adpResult,
      });

      console.log(`ADP synced: ${adpResult.imported} imported, ${adpResult.unresolved} unresolved`);
    } catch (error) {
      pipeline.steps.push({
        step: 2,
        name: 'sync_adp',
        status: 'warning',
        error: error.message,
      });
      console.warn('ADP sync failed (non-critical):', error);
    }

    try {
      console.log('\n--- STEP 3: Sync Values from KTC ---');
      const step3Start = Date.now();
      const valuesResult = await callFunction('sync-values-all', cronSecret!);
      const step3Duration = Date.now() - step3Start;

      pipeline.steps.push({
        step: 3,
        name: 'sync_values',
        status: valuesResult.success ? 'success' : 'failed',
        duration_ms: step3Duration,
        result: valuesResult,
      });

      if (!valuesResult.success) {
        throw new Error('Values sync failed');
      }

      console.log(`Values synced: +${valuesResult.totals.inserted} ~${valuesResult.totals.updated}`);
    } catch (error) {
      pipeline.success = false;
      pipeline.steps.push({
        step: 3,
        name: 'sync_values',
        status: 'error',
        error: error.message,
      });
      throw error;
    }

    try {
      console.log('\n--- STEP 4: Build Top-1000 Rankings ---');
      const step4Start = Date.now();
      const buildResult = await callFunction('build-top-1000', cronSecret!);
      const step4Duration = Date.now() - step4Start;

      pipeline.steps.push({
        step: 4,
        name: 'build_top_1000',
        status: buildResult.success ? 'success' : 'failed',
        duration_ms: step4Duration,
        result: buildResult,
      });

      console.log(`Top-1000 built: ${buildResult.processed} players processed`);
    } catch (error) {
      pipeline.steps.push({
        step: 4,
        name: 'build_top_1000',
        status: 'warning',
        error: error.message,
      });
      console.warn('Top-1000 build had issues:', error);
    }

    try {
      console.log('\n--- STEP 5: Compute Market Trends ---');
      const step3Start = Date.now();

      const { data: trendData, error: trendError } = await supabase.rpc('execute_sql', {
        query: `
          WITH recent_values AS (
            SELECT
              player_id,
              ktc_value,
              captured_at,
              LAG(ktc_value) OVER (PARTITION BY player_id ORDER BY captured_at) as prev_value
            FROM ktc_value_snapshots
            WHERE format = 'dynasty_sf'
              AND captured_at >= NOW() - INTERVAL '30 days'
          )
          SELECT
            player_id,
            COUNT(*) as snapshot_count,
            AVG(ktc_value) as avg_value,
            MAX(ktc_value) - MIN(ktc_value) as value_range
          FROM recent_values
          GROUP BY player_id
          HAVING COUNT(*) > 1
        `,
      });

      const step5Duration = Date.now() - step3Start;

      pipeline.steps.push({
        step: 5,
        name: 'compute_trends',
        status: trendError ? 'failed' : 'success',
        duration_ms: step5Duration,
        result: {
          trends_computed: trendData?.length || 0,
        },
      });

      console.log(`Trends computed for ${trendData?.length || 0} players`);
    } catch (error) {
      pipeline.steps.push({
        step: 5,
        name: 'compute_trends',
        status: 'warning',
        error: error.message,
      });
      console.warn('Trends computation had issues:', error);
    }

    try {
      console.log('\n--- STEP 6: Health Check ---');
      const step6Start = Date.now();

      const { data: playerFreshness } = await supabase
        .from('nfl_players')
        .select('last_seen_at')
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: valueFreshness } = await supabase
        .from('ktc_value_snapshots')
        .select('captured_at')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unresolvedCount } = await supabase
        .from('unresolved_entities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      const step6Duration = Date.now() - step6Start;

      const health = {
        players_last_sync: playerFreshness?.last_seen_at,
        values_last_sync: valueFreshness?.captured_at,
        unresolved_count: unresolvedCount || 0,
      };

      pipeline.steps.push({
        step: 6,
        name: 'health_check',
        status: 'success',
        duration_ms: step6Duration,
        result: health,
      });

      console.log('Health check:', health);
    } catch (error) {
      pipeline.steps.push({
        step: 6,
        name: 'health_check',
        status: 'warning',
        error: error.message,
      });
      console.warn('Health check had issues:', error);
    }

    pipeline.total_duration_ms = Date.now() - startTime;
    pipeline.completed_at = new Date().toISOString();

    console.log('\n=== PIPELINE COMPLETE ===');
    console.log(`Total duration: ${pipeline.total_duration_ms}ms`);
    console.log(`Success: ${pipeline.success}`);

    return new Response(
      JSON.stringify({
        success: pipeline.success,
        ...pipeline,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Pipeline error:', error);
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
