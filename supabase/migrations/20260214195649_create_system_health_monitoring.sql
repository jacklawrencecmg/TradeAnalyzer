/*
  # Create System Health Monitoring Infrastructure

  ## Overview
  Continuously monitors system health, detects data integrity issues, and enables auto-recovery to prevent bad data from reaching users.

  ## 1. New Tables

  ### `system_health_checks`
  Historical log of all health check results.
  - `id` (uuid, primary key) - Unique check result ID
  - `check_name` (text) - Name of the check (e.g., "player_sync_freshness")
  - `status` (text) - Result status: ok/warning/critical
  - `message` (text) - Human-readable status message
  - `meta` (jsonb) - Additional context data
  - `checked_at` (timestamptz) - When the check was performed
  - `created_at` (timestamptz) - When this record was created

  ### `system_alerts`
  Active alerts requiring attention.
  - `id` (uuid, primary key) - Unique alert ID
  - `severity` (text) - critical/warning/info
  - `check_name` (text) - Related health check name
  - `message` (text) - Alert message
  - `meta` (jsonb) - Additional alert data
  - `resolved` (boolean) - Whether the alert has been resolved
  - `resolved_at` (timestamptz) - When it was resolved
  - `created_at` (timestamptz) - When the alert was created

  ### `system_config`
  System-wide configuration and feature flags.
  - `key` (text, primary key) - Config key
  - `value` (jsonb) - Config value
  - `updated_at` (timestamptz) - Last update time

  ## 2. Security
  - Enable RLS on all tables
  - Public read access to system status (for displaying banners)
  - Authenticated write access for health checks and admin actions

  ## 3. Indexes
  - Fast lookups by check name and status
  - Fast queries for unresolved alerts
  - Latest checks per check name

  ## 4. Helper Functions
  - `get_latest_check_status()` - Get most recent result for each check
  - `create_alert_from_check()` - Create alert from failed check
  - `resolve_alerts_by_check()` - Auto-resolve alerts when check passes
  - `is_system_safe_mode()` - Check if system should be in safe mode

  ## Important Notes
  - Keep historical check results (append-only)
  - Auto-resolve alerts when checks pass
  - Safe mode disables writes when critical issues detected
*/

-- =====================================================
-- 1. Create system_health_checks table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Constraint to ensure valid status values
  CONSTRAINT valid_check_status CHECK (
    status IN ('ok', 'warning', 'critical')
  )
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_health_checks_name 
  ON system_health_checks(check_name);

CREATE INDEX IF NOT EXISTS idx_health_checks_status 
  ON system_health_checks(status);

CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at 
  ON system_health_checks(checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_checks_name_time 
  ON system_health_checks(check_name, checked_at DESC);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, authenticated write
CREATE POLICY "Anyone can view health checks"
  ON system_health_checks
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert health checks"
  ON system_health_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 2. Create system_alerts table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL,
  check_name text NOT NULL,
  message text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  
  -- Constraint to ensure valid severity values
  CONSTRAINT valid_alert_severity CHECK (
    severity IN ('critical', 'warning', 'info')
  )
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_alerts_resolved 
  ON system_alerts(resolved) 
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_alerts_severity 
  ON system_alerts(severity, resolved);

CREATE INDEX IF NOT EXISTS idx_alerts_check_name 
  ON system_alerts(check_name, resolved);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at 
  ON system_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, authenticated write
CREATE POLICY "Anyone can view alerts"
  ON system_alerts
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert alerts"
  ON system_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
  ON system_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. Create system_config table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, authenticated write
CREATE POLICY "Anyone can view system config"
  ON system_config
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert config"
  ON system_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update config"
  ON system_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Initialize safe mode config
INSERT INTO system_config (key, value)
VALUES ('safe_mode', '{"enabled": false, "reason": null, "since": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4. Helper Function: Get latest check status
-- =====================================================

CREATE OR REPLACE FUNCTION get_latest_check_status(p_check_name text DEFAULT NULL)
RETURNS TABLE (
  check_name text,
  status text,
  message text,
  meta jsonb,
  checked_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (shc.check_name)
    shc.check_name,
    shc.status,
    shc.message,
    shc.meta,
    shc.checked_at
  FROM system_health_checks shc
  WHERE p_check_name IS NULL OR shc.check_name = p_check_name
  ORDER BY shc.check_name, shc.checked_at DESC;
$$;

-- =====================================================
-- 5. Helper Function: Create alert from check
-- =====================================================

CREATE OR REPLACE FUNCTION create_alert_from_check(
  p_check_name text,
  p_status text,
  p_message text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_severity text;
  v_alert_id uuid;
  v_existing_count integer;
BEGIN
  -- Map status to severity
  v_severity := CASE
    WHEN p_status = 'critical' THEN 'critical'
    WHEN p_status = 'warning' THEN 'warning'
    ELSE 'info'
  END;
  
  -- Only create alert for warning or critical
  IF p_status NOT IN ('warning', 'critical') THEN
    RETURN NULL;
  END IF;
  
  -- Check if similar unresolved alert exists
  SELECT COUNT(*) INTO v_existing_count
  FROM system_alerts
  WHERE check_name = p_check_name
    AND resolved = false
    AND severity = v_severity;
  
  -- Don't create duplicate alerts
  IF v_existing_count > 0 THEN
    RETURN NULL;
  END IF;
  
  -- Create new alert
  INSERT INTO system_alerts (
    severity,
    check_name,
    message,
    meta
  )
  VALUES (
    v_severity,
    p_check_name,
    p_message,
    p_meta
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$;

-- =====================================================
-- 6. Helper Function: Resolve alerts by check name
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_alerts_by_check(p_check_name text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_resolved_count integer;
BEGIN
  UPDATE system_alerts
  SET 
    resolved = true,
    resolved_at = now()
  WHERE check_name = p_check_name
    AND resolved = false;
  
  GET DIAGNOSTICS v_resolved_count = ROW_COUNT;
  
  RETURN v_resolved_count;
END;
$$;

-- =====================================================
-- 7. Helper Function: Check if system is in safe mode
-- =====================================================

CREATE OR REPLACE FUNCTION is_system_safe_mode()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (value->>'enabled')::boolean,
    false
  )
  FROM system_config
  WHERE key = 'safe_mode';
$$;

-- =====================================================
-- 8. Helper Function: Enable safe mode
-- =====================================================

CREATE OR REPLACE FUNCTION enable_safe_mode(
  p_reason text DEFAULT 'Critical health check failure'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES (
    'safe_mode',
    jsonb_build_object(
      'enabled', true,
      'reason', p_reason,
      'since', now()
    )
  )
  ON CONFLICT (key) DO UPDATE
  SET 
    value = jsonb_build_object(
      'enabled', true,
      'reason', p_reason,
      'since', now()
    ),
    updated_at = now();
  
  RETURN true;
END;
$$;

-- =====================================================
-- 9. Helper Function: Disable safe mode
-- =====================================================

CREATE OR REPLACE FUNCTION disable_safe_mode()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES (
    'safe_mode',
    jsonb_build_object(
      'enabled', false,
      'reason', null,
      'since', null
    )
  )
  ON CONFLICT (key) DO UPDATE
  SET 
    value = jsonb_build_object(
      'enabled', false,
      'reason', null,
      'since', null
    ),
    updated_at = now();
  
  RETURN true;
END;
$$;

-- =====================================================
-- 10. Helper Function: Get unresolved critical alerts count
-- =====================================================

CREATE OR REPLACE FUNCTION get_critical_alerts_count()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM system_alerts
  WHERE resolved = false
    AND severity = 'critical';
$$;

-- =====================================================
-- 11. Create view for current system health
-- =====================================================

CREATE OR REPLACE VIEW current_system_health AS
SELECT 
  check_name,
  status,
  message,
  meta,
  checked_at,
  CASE
    WHEN checked_at < NOW() - INTERVAL '2 hours' THEN true
    ELSE false
  END as is_stale
FROM get_latest_check_status()
ORDER BY 
  CASE status
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'ok' THEN 3
  END,
  checked_at DESC;

-- =====================================================
-- 12. Create view for active alerts
-- =====================================================

CREATE OR REPLACE VIEW active_system_alerts AS
SELECT 
  id,
  severity,
  check_name,
  message,
  meta,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))::integer as age_seconds
FROM system_alerts
WHERE resolved = false
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
  END,
  created_at DESC;
