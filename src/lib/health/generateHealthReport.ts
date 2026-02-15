/**
 * Daily Health Report Generator
 *
 * Generates comprehensive health report showing:
 * - Rebuild status
 * - Player coverage
 * - Drift score
 * - Prediction accuracy trend
 * - Advice success rate
 * - System alerts
 */

import { supabase } from '../supabase';
import { getLatestRebuildStatus } from './rebuildWatchdog';
import { getLatestDriftCheck } from './detectMarketDrift';
import { getLatestValidation } from './validateLatestValues';
import { getValidationStatistics } from './runtimeValidation';

export interface HealthReport {
  date: string;
  overall: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number; // 0-100
    message: string;
  };
  rebuild: {
    status: string;
    lastSuccessful: string | null;
    hoursSinceSuccess: number | null;
    consecutiveFailures: number;
  };
  coverage: {
    totalPlayers: number;
    dynastyPlayers: number;
    redraftPlayers: number;
    byPosition: Record<string, number>;
  };
  drift: {
    avgDrift: number;
    status: string;
    topDrifters: number;
  };
  validation: {
    integrityStatus: string;
    runtimeFailureRate: number;
    totalSamples: number;
  };
  alerts: {
    critical: number;
    warnings: number;
    recent: Array<{
      severity: string;
      message: string;
      type: string;
      createdAt: string;
    }>;
  };
  performance: {
    predictionAccuracy: number | null;
    adviceSuccessRate: number | null;
    tradeSuccessRate: number | null;
  };
}

/**
 * Generate health report
 */
export async function generateHealthReport(): Promise<HealthReport> {
  try {
    // 1. Rebuild status
    const rebuildStatus = await getLatestRebuildStatus();
    const consecutiveFailures = await getConsecutiveFailures();

    // 2. Player coverage
    const coverage = await getPlayerCoverage();

    // 3. Drift score
    const driftCheck = await getLatestDriftCheck();

    // 4. Validation status
    const validation = await getLatestValidation();
    const runtimeStats = await getValidationStatistics(24);

    // 5. System alerts
    const alerts = await getSystemAlerts();

    // 6. Performance metrics (if available)
    const performance = await getPerformanceMetrics();

    // Calculate overall health score
    const healthScore = calculateHealthScore({
      rebuild: rebuildStatus,
      consecutiveFailures,
      coverage,
      drift: driftCheck,
      validation,
      runtimeStats,
      alerts,
    });

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'All systems operational';

    if (healthScore < 50) {
      overallStatus = 'critical';
      message = 'Critical system issues detected';
    } else if (healthScore < 75) {
      overallStatus = 'degraded';
      message = 'System health degraded';
    }

    const report: HealthReport = {
      date: new Date().toISOString(),
      overall: {
        status: overallStatus,
        score: healthScore,
        message,
      },
      rebuild: {
        status: rebuildStatus?.status || 'unknown',
        lastSuccessful: rebuildStatus?.lastSuccessful || null,
        hoursSinceSuccess: rebuildStatus?.hoursSinceSuccess || null,
        consecutiveFailures,
      },
      coverage: {
        totalPlayers: coverage.total,
        dynastyPlayers: coverage.dynasty,
        redraftPlayers: coverage.redraft,
        byPosition: coverage.byPosition,
      },
      drift: {
        avgDrift: driftCheck?.avgDrift || 0,
        status: driftCheck?.status || 'unknown',
        topDrifters: driftCheck?.topDrifters?.length || 0,
      },
      validation: {
        integrityStatus: validation?.status || 'unknown',
        runtimeFailureRate: runtimeStats.failureRate,
        totalSamples: runtimeStats.totalSamples,
      },
      alerts: {
        critical: alerts.critical,
        warnings: alerts.warnings,
        recent: alerts.recent,
      },
      performance: {
        predictionAccuracy: performance.predictionAccuracy,
        adviceSuccessRate: performance.adviceSuccessRate,
        tradeSuccessRate: performance.tradeSuccessRate,
      },
    };

    // Store report
    await storeHealthReport(report);

    return report;
  } catch (error) {
    console.error('Error generating health report:', error);
    throw error;
  }
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(data: any): number {
  let score = 100;

  // Rebuild health (30 points)
  if (data.consecutiveFailures >= 2) {
    score -= 30;
  } else if (data.consecutiveFailures === 1) {
    score -= 15;
  } else if (data.rebuild?.isStale) {
    score -= 10;
  }

  // Coverage (20 points)
  if (data.coverage.total < 900) {
    score -= 20;
  } else if (data.coverage.total < 1000) {
    score -= 10;
  }

  // Drift (20 points)
  if (data.drift?.status === 'critical') {
    score -= 20;
  } else if (data.drift?.status === 'warning') {
    score -= 10;
  }

  // Validation (15 points)
  if (data.validation?.status === 'critical') {
    score -= 15;
  } else if (data.validation?.status === 'warning') {
    score -= 7;
  }

  // Runtime validation (10 points)
  if (data.runtimeStats.failureRate > 10) {
    score -= 10;
  } else if (data.runtimeStats.failureRate > 5) {
    score -= 5;
  }

  // Alerts (5 points)
  if (data.alerts.critical > 0) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get player coverage
 */
async function getPlayerCoverage(): Promise<{
  total: number;
  dynasty: number;
  redraft: number;
  byPosition: Record<string, number>;
}> {
  const { count: total } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .not('fdp_value', 'is', null);

  const { count: dynasty } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', 'dynasty')
    .not('fdp_value', 'is', null);

  const { count: redraft } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', 'redraft')
    .not('fdp_value', 'is', null);

  const { data: positions } = await supabase
    .from('player_values')
    .select('position')
    .not('fdp_value', 'is', null);

  const byPosition: Record<string, number> = {};
  positions?.forEach((p) => {
    byPosition[p.position] = (byPosition[p.position] || 0) + 1;
  });

  return {
    total: total || 0,
    dynasty: dynasty || 0,
    redraft: redraft || 0,
    byPosition,
  };
}

/**
 * Get consecutive failures
 */
async function getConsecutiveFailures(): Promise<number> {
  const { data: recentBuilds } = await supabase
    .from('rebuild_status')
    .select('status')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentBuilds || recentBuilds.length === 0) return 0;

  let consecutiveFailures = 0;
  for (const build of recentBuilds) {
    if (build.status === 'failed') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  return consecutiveFailures;
}

/**
 * Get system alerts
 */
async function getSystemAlerts(): Promise<{
  critical: number;
  warnings: number;
  recent: Array<{
    severity: string;
    message: string;
    type: string;
    createdAt: string;
  }>;
}> {
  const { data: unresolvedAlerts } = await supabase
    .from('system_alerts')
    .select('*')
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  const critical = unresolvedAlerts?.filter((a) => a.severity === 'critical').length || 0;
  const warnings = unresolvedAlerts?.filter((a) => a.severity === 'warning').length || 0;

  const recent =
    unresolvedAlerts?.slice(0, 5).map((a) => ({
      severity: a.severity,
      message: a.message,
      type: a.alert_type,
      createdAt: a.created_at,
    })) || [];

  return {
    critical,
    warnings,
    recent,
  };
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(): Promise<{
  predictionAccuracy: number | null;
  adviceSuccessRate: number | null;
  tradeSuccessRate: number | null;
}> {
  try {
    // Try to get latest performance from model_performance_history
    const { data: performance } = await supabase
      .from('model_performance_history')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!performance) {
      return {
        predictionAccuracy: null,
        adviceSuccessRate: null,
        tradeSuccessRate: null,
      };
    }

    return {
      predictionAccuracy: parseFloat(performance.accuracy_score),
      adviceSuccessRate: parseFloat(performance.advice_score),
      tradeSuccessRate: parseFloat(performance.trade_score),
    };
  } catch (error) {
    return {
      predictionAccuracy: null,
      adviceSuccessRate: null,
      tradeSuccessRate: null,
    };
  }
}

/**
 * Store health report
 */
async function storeHealthReport(report: HealthReport): Promise<void> {
  try {
    // Store as health check
    await supabase.from('system_health_checks').insert({
      check_name: 'daily_health_report',
      status: report.overall.status === 'healthy' ? 'ok' : report.overall.status === 'degraded' ? 'warning' : 'critical',
      meta: report,
      checked_at: report.date,
    });
  } catch (error) {
    console.error('Error storing health report:', error);
  }
}

/**
 * Get health report history
 */
export async function getHealthReportHistory(days: number = 7): Promise<HealthReport[]> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: checks } = await supabase
      .from('system_health_checks')
      .select('meta, checked_at')
      .eq('check_name', 'daily_health_report')
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: false });

    if (!checks) return [];

    return checks.map((c) => c.meta as HealthReport);
  } catch (error) {
    console.error('Error getting health report history:', error);
    return [];
  }
}

