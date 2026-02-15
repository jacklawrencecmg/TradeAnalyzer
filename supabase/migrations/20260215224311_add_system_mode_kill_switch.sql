/*
  # System Mode Kill-Switch

  1. New Configuration
    - Add system_mode to model_config
    - Modes: normal, maintenance, safe_mode

  2. Functions
    - get_system_mode() - Get current mode
    - set_system_mode() - Change mode (admin only)

  3. Usage
    - Check before value operations
    - Show banner in UI based on mode
    - Block writes in maintenance/safe_mode
*/

-- Add system mode configuration
INSERT INTO model_config (key, value, category, description, min_value, max_value) VALUES
  ('system_mode', 0, 'thresholds', 'System mode: 0=normal, 1=maintenance, 2=safe_mode', 0, 2)
ON CONFLICT (key) DO NOTHING;

-- Function to get system mode
CREATE OR REPLACE FUNCTION get_system_mode()
RETURNS text AS $$
DECLARE
  mode_value numeric;
  mode_text text;
BEGIN
  SELECT value INTO mode_value
  FROM model_config
  WHERE key = 'system_mode';

  CASE mode_value
    WHEN 0 THEN mode_text := 'normal';
    WHEN 1 THEN mode_text := 'maintenance';
    WHEN 2 THEN mode_text := 'safe_mode';
    ELSE mode_text := 'normal'; -- Default to normal if invalid
  END CASE;

  RETURN mode_text;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to set system mode (admin only via service role)
CREATE OR REPLACE FUNCTION set_system_mode(
  p_mode text,
  p_reason text DEFAULT NULL,
  p_updated_by text DEFAULT 'system'
)
RETURNS boolean AS $$
DECLARE
  mode_value numeric;
BEGIN
  -- Validate mode
  CASE p_mode
    WHEN 'normal' THEN mode_value := 0;
    WHEN 'maintenance' THEN mode_value := 1;
    WHEN 'safe_mode' THEN mode_value := 2;
    ELSE
      RAISE EXCEPTION 'Invalid mode: %. Must be normal, maintenance, or safe_mode', p_mode;
  END CASE;

  -- Update config
  UPDATE model_config
  SET value = mode_value,
      updated_at = now(),
      updated_by = p_updated_by
  WHERE key = 'system_mode';

  -- Log mode change
  INSERT INTO system_health_metrics (
    metric_name,
    metric_value,
    severity,
    metadata
  ) VALUES (
    'system_mode_changed',
    mode_value,
    CASE
      WHEN p_mode = 'safe_mode' THEN 'critical'
      WHEN p_mode = 'maintenance' THEN 'warning'
      ELSE 'info'
    END,
    jsonb_build_object(
      'new_mode', p_mode,
      'reason', p_reason,
      'changed_by', p_updated_by,
      'timestamp', now()
    )
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for quick mode check (used by endpoints)
CREATE OR REPLACE FUNCTION is_system_operational()
RETURNS boolean AS $$
BEGIN
  RETURN get_system_mode() = 'normal';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if writes allowed
CREATE OR REPLACE FUNCTION are_writes_allowed()
RETURNS boolean AS $$
DECLARE
  mode text;
BEGIN
  mode := get_system_mode();
  RETURN mode = 'normal';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_system_mode() IS 'Returns current system mode: normal, maintenance, or safe_mode';
COMMENT ON FUNCTION set_system_mode(text, text, text) IS 'Sets system mode with audit logging. Admin/service role only.';
COMMENT ON FUNCTION is_system_operational() IS 'Returns true if system is in normal mode';
COMMENT ON FUNCTION are_writes_allowed() IS 'Returns true if writes are allowed (normal mode only)';
