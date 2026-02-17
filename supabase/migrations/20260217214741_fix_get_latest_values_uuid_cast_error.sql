/*
  # Fix get_latest_values UUID cast error

  ## Problem
  The get_latest_values function was crashing with "invalid input syntax for type uuid"
  because ktc_value_snapshots.player_id stores Sleeper numeric IDs (e.g. "10859") as text,
  but the function was casting them to uuid for joins against player_headshots and
  calling get_canonical_headshot(uuid).

  ## Fix
  - Join player_identity via sleeper_id (text) instead of uuid cast
  - Use player_identity.headshot_url directly
  - Remove all unsafe ::uuid casts on player_id
  - Fall back to Sleeper CDN URL constructed from the sleeper ID
*/

CREATE OR REPLACE FUNCTION public.get_latest_values(
  p_format text DEFAULT 'dynasty_sf',
  p_position text DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS TABLE(
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
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_values AS (
    SELECT
      vs.player_id,
      vs.full_name AS player_name,
      vs.full_name,
      vs."position",
      vs.team,
      vs.position_rank,
      vs.ktc_value,
      vs.fdp_value,
      vs.format,
      vs.scoring_preset,
      vs.captured_at,
      NULL::jsonb AS metadata,
      ROW_NUMBER() OVER (
        PARTITION BY vs.player_id, vs.format, vs."position"
        ORDER BY vs.captured_at DESC, vs.created_at DESC
      ) AS rn
    FROM ktc_value_snapshots vs
    WHERE vs.format = p_format
      AND (p_position IS NULL OR vs."position" = p_position)
  )
  SELECT
    rv.player_id,
    rv.player_name,
    rv.full_name,
    rv."position" AS pos,
    rv.team,
    rv.position_rank,
    rv.ktc_value,
    rv.fdp_value,
    rv.format,
    rv.scoring_preset,
    rv.captured_at,
    rv.metadata,
    COALESCE(
      pi.headshot_url,
      'https://sleepercdn.com/content/nfl/players/thumb/' || rv.player_id || '.jpg'
    ) AS headshot_url
  FROM ranked_values rv
  LEFT JOIN player_identity pi ON pi.sleeper_id = rv.player_id
  WHERE rv.rn = 1
  ORDER BY
    CASE
      WHEN rv.fdp_value IS NOT NULL AND rv.fdp_value > 0 THEN rv.fdp_value
      ELSE rv.ktc_value
    END DESC NULLS LAST,
    rv.position_rank ASC NULLS LAST
  LIMIT p_limit;
END;
$$;
