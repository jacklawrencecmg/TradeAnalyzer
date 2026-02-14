import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface HealthCheckResult {
  check_name: string;
  status: 'ok' | 'warning' | 'critical';
  message: string;
  meta?: Record<string, any>;
}

async function runHealthCheck(
  supabase: any,
  checkName: string,
  checkFn: () => Promise<HealthCheckResult>
): Promise<HealthCheckResult> {
  try {
    const result = await checkFn();

    await supabase.from('system_health_checks').insert({
      check_name: result.check_name,
      status: result.status,
      message: result.message,
      meta: result.meta || {},
      checked_at: new Date().toISOString(),
    });

    if (result.status === 'ok') {
      await supabase.rpc('resolve_alerts_by_check', {
        p_check_name: result.check_name,
      });
    } else if (result.status === 'warning' || result.status === 'critical') {
      await supabase.rpc('create_alert_from_check', {
        p_check_name: result.check_name,
        p_status: result.status,
        p_message: result.message,
        p_meta: result.meta || {},
      });
    }

    return result;
  } catch (err) {
    console.error(`Error running check ${checkName}:`, err);
    return {
      check_name: checkName,
      status: 'warning',
      message: 'Health check failed to execute',
      meta: { error: String(err) },
    };
  }
}

async function checkPlayerSyncFreshness(supabase: any): Promise<HealthCheckResult> {
  const { data, error } = await supabase
    .from('player_events')
    .select('created_at')
    .eq('event_type', 'player_sync_completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      check_name: 'player_sync_freshness',
      status: 'warning',
      message: 'Unable to check player sync status',
      meta: { error: error.message },
    };
  }

  if (!data) {
    return {
      check_name: 'player_sync_freshness',
      status: 'critical',
      message: 'No player sync has ever been recorded',
      meta: { last_sync: null },
    };
  }

  const lastSync = new Date(data.created_at);
  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

  if (hoursSinceSync > 26) {
    return {
      check_name: 'player_sync_freshness',
      status: 'critical',
      message: `Player sync is ${Math.round(hoursSinceSync)} hours old (threshold: 26 hours)`,
      meta: { last_sync: lastSync.toISOString(), hours_old: hoursSinceSync },
    };
  }

  if (hoursSinceSync > 20) {
    return {
      check_name: 'player_sync_freshness',
      status: 'warning',
      message: `Player sync is ${Math.round(hoursSinceSync)} hours old`,
      meta: { last_sync: lastSync.toISOString(), hours_old: hoursSinceSync },
    };
  }

  return {
    check_name: 'player_sync_freshness',
    status: 'ok',
    message: `Player sync is fresh (${Math.round(hoursSinceSync)} hours old)`,
    meta: { last_sync: lastSync.toISOString(), hours_old: hoursSinceSync },
  };
}

async function checkValueSnapshotFreshness(supabase: any): Promise<HealthCheckResult> {
  const { data, error } = await supabase
    .from('ktc_value_snapshots')
    .select('captured_at')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      check_name: 'value_snapshot_freshness',
      status: 'warning',
      message: 'Unable to check value snapshot status',
      meta: { error: error.message },
    };
  }

  if (!data) {
    return {
      check_name: 'value_snapshot_freshness',
      status: 'critical',
      message: 'No value snapshots exist',
      meta: { last_snapshot: null },
    };
  }

  const lastSnapshot = new Date(data.captured_at);
  const hoursSinceSnapshot = (Date.now() - lastSnapshot.getTime()) / (1000 * 60 * 60);

  if (hoursSinceSnapshot > 18) {
    return {
      check_name: 'value_snapshot_freshness',
      status: 'critical',
      message: `Value snapshots are ${Math.round(hoursSinceSnapshot)} hours old (threshold: 18 hours)`,
      meta: { last_snapshot: lastSnapshot.toISOString(), hours_old: hoursSinceSnapshot },
    };
  }

  if (hoursSinceSnapshot > 14) {
    return {
      check_name: 'value_snapshot_freshness',
      status: 'warning',
      message: `Value snapshots are ${Math.round(hoursSinceSnapshot)} hours old`,
      meta: { last_snapshot: lastSnapshot.toISOString(), hours_old: hoursSinceSnapshot },
    };
  }

  return {
    check_name: 'value_snapshot_freshness',
    status: 'ok',
    message: `Value snapshots are fresh (${Math.round(hoursSinceSnapshot)} hours old)`,
    meta: { last_snapshot: lastSnapshot.toISOString(), hours_old: hoursSinceSnapshot },
  };
}

async function checkDatabaseConnectivity(supabase: any): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const { error } = await supabase.from('nfl_players').select('id').limit(1);
  const responseTime = Date.now() - startTime;

  if (error) {
    return {
      check_name: 'database_connectivity',
      status: 'critical',
      message: 'Database query failed',
      meta: { error: error.message },
    };
  }

  if (responseTime > 5000) {
    return {
      check_name: 'database_connectivity',
      status: 'warning',
      message: `Database response time is slow (${responseTime}ms)`,
      meta: { response_time_ms: responseTime },
    };
  }

  return {
    check_name: 'database_connectivity',
    status: 'ok',
    message: `Database is responding normally (${responseTime}ms)`,
    meta: { response_time_ms: responseTime },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Running system health checks...');

    const checks: HealthCheckResult[] = [];

    checks.push(await runHealthCheck(supabase, 'database_connectivity', () =>
      checkDatabaseConnectivity(supabase)
    ));

    checks.push(await runHealthCheck(supabase, 'player_sync_freshness', () =>
      checkPlayerSyncFreshness(supabase)
    ));

    checks.push(await runHealthCheck(supabase, 'value_snapshot_freshness', () =>
      checkValueSnapshotFreshness(supabase)
    ));

    const criticalCount = checks.filter(c => c.status === 'critical').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const okCount = checks.filter(c => c.status === 'ok').length;

    console.log(`Health checks complete: ${okCount} OK, ${warningCount} warnings, ${criticalCount} critical`);

    if (criticalCount > 0) {
      await supabase.rpc('enable_safe_mode', {
        p_reason: `${criticalCount} critical health check(s) failed`,
      });
      console.log('Safe mode enabled due to critical issues');
    } else {
      await supabase.rpc('disable_safe_mode');
    }

    if (criticalCount > 0 || warningCount > 0) {
      await supabase.from('player_events').insert({
        event_type: 'health_check_failed',
        metadata: {
          critical_count: criticalCount,
          warning_count: warningCount,
          failed_checks: checks
            .filter(c => c.status !== 'ok')
            .map(c => ({ name: c.check_name, status: c.status, message: c.message })),
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        overall_status: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
        checks,
        critical_count: criticalCount,
        warning_count: warningCount,
        ok_count: okCount,
        checked_at: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('Error running health checks:', err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err),
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
