import { supabase } from '../supabase';

export interface HealthCheckResult {
  check_name: string;
  status: 'ok' | 'warning' | 'critical';
  message: string;
  meta?: Record<string, any>;
}

export interface SystemHealthSummary {
  overall_status: 'ok' | 'warning' | 'critical';
  checks: HealthCheckResult[];
  critical_count: number;
  warning_count: number;
  ok_count: number;
  checked_at: string;
}

async function checkPlayerSyncFreshness(): Promise<HealthCheckResult> {
  try {
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
  } catch (err) {
    return {
      check_name: 'player_sync_freshness',
      status: 'warning',
      message: 'Error checking player sync freshness',
      meta: { error: String(err) },
    };
  }
}

async function checkValueSnapshotFreshness(): Promise<HealthCheckResult> {
  try {
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
  } catch (err) {
    return {
      check_name: 'value_snapshot_freshness',
      status: 'warning',
      message: 'Error checking value snapshot freshness',
      meta: { error: String(err) },
    };
  }
}

async function checkPositionCoverage(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          player_position,
          COUNT(*) as count
        FROM nfl_players
        WHERE status IN ('Active', 'Practice Squad', 'Injured Reserve')
        GROUP BY player_position
      `,
    });

    if (error) {
      return {
        check_name: 'position_coverage',
        status: 'warning',
        message: 'Unable to check position coverage',
        meta: { error: error.message },
      };
    }

    const counts: Record<string, number> = {};
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        counts[row.player_position] = parseInt(row.count);
      });
    }

    const thresholds = {
      QB: 60,
      RB: 150,
      WR: 200,
      TE: 80,
    };

    const issues: string[] = [];
    let hasWarning = false;

    Object.entries(thresholds).forEach(([position, threshold]) => {
      const count = counts[position] || 0;
      if (count < threshold) {
        issues.push(`${position}: ${count} (expected >=${threshold})`);
        hasWarning = true;
      }
    });

    if (hasWarning) {
      return {
        check_name: 'position_coverage',
        status: 'warning',
        message: `Low player count for positions: ${issues.join(', ')}`,
        meta: { counts, thresholds, issues },
      };
    }

    return {
      check_name: 'position_coverage',
      status: 'ok',
      message: 'All positions have adequate player coverage',
      meta: { counts },
    };
  } catch (err) {
    return {
      check_name: 'position_coverage',
      status: 'warning',
      message: 'Error checking position coverage',
      meta: { error: String(err) },
    };
  }
}

async function checkMissingTeamHistory(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*)::int as missing_count
        FROM nfl_players np
        WHERE np.team IS NOT NULL
          AND np.status IN ('Active', 'Practice Squad', 'Injured Reserve')
          AND NOT EXISTS (
            SELECT 1 FROM player_team_history pth
            WHERE pth.player_id = np.id
          )
      `,
    });

    if (error) {
      return {
        check_name: 'missing_team_history',
        status: 'warning',
        message: 'Unable to check team history coverage',
        meta: { error: error.message },
      };
    }

    const missingCount = data?.[0]?.missing_count || 0;

    if (missingCount > 50) {
      return {
        check_name: 'missing_team_history',
        status: 'warning',
        message: `${missingCount} active players are missing team history records`,
        meta: { missing_count: missingCount },
      };
    }

    if (missingCount > 0) {
      return {
        check_name: 'missing_team_history',
        status: 'ok',
        message: `${missingCount} players missing team history (below threshold)`,
        meta: { missing_count: missingCount },
      };
    }

    return {
      check_name: 'missing_team_history',
      status: 'ok',
      message: 'All active players have team history records',
      meta: { missing_count: 0 },
    };
  } catch (err) {
    return {
      check_name: 'missing_team_history',
      status: 'warning',
      message: 'Error checking team history coverage',
      meta: { error: String(err) },
    };
  }
}

async function checkUnresolvedPlayersQueue(): Promise<HealthCheckResult> {
  try {
    const { data: unresolvedData, error: unresolvedError } = await supabase
      .from('unresolved_entities')
      .select('id', { count: 'exact', head: true });

    if (unresolvedError) {
      return {
        check_name: 'unresolved_players_queue',
        status: 'warning',
        message: 'Unable to check unresolved players queue',
        meta: { error: unresolvedError.message },
      };
    }

    const unresolvedCount = unresolvedData || 0;

    if (unresolvedCount > 100) {
      return {
        check_name: 'unresolved_players_queue',
        status: 'critical',
        message: `${unresolvedCount} unresolved player entities (threshold: 100)`,
        meta: { unresolved_count: unresolvedCount },
      };
    }

    if (unresolvedCount > 25) {
      return {
        check_name: 'unresolved_players_queue',
        status: 'warning',
        message: `${unresolvedCount} unresolved player entities`,
        meta: { unresolved_count: unresolvedCount },
      };
    }

    return {
      check_name: 'unresolved_players_queue',
      status: 'ok',
      message: `${unresolvedCount} unresolved player entities (normal)`,
      meta: { unresolved_count: unresolvedCount },
    };
  } catch (err) {
    return {
      check_name: 'unresolved_players_queue',
      status: 'warning',
      message: 'Error checking unresolved players queue',
      meta: { error: String(err) },
    };
  }
}

