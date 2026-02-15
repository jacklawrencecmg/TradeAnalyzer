/*
  # Add Scarcity Debug Fields

  1. Changes to value_snapshots
    - Add debug fields for scarcity adjustment analysis
    - These fields help administrators understand value calculations
    - NOT exposed to public APIs

  2. New fields
    - debug_raw_value: Value before scarcity adjustment
    - debug_replacement_value: Replacement level value for position
    - debug_vor: Value Over Replacement (VOR)
    - debug_elasticity_adj: Adjustment from positional elasticity caps

  3. Note
    - Debug fields are optional (NULL allowed)
    - Only populated during rebuild with debug flag enabled
    - Used for validation and troubleshooting
*/

-- Add debug fields to value_snapshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_snapshots' AND column_name = 'debug_raw_value'
  ) THEN
    ALTER TABLE value_snapshots
      ADD COLUMN debug_raw_value integer,
      ADD COLUMN debug_replacement_value integer,
      ADD COLUMN debug_vor integer,
      ADD COLUMN debug_elasticity_adj integer;
  END IF;
END $$;

-- Add indexes for debug queries
CREATE INDEX IF NOT EXISTS idx_value_snapshots_debug
  ON value_snapshots(player_id, league_profile_id)
  WHERE debug_raw_value IS NOT NULL;

-- Add comments
COMMENT ON COLUMN value_snapshots.debug_raw_value IS 'Value before scarcity adjustment (for debugging)';
COMMENT ON COLUMN value_snapshots.debug_replacement_value IS 'Replacement level value for this position (for debugging)';
COMMENT ON COLUMN value_snapshots.debug_vor IS 'Value Over Replacement (VOR) - raw_value minus replacement_value';
COMMENT ON COLUMN value_snapshots.debug_elasticity_adj IS 'Adjustment from positional elasticity caps';

-- Create helper view for scarcity analysis (admin only)
CREATE OR REPLACE VIEW scarcity_debug_view AS
SELECT
  vs.player_id,
  np.full_name,
  np.player_position,
  vs.league_profile_id,
  lp.name as profile_name,
  lp.format_key,
  vs.format,
  vs.position_rank,
  vs.market_value as final_value,
  vs.debug_raw_value,
  vs.debug_replacement_value,
  vs.debug_vor,
  vs.debug_elasticity_adj,
  vs.market_value - vs.debug_raw_value as total_adjustment,
  CASE
    WHEN vs.debug_raw_value > 0 THEN
      ROUND(((vs.market_value::numeric - vs.debug_raw_value) / vs.debug_raw_value * 100)::numeric, 1)
    ELSE 0
  END as pct_change,
  vs.captured_at
FROM value_snapshots vs
JOIN nfl_players np ON vs.player_id = np.id
JOIN league_profiles lp ON vs.league_profile_id = lp.id
WHERE vs.debug_raw_value IS NOT NULL
ORDER BY vs.captured_at DESC, vs.position_rank;

COMMENT ON VIEW scarcity_debug_view IS 'Admin view for analyzing scarcity adjustments';

-- Create function to get scarcity explanation
CREATE OR REPLACE FUNCTION get_scarcity_explanation(
  p_player_id uuid,
  p_league_profile_id uuid,
  p_format text
)
RETURNS TABLE (
  player_name text,
  player_position text,
  position_rank integer,
  final_value integer,
  raw_value integer,
  replacement_value integer,
  vor integer,
  elasticity_adj integer,
  total_adjustment integer,
  explanation text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.full_name::text,
    np.player_position::text,
    vs.position_rank,
    vs.market_value,
    vs.debug_raw_value,
    vs.debug_replacement_value,
    vs.debug_vor,
    vs.debug_elasticity_adj,
    (vs.market_value - COALESCE(vs.debug_raw_value, vs.market_value)),
    CASE
      WHEN vs.debug_vor > 0 THEN
        'Above replacement level - strong lineup impact'
      WHEN vs.debug_vor < 0 THEN
        'Below replacement level - limited lineup impact'
      ELSE
        'At replacement level - borderline starter'
    END::text
  FROM value_snapshots vs
  JOIN nfl_players np ON vs.player_id = np.id
  WHERE vs.player_id = p_player_id
    AND vs.league_profile_id = p_league_profile_id
    AND vs.format = p_format
  ORDER BY vs.captured_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_scarcity_explanation IS 'Returns scarcity adjustment breakdown for a player';