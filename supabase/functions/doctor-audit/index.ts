import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid ADMIN_SYNC_SECRET' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🏥 Running Doctor Audit...');

    // Run all audit checks
    const findings: any[] = [];

    // Check 1: Canonical tables exist
    const { data: tables } = await supabase.rpc('execute_sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('nfl_players', 'player_aliases', 'player_team_history',
                             'ktc_value_snapshots', 'unresolved_entities');
      `,
    });

    const existingTables = tables?.map((t: any) => t.table_name) || [];
    const requiredTables = ['nfl_players', 'player_aliases', 'player_team_history',
                            'ktc_value_snapshots', 'unresolved_entities'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      findings.push({
        id: 'canonical_missing_tables',
        severity: 'critical',
        title: 'Missing Canonical Tables',
        details: `Required tables not found: ${missingTables.join(', ')}`,
        fix_available: false,
      });
    } else {
      findings.push({
        id: 'canonical_tables_exist',
        severity: 'pass',
        title: 'All Canonical Tables Exist',
        details: 'All required tables are present',
        fix_available: false,
      });
    }

    // Check 2: Values freshness
    const { data: freshness } = await supabase.rpc('execute_sql', {
      query: 'SELECT MAX(captured_at) as last_capture FROM ktc_value_snapshots;',
    });

    if (freshness && freshness[0]?.last_capture) {
      const lastCapture = new Date(freshness[0].last_capture);
      const hoursSince = (Date.now() - lastCapture.getTime()) / (1000 * 60 * 60);

      if (hoursSince > 48) {
        findings.push({
          id: 'values_stale',
          severity: 'critical',
          title: 'Values Are Stale',
          details: `Last capture ${hoursSince.toFixed(1)} hours ago (threshold: 48h)`,
          fix_available: true,
          metadata: { hours_old: hoursSince },
        });
      } else {
        findings.push({
          id: 'values_fresh',
          severity: 'pass',
          title: 'Values Are Fresh',
          details: `Last capture ${hoursSince.toFixed(1)} hours ago`,
          fix_available: false,
        });
      }
    }

    // Check 3: Unresolved entities
    const { count: unresolvedCount } = await supabase
      .from('unresolved_entities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    if ((unresolvedCount || 0) > 100) {
      findings.push({
        id: 'high_unresolved',
        severity: 'critical',
        title: 'High Unresolved Entity Count',
        details: `${unresolvedCount} entities unresolved (threshold: 100)`,
        fix_available: true,
        metadata: { count: unresolvedCount },
      });
    } else if ((unresolvedCount || 0) > 50) {
      findings.push({
        id: 'moderate_unresolved',
        severity: 'warning',
        title: 'Moderate Unresolved Count',
        details: `${unresolvedCount} entities unresolved`,
        fix_available: true,
      });
    } else {
      findings.push({
        id: 'low_unresolved',
        severity: 'pass',
        title: 'Unresolved Entities Under Control',
        details: `${unresolvedCount} unresolved`,
        fix_available: false,
      });
    }

    // Check 4: Position coverage
    const { data: coverage } = await supabase.rpc('execute_sql', {
      query: `
        WITH latest AS (
          SELECT DISTINCT ON (player_id) position
          FROM ktc_value_snapshots
          WHERE format = 'dynasty_sf'
            AND captured_at >= NOW() - INTERVAL '48 hours'
          ORDER BY player_id, captured_at DESC
        )
        SELECT position, COUNT(*) as count
        FROM latest
        GROUP BY position;
      `,
    });

    const thresholds: Record<string, number> = {
      QB: 60,
      RB: 150,
      WR: 200,
      TE: 80,
    };

    const coverageMap = new Map(coverage?.map((c: any) => [c.position, parseInt(c.count)]) || []);
    const issues: string[] = [];

    for (const [pos, threshold] of Object.entries(thresholds)) {
      const count = coverageMap.get(pos) || 0;
      if (count < threshold) {
        issues.push(`${pos}: ${count}/${threshold}`);
      }
    }

    if (issues.length > 0) {
      findings.push({
        id: 'coverage_insufficient',
        severity: 'critical',
        title: 'Insufficient Position Coverage',
        details: `Below thresholds: ${issues.join(', ')}`,
        fix_available: true,
      });
    } else {
      findings.push({
        id: 'coverage_sufficient',
        severity: 'pass',
        title: 'Position Coverage Adequate',
        details: 'All positions meet minimums',
        fix_available: false,
      });
    }

    // Check 5: Orphaned snapshots
    const { data: orphaned } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as count
        FROM ktc_value_snapshots kvs
        LEFT JOIN nfl_players np ON np.external_id = kvs.player_id
        WHERE np.id IS NULL
          AND kvs.captured_at >= NOW() - INTERVAL '7 days';
      `,
    });

    const orphanCount = orphaned?.[0]?.count || 0;

    if (orphanCount > 50) {
      findings.push({
        id: 'orphaned_snapshots',
        severity: 'critical',
        title: 'Orphaned Snapshots Detected',
        details: `${orphanCount} snapshots without matching players`,
        fix_available: true,
      });
    } else if (orphanCount > 10) {
      findings.push({
        id: 'some_orphaned',
        severity: 'warning',
        title: 'Some Orphaned Snapshots',
        details: `${orphanCount} orphaned snapshots`,
        fix_available: true,
      });
    } else {
      findings.push({
        id: 'no_orphans',
        severity: 'pass',
        title: 'No Orphaned Snapshots',
        details: 'All snapshots have matching players',
        fix_available: false,
      });
    }

    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      warning: findings.filter(f => f.severity === 'warning').length,
      passed: findings.filter(f => f.severity === 'pass').length,
    };

    const ok = summary.critical === 0;

    // If critical issues, enable safe mode
    if (summary.critical > 0) {
      await supabase.rpc('enable_safe_mode', {
        p_reason: `${summary.critical} critical issues detected by Doctor audit`,
        p_issues: findings.filter(f => f.severity === 'critical'),
      });
    } else {
      await supabase.rpc('disable_safe_mode');
    }

    console.log(`✅ Audit complete: ${summary.passed} passed, ${summary.warning} warnings, ${summary.critical} critical`);

    return new Response(
      JSON.stringify({
        ok,
        summary,
        findings,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Audit failed:', error);

    return new Response(
      JSON.stringify({
        error: String(error),
        ok: false,
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
