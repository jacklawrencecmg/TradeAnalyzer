/*
  # Update get_latest_values to JOIN player_identity by full_name

  ## Problem
  The player_id values in ktc_value_snapshots are not valid Sleeper player IDs.
  They were manually seeded and don't match Sleeper's actual player ID system.
  The previous JOIN used `player_identity.sleeper_id = ktc_value_snapshots.player_id`
  which never matched (player_identity was empty, and IDs were wrong anyway).

  ## Fix
  - JOIN player_identity by normalized full_name so correct headshots are used
    once player_identity is populated via Sleeper API name-matching
  - Keep the COALESCE fallback that constructs a Sleeper URL from player_id
    (will still be used until player_identity is populated)
  - Add a search_name column to player_identity for case-insensitive name matching
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'search_name'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN search_name text;
    CREATE INDEX IF NOT EXISTS idx_player_identity_search_name ON player_identity(search_name);
  END IF;
END $$;

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
  captured_at timestamp with time zone,
  metadata jsonb,
  headshot_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
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
  LEFT JOIN player_identity pi
    ON pi.search_name = lower(regexp_replace(rv.full_name, '[^a-zA-Z0-9]', '', 'g'))
  WHERE rv.rn = 1
  ORDER BY
    CASE
      WHEN rv.fdp_value IS NOT NULL AND rv.fdp_value > 0 THEN rv.fdp_value
      ELSE rv.ktc_value
    END DESC NULLS LAST,
    rv.position_rank ASC NULLS LAST
  LIMIT p_limit;
END;
$function$;
