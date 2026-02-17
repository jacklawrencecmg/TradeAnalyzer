/*
  # Add Headshots to get_latest_values Function

  1. Changes
    - Add `headshot_url` column to return type
    - Join with canonical headshot system
    - Use get_canonical_headshot() function for fallback chain
    - Priority: manual override > player_headshots > player_identity > default

  2. Impact
    - All ranking pages (QB/RB/WR/TE) now get canonical headshots automatically
    - No need for separate headshot queries in frontend
    - Single source of truth for headshots

  3. Performance
    - Left join on player_headshots is fast (indexed by player_id)
    - Function call has minimal overhead
*/

-- Drop and recreate with headshot_url column
DROP FUNCTION IF EXISTS get_latest_values(text, text, integer);

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
  metadata jsonb,
  headshot_url text
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
    rv.metadata,
    COALESCE(
      ph.headshot_url,
      get_canonical_headshot(rv.player_id::uuid),
      'https://sleepercdn.com/images/v2/icons/player_default.webp'
    ) as headshot_url
  FROM ranked_values rv
  LEFT JOIN player_headshots ph ON ph.player_id = rv.player_id::uuid
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
  'Get latest KTC-based player values for rankings with canonical headshots. Queries ktc_value_snapshots and joins player_headshots for authoritative image URLs.';
