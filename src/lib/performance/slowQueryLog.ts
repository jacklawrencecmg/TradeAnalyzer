/**
 * Slow Query Logging
 *
 * Log any request >300ms with full context for debugging.
 * Store in performance_logs table for analysis.
 *
 * Fields logged:
 * - endpoint
 * - query_time_ms
 * - query_name
 * - value_epoch
 * - league_profile_id
 * - parameters
 * - stack_trace (optional)
 */

import { supabase } from '../supabase';

const SLOW_QUERY_THRESHOLD_MS = 300;
const LOG_BATCH_SIZE = 100;

// In-memory buffer (flush periodically)
const logBuffer: PerformanceLog[] = [];

interface PerformanceLog {
  endpoint: string;
  queryTimeMs: number;
  queryName: string;
  valueEpoch?: string | null;
  leagueProfileId?: string | null;
  parameters?: Record<string, any>;
  stackTrace?: string;
  timestamp: string;
}

/**
 * Log slow query
 */
export function logSlowQuery(log: Omit<PerformanceLog, 'timestamp'>): void {
  if (log.queryTimeMs < SLOW_QUERY_THRESHOLD_MS) {
    return; // Not slow enough to log
  }

  const fullLog: PerformanceLog = {
    ...log,
    timestamp: new Date().toISOString(),
  };

  // Console warning
  console.warn(
    `🐢 Slow query: ${log.endpoint} - ${log.queryName} (${log.queryTimeMs}ms)`,
    log.parameters
  );

  // Add to buffer
  logBuffer.push(fullLog);

  // Auto-flush if buffer is full
  if (logBuffer.length >= LOG_BATCH_SIZE) {
    flushLogs();
  }
}

/**
 * Flush logs to database
 */
export async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) {
    return;
  }

  const logsToFlush = logBuffer.splice(0, logBuffer.length);

  try {
    const { error } = await supabase.from('performance_logs').insert(
      logsToFlush.map((log) => ({
        endpoint: log.endpoint,
        query_time_ms: log.queryTimeMs,
        query_name: log.queryName,
        value_epoch: log.valueEpoch,
        league_profile_id: log.leagueProfileId,
        parameters: log.parameters,
        stack_trace: log.stackTrace,
        logged_at: log.timestamp,
      }))
    );

    if (error) {
      console.error('Error flushing performance logs:', error);
    }
  } catch (error) {
    console.error('Error flushing logs:', error);
  }
}

/**
 * Start periodic log flushing
 */
export function startLogFlusher(intervalMs: number = 10000): NodeJS.Timeout {
  return setInterval(() => {
    flushLogs();
  }, intervalMs);
}

/**
 * Query timer decorator
 */
export function timed<T extends (...args: any[]) => Promise<any>>(
  queryName: string,
  endpoint: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      const elapsed = Date.now() - startTime;

      if (elapsed > SLOW_QUERY_THRESHOLD_MS) {
        logSlowQuery({
          endpoint,
          queryTimeMs: elapsed,
          queryName,
          parameters: args.length > 0 ? args[0] : undefined,
        });
      }

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;

      logSlowQuery({
        endpoint,
        queryTimeMs: elapsed,
        queryName: `${queryName} (ERROR)`,
        parameters: args.length > 0 ? args[0] : undefined,
        stackTrace: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }) as T;
}

/**
 * Measure query performance
 */
