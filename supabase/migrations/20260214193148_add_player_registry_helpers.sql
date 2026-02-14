/*
  # Add Player Registry Helper Functions

  1. Purpose
    - Provide helper functions for player lookup and management
    - Add utilities to safely migrate to player registry
    - Enable gradual transition from external IDs to registry IDs
    - No breaking changes to existing tables

  2. Helper Functions
    - find_or_create_player_by_external_id() - Get registry ID from Sleeper ID
    - find_or_create_player_by_name() - Get registry ID from name
    - get_or_sync_player() - Get player with auto-sync fallback
    - bulk_import_players_from_sleeper() - Batch import utility

  3. Strategy
    - Keep existing text player_id columns as-is
    - Add new columns gradually in future migrations
    - Provide utilities for app code to use registry
    - No immediate breaking changes
*/

-- Function: Find or create player by external ID (Sleeper player_id)
CREATE OR REPLACE FUNCTION find_or_create_player_by_external_id(
  p_external_id text,
  p_full_name text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_team text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_player_id uuid;
BEGIN
  -- Try to find by external ID
  SELECT id INTO v_player_id
  FROM nfl_players
  WHERE external_id = p_external_id;

  IF v_player_id IS NOT NULL THEN
    RETURN v_player_id;
  END IF;

  -- If name provided, try by name
  IF p_full_name IS NOT NULL THEN
    SELECT id INTO v_player_id
    FROM nfl_players
    WHERE full_name = p_full_name
      AND (p_position IS NULL OR player_position = p_position)
    LIMIT 1;

    IF v_player_id IS NOT NULL THEN
      -- Update external_id if found by name
      UPDATE nfl_players
      SET external_id = p_external_id,
          updated_at = now()
      WHERE id = v_player_id;

      RETURN v_player_id;
    END IF;
  END IF;

  -- Create new player
  INSERT INTO nfl_players (
    external_id,
    full_name,
    search_name,
    player_position,
    team,
    status
  ) VALUES (
    p_external_id,
    COALESCE(p_full_name, 'Unknown Player'),
    normalize_search_name(COALESCE(p_full_name, 'Unknown')),
    COALESCE(p_position, 'UNKNOWN'),
    p_team,
    'Unknown'
  )
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Find or create player by name
CREATE OR REPLACE FUNCTION find_or_create_player_by_name(
  p_name text,
  p_position text DEFAULT NULL,
  p_team text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_player_id uuid;
  v_search_name text;
BEGIN
  -- Exact match
  SELECT id INTO v_player_id
  FROM nfl_players
  WHERE full_name = p_name
    AND (p_position IS NULL OR player_position = p_position)
  LIMIT 1;

  IF v_player_id IS NOT NULL THEN
    RETURN v_player_id;
  END IF;

  -- Normalized search
  v_search_name := normalize_search_name(p_name);
  
  SELECT id INTO v_player_id
  FROM nfl_players
  WHERE search_name = v_search_name
    AND (p_position IS NULL OR player_position = p_position)
  LIMIT 1;

  IF v_player_id IS NOT NULL THEN
    RETURN v_player_id;
  END IF;

  -- Create placeholder
  INSERT INTO nfl_players (
    full_name,
    search_name,
    player_position,
    team,
    status,
    external_id
  ) VALUES (
    p_name,
    v_search_name,
    COALESCE(p_position, 'UNKNOWN'),
    p_team,
    'Unknown',
    'temp_' || gen_random_uuid()::text
  )
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Get player with auto-sync fallback
CREATE OR REPLACE FUNCTION get_or_sync_player(
  p_external_id text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_team text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  external_id text,
  full_name text,
  player_position text,
  team text,
  status text
) AS $$
DECLARE
  v_player_id uuid;
BEGIN
  -- Try by external ID first
  IF p_external_id IS NOT NULL THEN
    v_player_id := find_or_create_player_by_external_id(
      p_external_id,
      p_name,
      p_position,
      p_team
    );
  ELSIF p_name IS NOT NULL THEN
    v_player_id := find_or_create_player_by_name(
      p_name,
      p_position,
      p_team
    );
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.external_id,
    p.full_name,
    p.player_position,
    p.team,
    p.status
  FROM nfl_players p
  WHERE p.id = v_player_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Get player registry ID from external ID (simple lookup/create)
CREATE OR REPLACE FUNCTION player_registry_id(p_external_id text)
RETURNS uuid AS $$
DECLARE
  v_player_id uuid;
BEGIN
  SELECT id INTO v_player_id
  FROM nfl_players
  WHERE external_id = p_external_id;

  IF v_player_id IS NULL THEN
    -- Create minimal placeholder
    INSERT INTO nfl_players (external_id, full_name, status)
    VALUES (p_external_id, 'Player_' || p_external_id, 'Unknown')
    RETURNING id INTO v_player_id;
  END IF;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Batch lookup players by external IDs
CREATE OR REPLACE FUNCTION batch_lookup_players(p_external_ids text[])
RETURNS TABLE (
  external_id text,
  registry_id uuid,
  full_name text,
  player_position text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.external_id,
    p.id,
    p.full_name,
    p.player_position
  FROM nfl_players p
  WHERE p.external_id = ANY(p_external_ids);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get all rookies for a season
CREATE OR REPLACE FUNCTION get_rookies_by_year(p_year int)
RETURNS TABLE (
  id uuid,
  external_id text,
  full_name text,
  player_position text,
  team text,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.external_id,
    p.full_name,
    p.player_position,
    p.team,
    p.status
  FROM nfl_players p
  WHERE p.rookie_year = p_year
  ORDER BY p.player_position, p.full_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Search players (for autocomplete)
CREATE OR REPLACE FUNCTION search_players(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  external_id text,
  full_name text,
  player_position text,
  team text,
  status text,
  match_type text
) AS $$
DECLARE
  v_search_name text;
BEGIN
  v_search_name := normalize_search_name(p_query);

  RETURN QUERY
  -- Exact name match
  SELECT 
    p.id,
    p.external_id,
    p.full_name,
    p.player_position,
    p.team,
    p.status,
    'exact'::text as match_type
  FROM nfl_players p
  WHERE p.full_name ILIKE p_query || '%'
  
  UNION ALL
  
  -- Search name match
  SELECT 
    p.id,
    p.external_id,
    p.full_name,
    p.player_position,
    p.team,
    p.status,
    'search'::text as match_type
  FROM nfl_players p
  WHERE p.search_name LIKE v_search_name || '%'
    AND p.full_name NOT ILIKE p_query || '%'
  
  UNION ALL
  
  -- Contains match
  SELECT 
    p.id,
    p.external_id,
    p.full_name,
    p.player_position,
    p.team,
    p.status,
    'contains'::text as match_type
  FROM nfl_players p
  WHERE p.full_name ILIKE '%' || p_query || '%'
    AND p.full_name NOT ILIKE p_query || '%'
    AND p.search_name NOT LIKE v_search_name || '%'
  
  ORDER BY match_type, full_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_or_create_player_by_external_id(text, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION find_or_create_player_by_name(text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_sync_player(text, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION player_registry_id(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION batch_lookup_players(text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_rookies_by_year(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_players(text, int) TO authenticated, anon;

-- Comments
COMMENT ON FUNCTION find_or_create_player_by_external_id IS 
  'Get registry ID from Sleeper player_id - creates placeholder if not found';

COMMENT ON FUNCTION find_or_create_player_by_name IS 
  'Get registry ID from player name - creates placeholder if not found';

COMMENT ON FUNCTION get_or_sync_player IS 
  'Get player with auto-sync fallback - prevents lookup failures';

COMMENT ON FUNCTION player_registry_id IS 
  'Quick lookup/create player registry ID from external ID';

COMMENT ON FUNCTION search_players IS 
  'Search players for autocomplete - returns top matches by relevance';