/**
 * Format health report as text
 */
export function formatHealthReport(report: HealthReport): string {
  let text = `
=== DYNASTY DOMINATOR HEALTH REPORT ===
Date: ${new Date(report.date).toLocaleString()}

OVERALL HEALTH: ${report.overall.status.toUpperCase()} (Score: ${report.overall.score}/100)
${report.overall.message}

--- REBUILD STATUS ---
Status: ${report.rebuild.status}
Last Successful: ${report.rebuild.lastSuccessful || 'Never'}
Hours Since Success: ${report.rebuild.hoursSinceSuccess?.toFixed(1) || 'N/A'}
Consecutive Failures: ${report.rebuild.consecutiveFailures}

--- PLAYER COVERAGE ---
Total Players: ${report.coverage.totalPlayers}
Dynasty: ${report.coverage.dynastyPlayers}
Redraft: ${report.coverage.redraftPlayers}
Positions: QB=${report.coverage.byPosition.QB || 0}, RB=${report.coverage.byPosition.RB || 0}, WR=${report.coverage.byPosition.WR || 0}, TE=${report.coverage.byPosition.TE || 0}

--- MARKET DRIFT ---
Average Drift: ${report.drift.avgDrift} positions
Status: ${report.drift.status}

--- VALIDATION ---
Integrity: ${report.validation.integrityStatus}
Runtime Failure Rate: ${report.validation.runtimeFailureRate}%
Runtime Samples: ${report.validation.totalSamples}

--- ALERTS ---
Critical: ${report.alerts.critical}
Warnings: ${report.alerts.warnings}
${report.alerts.recent.length > 0 ? '\nRecent Alerts:\n' + report.alerts.recent.map(a => `  - [${a.severity}] ${a.message}`).join('\n') : 'No recent alerts'}

--- PERFORMANCE ---
Prediction Accuracy: ${report.performance.predictionAccuracy?.toFixed(1) || 'N/A'}%
Advice Success Rate: ${report.performance.adviceSuccessRate?.toFixed(1) || 'N/A'}%
Trade Success Rate: ${report.performance.tradeSuccessRate?.toFixed(1) || 'N/A'}%

=======================================
`;

  return text;
}