export async function measureQuery<T>(
  queryName: string,
  endpoint: string,
  queryFn: () => Promise<T>,
  context?: {
    valueEpoch?: string;
    leagueProfileId?: string;
    parameters?: Record<string, any>;
  }
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const elapsed = Date.now() - startTime;

    if (elapsed > SLOW_QUERY_THRESHOLD_MS) {
      logSlowQuery({
        endpoint,
        queryTimeMs: elapsed,
        queryName,
        valueEpoch: context?.valueEpoch,
        leagueProfileId: context?.leagueProfileId,
        parameters: context?.parameters,
      });
    }

    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logSlowQuery({
      endpoint,
      queryTimeMs: elapsed,
      queryName: `${queryName} (ERROR)`,
      valueEpoch: context?.valueEpoch,
      leagueProfileId: context?.leagueProfileId,
      parameters: context?.parameters,
      stackTrace: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Get slow queries (for admin dashboard)
 */
export async function getSlowQueries(
  limit: number = 100,
  minTimeMs: number = SLOW_QUERY_THRESHOLD_MS
): Promise<
  Array<{
    id: string;
    endpoint: string;
    queryTimeMs: number;
    queryName: string;
    valueEpoch: string | null;
    parameters: Record<string, any> | null;
    loggedAt: string;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('performance_logs')
      .select('*')
      .gte('query_time_ms', minTimeMs)
      .order('query_time_ms', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching slow queries:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      queryTimeMs: row.query_time_ms,
      queryName: row.query_name,
      valueEpoch: row.value_epoch,
      parameters: row.parameters,
      loggedAt: row.logged_at,
    }));
  } catch (error) {
    console.error('Error getting slow queries:', error);
    return [];
  }
}

/**
 * Get query statistics
 */
export async function getQueryStats(
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<{
  totalQueries: number;
  slowQueries: number;
  avgTimeMs: number;
  maxTimeMs: number;
  byEndpoint: Record<string, { count: number; avgMs: number }>;
}> {
  try {
    const { data } = await supabase
      .from('performance_logs')
      .select('endpoint, query_time_ms')
      .gte('logged_at', since.toISOString());

    if (!data || data.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgTimeMs: 0,
        maxTimeMs: 0,
        byEndpoint: {},
      };
    }

    const totalQueries = data.length;
    const slowQueries = data.filter((row) => row.query_time_ms >= SLOW_QUERY_THRESHOLD_MS).length;
    const avgTimeMs = data.reduce((sum, row) => sum + row.query_time_ms, 0) / totalQueries;
    const maxTimeMs = Math.max(...data.map((row) => row.query_time_ms));

    // Group by endpoint
    const byEndpoint: Record<string, { count: number; avgMs: number }> = {};
    data.forEach((row) => {
      if (!byEndpoint[row.endpoint]) {
        byEndpoint[row.endpoint] = { count: 0, avgMs: 0 };
      }
      byEndpoint[row.endpoint].count++;
      byEndpoint[row.endpoint].avgMs += row.query_time_ms;
    });

    // Calculate averages
    Object.keys(byEndpoint).forEach((endpoint) => {
      byEndpoint[endpoint].avgMs /= byEndpoint[endpoint].count;
    });

    return {
      totalQueries,
      slowQueries,
      avgTimeMs: Math.round(avgTimeMs),
      maxTimeMs,
      byEndpoint,
    };
  } catch (error) {
    console.error('Error getting query stats:', error);
    return {
      totalQueries: 0,
      slowQueries: 0,
      avgTimeMs: 0,
      maxTimeMs: 0,
      byEndpoint: {},
    };
  }
}

/**
 * Create performance_logs table migration
 */
export const createPerformanceLogsTableSQL = `
CREATE TABLE IF NOT EXISTS performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  query_time_ms int NOT NULL,
  query_name text NOT NULL,
  value_epoch text,
  league_profile_id uuid,
  parameters jsonb,
  stack_trace text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_logs_time
  ON performance_logs(query_time_ms DESC, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_logs_endpoint
  ON performance_logs(endpoint, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_logs_logged_at
  ON performance_logs(logged_at DESC);

-- RLS
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage performance logs"
  ON performance_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

/**
 * Alert on slow queries
 */
export function checkSlowQueryThreshold(
  queryTimeMs: number,
  criticalThresholdMs: number = 1000
): void {
  if (queryTimeMs >= criticalThresholdMs) {
    // Create critical alert
    supabase.from('system_alerts').insert({
      severity: 'critical',
      message: `CRITICAL: Query exceeded ${criticalThresholdMs}ms (${queryTimeMs}ms)`,
      alert_type: 'slow_query_critical',
      metadata: {
        query_time_ms: queryTimeMs,
        threshold_ms: criticalThresholdMs,
      },
    });
  }
}
