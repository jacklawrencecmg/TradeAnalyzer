/*
  # Fix get_latest_values Function for Rankings

  ## Problem
  The `get_latest_values()` function was trying to query from `latest_player_values` view
  which has a different schema (base_value, adjusted_value) than what the ranking components
  expect (ktc_value, fdp_value).

  ## Solution
  Recreate the function to query directly from `ktc_value_snapshots` table which has the
  correct columns for displaying KTC-based rankings.

  ## Changes
  - Drop and recreate `get_latest_values()` function
  - Query from `ktc_value_snapshots` with proper window function to get latest values
  - Return columns that match what the ranking components expect
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_latest_values(text, text, integer);

-- Recreate with correct schema
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
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_values AS (
    SELECT 
      vs.player_id,
      vs.full_name as player_name,
      vs.full_name,
      vs."position",
      vs.team,
      vs.position_rank,
      vs.ktc_value,
      vs.fdp_value,
      vs.format,
      vs.scoring_preset,
      vs.captured_at,
      NULL::jsonb as metadata,
      ROW_NUMBER() OVER (
        PARTITION BY vs.player_id, vs.format, vs."position"
        ORDER BY vs.captured_at DESC, vs.created_at DESC
      ) as rn
    FROM ktc_value_snapshots vs
    WHERE vs.format = p_format
      AND (p_position IS NULL OR vs."position" = p_position)
  )
  SELECT 
    rv.player_id,
    rv.player_name,
    rv.full_name,
    rv."position" as pos,
    rv.team,
    rv.position_rank,
    rv.ktc_value,
    rv.fdp_value,
    rv.format,
    rv.scoring_preset,
    rv.captured_at,
    rv.metadata
  FROM ranked_values rv
  WHERE rv.rn = 1
  ORDER BY 
    CASE 
      WHEN rv.fdp_value IS NOT NULL THEN rv.fdp_value 
      ELSE rv.ktc_value 
    END DESC NULLS LAST,
    rv.position_rank ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_latest_values IS 
  'Get latest KTC-based player values for rankings. Queries ktc_value_snapshots for most recent values by player+format.';
