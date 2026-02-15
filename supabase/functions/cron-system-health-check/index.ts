/**
 * System Health Check Cron Job
 *
 * Runs comprehensive health checks:
 * 1. Value integrity validation
 * 2. Market drift detection
 * 3. Rebuild status check
 * 4. Generate daily health report
 *
 * Run daily at 6 AM
 */

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results = {
      valueIntegrity: null as any,
      marketDrift: null as any,
      rebuildStatus: null as any,
      healthReport: null as any,
      actions: [] as string[],
    };

    console.log('Starting system health checks...');

    // 1. Value Integrity Check
    console.log('1. Running value integrity check...');
    try {
      const integrityResult = await checkValueIntegrity(supabase);
      results.valueIntegrity = integrityResult;

      if (integrityResult.status === 'critical') {
        results.actions.push('CRITICAL: Value integrity failed - safe mode activated');
        await activateSafeMode(supabase, 'value_integrity_failed', integrityResult);
      }
    } catch (error) {
      console.error('Value integrity check failed:', error);
      results.valueIntegrity = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 2. Market Drift Check
    console.log('2. Running market drift check...');
    try {
      const driftResult = await checkMarketDrift(supabase);
      results.marketDrift = driftResult;

      if (driftResult.status === 'critical') {
        results.actions.push('CRITICAL: Market drift exceeded threshold');
      }
    } catch (error) {
      console.error('Market drift check failed:', error);
      results.marketDrift = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 3. Rebuild Status Check
    console.log('3. Checking rebuild status...');
    try {
      const rebuildResult = await checkRebuildStatus(supabase);
      results.rebuildStatus = rebuildResult;

      if (rebuildResult.isStale) {
        results.actions.push('WARNING: Rebuild is stale - should trigger automatic rebuild');
      }

      if (rebuildResult.consecutiveFailures >= 2) {
        results.actions.push('CRITICAL: Multiple rebuild failures - values locked');
        await activateSafeMode(supabase, 'rebuild_failures', rebuildResult);
      }
    } catch (error) {
      console.error('Rebuild status check failed:', error);
      results.rebuildStatus = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 4. Generate Health Report
    console.log('4. Generating daily health report...');
    try {
      const healthReport = await generateHealthReport(supabase, results);
      results.healthReport = healthReport;
    } catch (error) {
      console.error('Health report generation failed:', error);
      results.healthReport = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    console.log('Health checks complete!');

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in health check:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

async function checkValueIntegrity(supabase: any) {
  const checks = [];

  // Check coverage
  const { count: dynastyCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', 'dynasty')
    .not('fdp_value', 'is', null);

  checks.push({
    name: 'dynasty_coverage',
    passed: (dynastyCount || 0) >= 900,
    value: dynastyCount,
    threshold: 900,
  });

  // Check QB count
  const { count: qbCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('position', 'QB')
    .not('fdp_value', 'is', null);

  checks.push({
    name: 'qb_minimum',
    passed: (qbCount || 0) >= 40,
    value: qbCount,
    threshold: 40,
  });

  // Check max value
  const { data: maxValueData } = await supabase
    .from('player_values')
    .select('fdp_value')
    .order('fdp_value', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxValue = maxValueData?.fdp_value || 0;

  checks.push({
    name: 'max_value_sanity',
    passed: maxValue <= 10000,
    value: maxValue,
    threshold: 10000,
  });

  const allPassed = checks.every((c) => c.passed);
  const status = allPassed ? 'ok' : 'critical';

  // Record check
  await supabase.from('system_health_checks').insert({
    check_name: 'value_integrity',
    status,
    meta: { checks },
    checked_at: new Date().toISOString(),
  });

  return {
    status,
    passed: allPassed,
    checks,
  };
}

async function checkMarketDrift(supabase: any) {
  const { data: players } = await supabase
    .from('player_values')
    .select('player_id, fdp_value, market_rank')
    .eq('format', 'dynasty')
    .not('market_rank', 'is', null)
    .not('fdp_value', 'is', null)
    .order('fdp_value', { ascending: false })
    .limit(500);

  if (!players || players.length === 0) {
    return {
      status: 'critical',
      avgDrift: 0,
      message: 'No players with market ranks found',
    };
  }

  const drifts = players.map((p, index) => Math.abs(index + 1 - p.market_rank));
  const avgDrift = drifts.reduce((sum, d) => sum + d, 0) / drifts.length;

  let status = 'ok';
  if (avgDrift > 140) status = 'critical';
  else if (avgDrift > 85) status = 'warning';

  // Record check
  await supabase.from('system_health_checks').insert({
    check_name: 'market_drift',
    status,
    meta: { avgDrift, playersChecked: players.length },
    checked_at: new Date().toISOString(),
  });

  return {
    status,
    avgDrift: Math.round(avgDrift * 10) / 10,
    playersChecked: players.length,
  };
}

async function checkRebuildStatus(supabase: any) {
  const { data: latestRebuild } = await supabase
    .from('rebuild_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRebuild) {
    return {
      isStale: true,
      consecutiveFailures: 0,
      message: 'No rebuild history found',
    };
  }

  const lastSuccessful = latestRebuild.last_successful_rebuild;
  const hoursSinceSuccess = lastSuccessful
    ? (Date.now() - new Date(lastSuccessful).getTime()) / (1000 * 60 * 60)
    : null;

  const isStale = hoursSinceSuccess ? hoursSinceSuccess > 36 : true;

  // Get consecutive failures
  const { data: recentBuilds } = await supabase
    .from('rebuild_status')
    .select('status')
    .order('created_at', { ascending: false })
    .limit(10);

  let consecutiveFailures = 0;
  for (const build of recentBuilds || []) {
    if (build.status === 'failed') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  return {
    isStale,
    hoursSinceSuccess,
    consecutiveFailures,
    lastStatus: latestRebuild.status,
  };
}

async function generateHealthReport(supabase: any, checkResults: any) {
  const healthReport = {
    date: new Date().toISOString(),
    overallStatus: 'healthy',
    checks: checkResults,
  };

  // Determine overall status
  if (
    checkResults.valueIntegrity?.status === 'critical' ||
    checkResults.marketDrift?.status === 'critical' ||
    checkResults.rebuildStatus?.consecutiveFailures >= 2
  ) {
    healthReport.overallStatus = 'critical';
  } else if (
    checkResults.marketDrift?.status === 'warning' ||
    checkResults.rebuildStatus?.isStale
  ) {
    healthReport.overallStatus = 'degraded';
  }

  // Store report
  await supabase.from('system_health_checks').insert({
    check_name: 'daily_health_report',
    status: healthReport.overallStatus === 'healthy' ? 'ok' : healthReport.overallStatus === 'degraded' ? 'warning' : 'critical',
    meta: healthReport,
    checked_at: new Date().toISOString(),
  });

  return healthReport;
}

async function activateSafeMode(supabase: any, reason: string, details: any) {
  try {
    const { data: existingMode } = await supabase
      .from('system_safe_mode')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingMode) {
      await supabase
        .from('system_safe_mode')
        .update({
          enabled: true,
          reason,
          critical_issues: details,
          enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMode.id);
    } else {
      await supabase.from('system_safe_mode').insert({
        enabled: true,
        reason,
        critical_issues: details,
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Create alert
    await supabase.from('system_alerts').insert({
      severity: 'critical',
      message: `Safe mode activated: ${reason}`,
      alert_type: 'safe_mode_activated',
      metadata: details,
    });

    console.error('SAFE MODE ACTIVATED:', reason);
  } catch (error) {
    console.error('Error activating safe mode:', error);
  }
}
