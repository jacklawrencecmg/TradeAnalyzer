/*
  # Add Canonical Headshot Fields to Player Identity

  1. Changes
    - Add `headshot_url` to player_identity (canonical image URL)
    - Add `headshot_source` to track where image came from
    - Add `headshot_updated_at` to track last verification
    - Add `headshot_verified` to mark manually verified images

  2. Purpose
    - Establish single source of truth for player images
    - Stop deriving images from names/teams
    - Enable automatic sync from Sleeper/NFL APIs
    - Prevent overwriting manually corrected images
*/

-- Add headshot fields to player_identity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'headshot_url'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN headshot_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'headshot_source'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN headshot_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'headshot_updated_at'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN headshot_updated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'headshot_verified'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN headshot_verified boolean DEFAULT false;
  END IF;
END $$;

-- Create index for headshot queries
CREATE INDEX IF NOT EXISTS idx_player_identity_headshot_source 
  ON player_identity(headshot_source) 
  WHERE headshot_url IS NOT NULL;

-- Create index for missing headshots
CREATE INDEX IF NOT EXISTS idx_player_identity_missing_headshot 
  ON player_identity(player_id) 
  WHERE headshot_url IS NULL;

-- Function to get player headshot
CREATE OR REPLACE FUNCTION get_player_headshot(p_player_id text)
RETURNS TABLE (
  url text,
  source text,
  last_verified timestamptz,
  is_verified boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    headshot_url,
    headshot_source,
    headshot_updated_at,
    headshot_verified
  FROM player_identity
  WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update player headshot
CREATE OR REPLACE FUNCTION update_player_headshot(
  p_player_id text,
  p_headshot_url text,
  p_source text,
  p_force_update boolean DEFAULT false
)
RETURNS boolean AS $$
DECLARE
  current_verified boolean;
BEGIN
  -- Check if current headshot is manually verified
  SELECT headshot_verified INTO current_verified
  FROM player_identity
  WHERE player_id = p_player_id;

  -- Don't overwrite verified headshots unless forced
  IF current_verified = true AND p_force_update = false THEN
    RETURN false;
  END IF;

  -- Update headshot
  UPDATE player_identity
  SET
    headshot_url = p_headshot_url,
    headshot_source = p_source,
    headshot_updated_at = now(),
    headshot_verified = CASE WHEN p_force_update THEN true ELSE headshot_verified END
  WHERE player_id = p_player_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark headshot as verified
CREATE OR REPLACE FUNCTION verify_player_headshot(p_player_id text)
RETURNS void AS $$
BEGIN
  UPDATE player_identity
  SET headshot_verified = true
  WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get players missing headshots
CREATE OR REPLACE FUNCTION get_players_missing_headshots(p_limit integer DEFAULT 100)
RETURNS TABLE (
  player_id text,
  canonical_name text,
  player_position text,
  team text,
  sleeper_id text,
  gsis_id text,
  espn_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.player_id,
    pi.canonical_name,
    pi."position",
    pi.team,
    pi.sleeper_id,
    pi.gsis_id,
    pi.espn_id
  FROM player_identity pi
  WHERE pi.headshot_url IS NULL
    AND pi."position" IN ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB')
  ORDER BY pi.canonical_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect duplicate headshots
CREATE OR REPLACE FUNCTION detect_duplicate_headshots()
RETURNS TABLE (
  headshot_url text,
  player_count bigint,
  player_names text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.headshot_url,
    COUNT(*)::bigint as player_count,
    array_agg(pi.canonical_name) as player_names
  FROM player_identity pi
  WHERE pi.headshot_url IS NOT NULL
    AND pi.headshot_url != ''
  GROUP BY pi.headshot_url
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get headshot statistics
CREATE OR REPLACE FUNCTION get_headshot_stats()
RETURNS TABLE (
  total_players bigint,
  with_headshot bigint,
  missing_headshot bigint,
  verified_headshot bigint,
  percent_complete numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_players,
    COUNT(headshot_url)::bigint as with_headshot,
    COUNT(*) FILTER (WHERE headshot_url IS NULL)::bigint as missing_headshot,
    COUNT(*) FILTER (WHERE headshot_verified = true)::bigint as verified_headshot,
    ROUND((COUNT(headshot_url)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) as percent_complete
  FROM player_identity
  WHERE "position" IN ('QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
