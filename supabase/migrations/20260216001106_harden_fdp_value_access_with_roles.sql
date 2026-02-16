/*
  # Harden FDP Value Access with Role-Based Security

  1. Purpose
    - Create vw_fdp_values as the ONLY selectable object for app roles
    - Revoke direct SELECT on underlying tables
    - Force all client access through controlled view
    - Prevent any client-side FDP bypass

  2. Changes
    - Create comprehensive vw_fdp_values view
    - Revoke direct table access for anon/authenticated
    - Grant SELECT only on view
    - Create helper functions for safe access

  3. Security Model
    - App roles (anon, authenticated) → view only
    - Service role → full access (for sync operations)
    - Admin operations require service key
*/

-- Create comprehensive FDP values view
CREATE OR REPLACE VIEW vw_fdp_values AS
SELECT 
  pv.id,
  pv.player_id,
  pv.player_name,
  pv.position,
  pv.team,
  pv.base_value,
  pv.adjusted_value,
  pv.market_value,
  pv.tier,
  pv.rank_overall,
  pv.rank_position,
  pv.value_epoch_id,
  pv.league_profile_id,
  pv.format,
  pv.source,
  pv.confidence_score,
  pv.updated_at,
  pv.created_at
FROM latest_player_values pv;

COMMENT ON VIEW vw_fdp_values IS 
  'FDP canonical values view - ONLY legal access point for app roles';

-- Revoke direct access to underlying tables
REVOKE SELECT ON latest_player_values FROM anon, authenticated;
REVOKE SELECT ON player_value_history FROM anon, authenticated;
REVOKE SELECT ON ktc_value_snapshots FROM anon, authenticated;

-- Grant SELECT only on the view
GRANT SELECT ON vw_fdp_values TO anon, authenticated;

-- Create safe function to get player value
CREATE OR REPLACE FUNCTION get_fdp_value(
  p_player_id text,
  p_league_profile_id uuid DEFAULT NULL,
  p_format text DEFAULT 'dynasty_1qb'
)
RETURNS TABLE (
  player_id text,
  player_name text,
  player_position text,
  team text,
  base_value integer,
  adjusted_value integer,
  market_value integer,
  tier text,
  rank_overall integer,
  rank_position integer,
  value_epoch_id uuid,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.player_id,
    v.player_name,
    v.position as player_position,
    v.team,
    v.base_value,
    v.adjusted_value,
    v.market_value,
    v.tier,
    v.rank_overall,
    v.rank_position,
    v.value_epoch_id,
    v.updated_at
  FROM vw_fdp_values v
  WHERE v.player_id = p_player_id
    AND (p_league_profile_id IS NULL OR v.league_profile_id = p_league_profile_id)
    AND v.format = p_format
  ORDER BY v.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_fdp_value(text, uuid, text) TO anon, authenticated;

-- Create batch function
CREATE OR REPLACE FUNCTION get_fdp_values_batch(
  p_player_ids text[],
  p_league_profile_id uuid DEFAULT NULL,
  p_format text DEFAULT 'dynasty_1qb'
)
RETURNS TABLE (
  player_id text,
  player_name text,
  player_position text,
  team text,
  base_value integer,
  adjusted_value integer,
  market_value integer,
  tier text,
  rank_overall integer,
  rank_position integer,
  value_epoch_id uuid,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (v.player_id)
    v.player_id,
    v.player_name,
    v.position as player_position,
    v.team,
    v.base_value,
    v.adjusted_value,
    v.market_value,
    v.tier,
    v.rank_overall,
    v.rank_position,
    v.value_epoch_id,
    v.updated_at
  FROM vw_fdp_values v
  WHERE v.player_id = ANY(p_player_ids)
    AND (p_league_profile_id IS NULL OR v.league_profile_id = p_league_profile_id)
    AND v.format = p_format
  ORDER BY v.player_id, v.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_fdp_values_batch(text[], uuid, text) TO anon, authenticated;

-- Create readiness check function
CREATE OR REPLACE FUNCTION check_fdp_readiness()
RETURNS jsonb AS $$
DECLARE
  v_count integer;
  v_latest_update timestamptz;
  v_age_hours numeric;
  v_has_epoch boolean;
BEGIN
  SELECT COUNT(*) INTO v_count FROM vw_fdp_values;
  SELECT MAX(updated_at) INTO v_latest_update FROM vw_fdp_values;
  v_age_hours := EXTRACT(EPOCH FROM (now() - v_latest_update)) / 3600;
  
  SELECT EXISTS(
    SELECT 1 FROM vw_fdp_values WHERE value_epoch_id IS NOT NULL LIMIT 1
  ) INTO v_has_epoch;
  
  RETURN jsonb_build_object(
    'ready', (v_count > 500 AND v_age_hours < 48 AND v_has_epoch),
    'player_count', v_count,
    'last_updated', v_latest_update,
    'age_hours', ROUND(v_age_hours, 1),
    'has_epoch', v_has_epoch,
    'checked_at', now()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_fdp_readiness() TO anon, authenticated;
