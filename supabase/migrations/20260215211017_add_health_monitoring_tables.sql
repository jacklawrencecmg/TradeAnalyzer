/*
  # Add Health Monitoring Tables

  Adds missing tables for health monitoring system:
  - rebuild_status: Track rebuild attempts and success
  - validation_samples: Runtime validation results

  Works with existing tables:
  - system_health_checks (uses check_name, status, meta)
  - system_alerts (uses severity, message, alert_type, metadata)
  - system_safe_mode (uses enabled boolean)
  - value_snapshots (uses epoch, data, stats)
*/

-- 1. Rebuild Status
CREATE TABLE IF NOT EXISTS rebuild_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_successful_rebuild timestamptz,
  last_attempt timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  duration_ms int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_rebuild_status CHECK (status IN ('success', 'failed', 'in_progress'))
);

CREATE INDEX IF NOT EXISTS idx_rebuild_status_created ON rebuild_status(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rebuild_status_status ON rebuild_status(status);

-- 2. Validation Samples
CREATE TABLE IF NOT EXISTS validation_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_type text NOT NULL,
  passed boolean NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_samples_type ON validation_samples(sample_type);
CREATE INDEX IF NOT EXISTS idx_samples_passed ON validation_samples(passed);
CREATE INDEX IF NOT EXISTS idx_samples_created ON validation_samples(created_at DESC);

-- RLS Policies

ALTER TABLE rebuild_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rebuild status" ON rebuild_status FOR SELECT USING (true);
CREATE POLICY "Service role can manage rebuild status" ON rebuild_status FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE validation_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage validation samples" ON validation_samples FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper Functions

CREATE OR REPLACE FUNCTION record_rebuild_attempt(
  p_status text,
  p_duration_ms int DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_rebuild_id uuid;
  v_last_successful timestamptz;
BEGIN
  SELECT last_successful_rebuild INTO v_last_successful
  FROM rebuild_status
  WHERE status = 'success'
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO rebuild_status (
    last_successful_rebuild,
    last_attempt,
    status,
    duration_ms,
    error_message
  )
  VALUES (
    CASE WHEN p_status = 'success' THEN now() ELSE v_last_successful END,
    now(),
    p_status,
    p_duration_ms,
    p_error_message
  )
  RETURNING id INTO v_rebuild_id;
  
  IF p_status = 'failed' THEN
    PERFORM create_system_alert(
      'critical',
      'Rebuild failed: ' || COALESCE(p_error_message, 'Unknown error'),
      'rebuild_failure',
      jsonb_build_object('error', p_error_message)
    );
  END IF;
  
  RETURN v_rebuild_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_rebuild_stale(p_threshold_hours int DEFAULT 36)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT now() - last_successful_rebuild > (p_threshold_hours || ' hours')::interval
     FROM rebuild_status
     WHERE status = 'success'
     ORDER BY created_at DESC
     LIMIT 1),
    true
  );
$$;

CREATE OR REPLACE FUNCTION record_validation_sample(
  p_sample_type text,
  p_passed boolean,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_sample_id uuid;
BEGIN
  INSERT INTO validation_samples (sample_type, passed, details)
  VALUES (p_sample_type, p_passed, p_details)
  RETURNING id INTO v_sample_id;
  
  RETURN v_sample_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_validation_failure_rate(
  p_sample_type text,
  p_hours int DEFAULT 24
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE (COUNT(*) FILTER (WHERE passed = false)::numeric / COUNT(*)::numeric) * 100
    END
  FROM validation_samples
  WHERE sample_type = p_sample_type
    AND created_at >= now() - (p_hours || ' hours')::interval;
$$;
