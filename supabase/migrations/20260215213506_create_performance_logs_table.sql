/*
  # Performance Logs Table

  Track slow queries and API performance for monitoring and optimization.

  ## Fields
  - endpoint: API route or function name
  - query_time_ms: Execution time in milliseconds
  - query_name: Descriptive query name
  - value_epoch: Current value epoch (for cache debugging)
  - league_profile_id: Profile context
  - parameters: Query parameters (JSONB)
  - stack_trace: Error stack trace (if applicable)
  - logged_at: When the query was logged

  ## Purpose
  - Identify slow queries >300ms
  - Track performance regressions
  - Debug cache misses
  - Analyze query patterns
*/

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
