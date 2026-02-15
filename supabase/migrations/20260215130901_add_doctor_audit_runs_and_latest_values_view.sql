/*
  # Add Doctor Audit Runs & Latest Values View

  ## Overview
  Extends the Doctor system with audit run tracking and a canonical latest values view.

  ## New Tables
  
  ### `doctor_audit_runs`
  History of all audit runs for tracking system health over time.
  
  ## New Views
  
  ### `latest_player_values`
  Single canonical source for the most recent player values per player+format.
  Eliminates inconsistencies from scattered "latest value" queries across the codebase.
  
  ## Security
  - Enable RLS on doctor_audit_runs
  - Public read access to latest_player_values view
*/

-- Create doctor_audit_runs table
CREATE TABLE IF NOT EXISTS doctor_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT now() NOT NULL,
  duration_ms integer,
  summary jsonb DEFAULT '{}'::jsonb,
  findings jsonb DEFAULT '[]'::jsonb,
  triggered_by text DEFAULT 'system'
);

ALTER TABLE doctor_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit runs"
  ON doctor_audit_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert audit runs"
  ON doctor_audit_runs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_doctor_audit_runs_run_at ON doctor_audit_runs(run_at DESC);

-- Create latest_player_values view (canonical source of truth)
-- This view provides the single authoritative source for "latest" player values
-- All endpoints should query this view instead of doing their own max(captured_at) logic
CREATE OR REPLACE VIEW latest_player_values AS
WITH ranked_snapshots AS (
  SELECT 
    vs.player_id,
    vs.full_name,
    vs."position",
    vs.team,
    vs.position_rank,
    vs.ktc_value,
    vs.fdp_value,
    vs.format,
    vs.scoring_preset,
    vs.source,
    vs.captured_at,
    pv.player_name,
    pv.team as current_team,
    pv.trend,
    pv.metadata,
    ROW_NUMBER() OVER (
      PARTITION BY vs.player_id, vs.format 
      ORDER BY vs.captured_at DESC, vs.created_at DESC
    ) as rn
  FROM ktc_value_snapshots vs
  LEFT JOIN player_values pv ON pv.player_id = vs.player_id
)
SELECT 
  player_id,
  COALESCE(player_name, full_name) as player_name,
  full_name,
  "position",
  COALESCE(current_team, team) as team,
  position_rank,
  ktc_value,
  fdp_value,
  format,
  scoring_preset,
  source,
  captured_at,
  trend,
  metadata
FROM ranked_snapshots
WHERE rn = 1;

COMMENT ON VIEW latest_player_values IS 
  'Canonical source of truth for latest player values. All endpoints should use this view.';

-- Helper function to get latest values by format and position
CREATE OR REPLACE FUNCTION get_latest_values(
  p_format text DEFAULT 'dynasty_sf',
  p_position text DEFAULT NULL,
  p_limit integer DEFAULT NULL
) RETURNS TABLE (
  player_id text,
  player_name text,
  full_name text,
  pos text,
  team text,
  position_rank integer,
  ktc_value integer,
  fdp_value integer,
  format text,
  scoring_preset text,
  captured_at timestamptz,
  trend text,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lpv.player_id,
    lpv.player_name,
    lpv.full_name,
    lpv."position" as pos,
    lpv.team,
    lpv.position_rank,
    lpv.ktc_value,
    lpv.fdp_value,
    lpv.format,
    lpv.scoring_preset,
    lpv.captured_at,
    lpv.trend,
    lpv.metadata
  FROM latest_player_values lpv
  WHERE lpv.format = p_format
    AND (p_position IS NULL OR lpv."position" = p_position)
  ORDER BY lpv.fdp_value DESC NULLS LAST, lpv.position_rank ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_latest_values IS 
  'Get latest player values for a format and optional position. Uses canonical latest_player_values view.';