async function checkScraperFailures(): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabase
      .from('player_events')
      .select('metadata')
      .eq('event_type', 'player_sync_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        check_name: 'scraper_failures',
        status: 'warning',
        message: 'Unable to check scraper status',
        meta: { error: error.message },
      };
    }

    if (!data || !data.metadata) {
      return {
        check_name: 'scraper_failures',
        status: 'warning',
        message: 'No sync metadata available',
        meta: {},
      };
    }

    const metadata = data.metadata as any;
    const inserted = metadata.inserted || 0;
    const updated = metadata.updated || 0;
    const total = inserted + updated;

    if (total === 0 && inserted === 0) {
      return {
        check_name: 'scraper_failures',
        status: 'critical',
        message: 'Last player sync inserted 0 rows - scraper may be broken',
        meta: { inserted, updated, total },
      };
    }

    if (inserted === 0 && updated < 50) {
      return {
        check_name: 'scraper_failures',
        status: 'warning',
        message: `Last sync updated only ${updated} players - may indicate issues`,
        meta: { inserted, updated, total },
      };
    }

    return {
      check_name: 'scraper_failures',
      status: 'ok',
      message: `Last sync processed ${total} players (${inserted} new, ${updated} updated)`,
      meta: { inserted, updated, total },
    };
  } catch (err) {
    return {
      check_name: 'scraper_failures',
      status: 'warning',
      message: 'Error checking scraper status',
      meta: { error: String(err) },
    };
  }
}

async function checkDatabaseConnectivity(): Promise<HealthCheckResult> {
  try {
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
  } catch (err) {
    return {
      check_name: 'database_connectivity',
      status: 'critical',
      message: 'Unable to connect to database',
      meta: { error: String(err) },
    };
  }
}

async function storeHealthCheckResult(result: HealthCheckResult): Promise<void> {
  try {
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
  } catch (err) {
    console.error('Error storing health check result:', err);
  }
}

export async function runSystemHealthChecks(): Promise<SystemHealthSummary> {
  const checks: HealthCheckResult[] = [];

  const checkFunctions = [
    checkDatabaseConnectivity,
    checkPlayerSyncFreshness,
    checkValueSnapshotFreshness,
    checkPositionCoverage,
    checkMissingTeamHistory,
    checkUnresolvedPlayersQueue,
    checkScraperFailures,
  ];

  for (const checkFn of checkFunctions) {
    try {
      const result = await checkFn();
      checks.push(result);
      await storeHealthCheckResult(result);
    } catch (err) {
      console.error(`Error running health check ${checkFn.name}:`, err);
      checks.push({
        check_name: checkFn.name,
        status: 'warning',
        message: 'Health check failed to execute',
        meta: { error: String(err) },
      });
    }
  }

  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const okCount = checks.filter(c => c.status === 'ok').length;

  const overallStatus: 'ok' | 'warning' | 'critical' =
    criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok';

  if (criticalCount > 0) {
    await supabase.rpc('enable_safe_mode', {
      p_reason: `${criticalCount} critical health check(s) failed`,
    });
  } else {
    await supabase.rpc('disable_safe_mode');
  }

  return {
    overall_status: overallStatus,
    checks,
    critical_count: criticalCount,
    warning_count: warningCount,
    ok_count: okCount,
    checked_at: new Date().toISOString(),
  };
}

export async function getSystemHealthStatus(): Promise<SystemHealthSummary | null> {
  try {
    const { data, error } = await supabase.from('current_system_health').select('*');

    if (error || !data) {
      return null;
    }

    const checks: HealthCheckResult[] = data.map((row: any) => ({
      check_name: row.check_name,
      status: row.status,
      message: row.message,
      meta: row.meta,
    }));

    const criticalCount = checks.filter(c => c.status === 'critical').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const okCount = checks.filter(c => c.status === 'ok').length;

    const overallStatus: 'ok' | 'warning' | 'critical' =
      criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok';

    return {
      overall_status: overallStatus,
      checks,
      critical_count: criticalCount,
      warning_count: warningCount,
      ok_count: okCount,
      checked_at: data[0]?.checked_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error getting system health status:', err);
    return null;
  }
}

export async function isSafeMode(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_system_safe_mode');

    if (error) {
      return false;
    }

    return data || false;
  } catch (err) {
    console.error('Error checking safe mode:', err);
    return false;
  }
}
