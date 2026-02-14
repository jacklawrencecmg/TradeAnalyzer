/*
  # Create Doctor (Audit & Repair) System

  1. New Tables
    - `doctor_fixes` - Log of all auto-repairs applied
    - `system_safe_mode` - Global safe mode state

  2. Functions
    - Safe mode management functions
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS enable_safe_mode(text, jsonb);
DROP FUNCTION IF EXISTS disable_safe_mode();
DROP FUNCTION IF EXISTS is_safe_mode_enabled();

-- Doctor fixes log
CREATE TABLE IF NOT EXISTS doctor_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_id text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  rows_affected int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  applied_at timestamptz DEFAULT NOW(),
  applied_by text
);

CREATE INDEX IF NOT EXISTS idx_doctor_fixes_applied_at 
  ON doctor_fixes(applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_fixes_fix_id 
  ON doctor_fixes(fix_id);

-- Safe mode state (single row table)
CREATE TABLE IF NOT EXISTS system_safe_mode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled bool NOT NULL DEFAULT false,
  reason text,
  critical_issues jsonb DEFAULT '[]'::jsonb,
  enabled_at timestamptz,
  updated_at timestamptz DEFAULT NOW()
);

-- Insert initial safe mode row if not exists
INSERT INTO system_safe_mode (id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (id) DO NOTHING;

-- Function to enable safe mode
CREATE FUNCTION enable_safe_mode(
  p_reason text,
  p_issues jsonb DEFAULT '[]'::jsonb
) RETURNS void AS $$
BEGIN
  UPDATE system_safe_mode
  SET enabled = true,
      reason = p_reason,
      critical_issues = p_issues,
      enabled_at = NOW(),
      updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disable safe mode
CREATE FUNCTION disable_safe_mode() RETURNS void AS $$
BEGIN
  UPDATE system_safe_mode
  SET enabled = false,
      reason = NULL,
      critical_issues = '[]'::jsonb,
      updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if safe mode is enabled
CREATE FUNCTION is_safe_mode_enabled() RETURNS bool AS $$
  SELECT COALESCE(enabled, false) 
  FROM system_safe_mode 
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE doctor_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_safe_mode ENABLE ROW LEVEL SECURITY;

-- Policies for doctor_fixes
DROP POLICY IF EXISTS "Service role can read doctor fixes" ON doctor_fixes;
DROP POLICY IF EXISTS "Service role can insert doctor fixes" ON doctor_fixes;

CREATE POLICY "Service role can read doctor fixes"
  ON doctor_fixes FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert doctor fixes"
  ON doctor_fixes FOR INSERT
  WITH CHECK (true);

-- Policies for system_safe_mode
DROP POLICY IF EXISTS "Service role can read safe mode" ON system_safe_mode;
DROP POLICY IF EXISTS "Service role can update safe mode" ON system_safe_mode;

CREATE POLICY "Anyone can read safe mode"
  ON system_safe_mode FOR SELECT
  USING (true);

CREATE POLICY "Service role can update safe mode"
  ON system_safe_mode FOR UPDATE
  USING (true);

-- Comments
COMMENT ON TABLE doctor_fixes IS 
  'Log of all automatic repairs applied by the Doctor audit system';

COMMENT ON TABLE system_safe_mode IS 
  'Global safe mode state - single row table';
