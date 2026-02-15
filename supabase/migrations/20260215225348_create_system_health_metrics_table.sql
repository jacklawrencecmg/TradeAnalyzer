/*
  # Create System Health Metrics Table

  Stores system health events, errors, and monitoring data.
*/

CREATE TABLE IF NOT EXISTS system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_severity ON system_health_metrics(severity);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_created_at ON system_health_metrics(created_at DESC);

ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage health metrics"
  ON system_health_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE system_health_metrics IS 'System health monitoring, errors, and events';
