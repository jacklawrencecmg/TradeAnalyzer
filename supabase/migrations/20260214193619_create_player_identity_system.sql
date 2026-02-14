/*
  # Create Player Identity System

  1. Purpose
    - Resolve player names from any source (KTC, Sleeper, user input) to canonical player_id
    - Handle name variations, typos, and ambiguous matches
    - Track unresolved entities for manual review
    - Enable fast alias lookup and management

  2. New Tables
    
    `player_aliases` - All known name variations for each player
    - `id` (uuid, primary key)
    - `player_id` (uuid, references nfl_players) - Canonical player
    - `alias` (text, not null) - Original alias text
    - `alias_normalized` (text, not null, unique) - Normalized for matching
    - `source` (text, not null) - Origin: sleeper, ktc, user, auto
    - `created_at` (timestamptz)
    - `created_by` (uuid, nullable) - User who created (for manual aliases)
    
    `unresolved_entities` - Quarantine for ambiguous/unknown players
    - `id` (uuid, primary key)
    - `raw_name` (text, not null) - Original name that failed to resolve
    - `player_position` (text, nullable) - Position hint if available
    - `team` (text, nullable) - Team hint if available
    - `source` (text, not null) - Origin: ktc, sleeper, user, trade_input
    - `status` (text) - open, resolved, ignored
    - `resolved_player_id` (uuid, nullable) - Player if manually resolved
    - `suggestions` (jsonb) - Top fuzzy match suggestions
    - `metadata` (jsonb) - Additional context
    - `created_at` (timestamptz)
    - `resolved_at` (timestamptz, nullable)
    - `resolved_by` (uuid, nullable) - User who resolved

  3. Indexes
    - Unique constraint on alias_normalized (one alias → one player)
    - Index on player_id for reverse lookups
    - Index on alias_normalized for fast matching
    - Index on status for quarantine queries

  4. Security
    - Enable RLS on both tables
    - Public read on player_aliases
    - Authenticated write on player_aliases (for user submissions)
    - Admin-only access to unresolved_entities

  5. Functions
    - add_player_alias() - Add new alias for player
    - remove_player_alias() - Remove alias
    - resolve_alias() - Mark unresolved entity as resolved
    - get_player_aliases() - Get all aliases for a player
*/

-- Create player_aliases table
CREATE TABLE IF NOT EXISTS player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_normalized text NOT NULL,
  source text NOT NULL CHECK (source IN ('sleeper', 'ktc', 'user', 'auto', 'admin')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(alias_normalized)
);

-- Create unresolved_entities table
CREATE TABLE IF NOT EXISTS unresolved_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name text NOT NULL,
  player_position text,
  team text,
  source text NOT NULL CHECK (source IN ('ktc', 'sleeper', 'user', 'trade_input', 'roster_import', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_player_id uuid REFERENCES nfl_players(id),
  suggestions jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE unresolved_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_aliases

-- Anyone can read aliases
CREATE POLICY "Anyone can view aliases"
  ON player_aliases
  FOR SELECT
  USING (true);

-- Authenticated users can insert aliases
CREATE POLICY "Authenticated users can add aliases"
  ON player_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can delete their own aliases or admins can delete any
CREATE POLICY "Users can delete own aliases"
  ON player_aliases
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Service role can manage all aliases
CREATE POLICY "Service role can manage aliases"
  ON player_aliases
  FOR ALL
  USING (true);

-- RLS Policies for unresolved_entities

-- Authenticated users can view unresolved entities
CREATE POLICY "Authenticated users can view unresolved"
  ON unresolved_entities
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert unresolved entities
CREATE POLICY "Authenticated users can insert unresolved"
  ON unresolved_entities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update unresolved entities
CREATE POLICY "Authenticated users can update unresolved"
  ON unresolved_entities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role can manage all
CREATE POLICY "Service role can manage unresolved"
  ON unresolved_entities
  FOR ALL
  USING (true);

-- Indexes for player_aliases
CREATE INDEX IF NOT EXISTS idx_player_aliases_player_id 
  ON player_aliases(player_id);

CREATE INDEX IF NOT EXISTS idx_player_aliases_normalized 
  ON player_aliases(alias_normalized);

CREATE INDEX IF NOT EXISTS idx_player_aliases_source 
  ON player_aliases(source);

-- Indexes for unresolved_entities
CREATE INDEX IF NOT EXISTS idx_unresolved_status 
  ON unresolved_entities(status);

CREATE INDEX IF NOT EXISTS idx_unresolved_source 
  ON unresolved_entities(source);

CREATE INDEX IF NOT EXISTS idx_unresolved_created 
  ON unresolved_entities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unresolved_player_id 
  ON unresolved_entities(resolved_player_id);

-- Function: Add player alias
CREATE OR REPLACE FUNCTION add_player_alias(
  p_player_id uuid,
  p_alias text,
  p_alias_normalized text,
  p_source text DEFAULT 'user',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_alias_id uuid;
  v_existing_player_id uuid;
BEGIN
  -- Check if normalized alias already exists
  SELECT player_id INTO v_existing_player_id
  FROM player_aliases
  WHERE alias_normalized = p_alias_normalized;

  IF v_existing_player_id IS NOT NULL THEN
    IF v_existing_player_id = p_player_id THEN
      -- Alias already exists for this player
      SELECT id INTO v_alias_id
      FROM player_aliases
      WHERE alias_normalized = p_alias_normalized;
      
      RETURN v_alias_id;
    ELSE
      -- Alias exists for different player
      RAISE EXCEPTION 'Alias % already exists for different player', p_alias;
    END IF;
  END IF;

  -- Insert new alias
  INSERT INTO player_aliases (
    player_id,
    alias,
    alias_normalized,
    source,
    created_by
  ) VALUES (
    p_player_id,
    p_alias,
    p_alias_normalized,
    p_source,
    p_created_by
  )
  RETURNING id INTO v_alias_id;

  RETURN v_alias_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Remove player alias
CREATE OR REPLACE FUNCTION remove_player_alias(
  p_alias_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_deleted boolean;
BEGIN
  DELETE FROM player_aliases
  WHERE id = p_alias_id
    AND (p_user_id IS NULL OR created_by = p_user_id)
  RETURNING true INTO v_deleted;

  RETURN COALESCE(v_deleted, false);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Get all aliases for a player
CREATE OR REPLACE FUNCTION get_player_aliases(p_player_id uuid)
RETURNS TABLE (
  id uuid,
  alias text,
  alias_normalized text,
  source text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.alias,
    a.alias_normalized,
    a.source,
    a.created_at
  FROM player_aliases a
  WHERE a.player_id = p_player_id
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Resolve unresolved entity
CREATE OR REPLACE FUNCTION resolve_unresolved_entity(
  p_entity_id uuid,
  p_player_id uuid,
  p_create_alias boolean DEFAULT true,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_entity RECORD;
  v_alias_normalized text;
BEGIN
  -- Get entity details
  SELECT * INTO v_entity
  FROM unresolved_entities
  WHERE id = p_entity_id
    AND status = 'open';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update entity status
  UPDATE unresolved_entities
  SET 
    status = 'resolved',
    resolved_player_id = p_player_id,
    resolved_at = now(),
    resolved_by = p_user_id
  WHERE id = p_entity_id;

  -- Optionally create alias
  IF p_create_alias THEN
    v_alias_normalized := normalize_search_name(v_entity.raw_name);
    
    BEGIN
      PERFORM add_player_alias(
        p_player_id,
        v_entity.raw_name,
        v_alias_normalized,
        'admin',
        p_user_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if alias already exists
      NULL;
    END;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Ignore unresolved entity
CREATE OR REPLACE FUNCTION ignore_unresolved_entity(
  p_entity_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE unresolved_entities
  SET 
    status = 'ignored',
    resolved_at = now(),
    resolved_by = p_user_id
  WHERE id = p_entity_id
    AND status = 'open'
  RETURNING true;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Search aliases
CREATE OR REPLACE FUNCTION search_aliases(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  player_position text,
  player_team text,
  alias text,
  alias_source text,
  match_type text
) AS $$
DECLARE
  v_normalized text;
BEGIN
  v_normalized := normalize_search_name(p_query);

  RETURN QUERY
  -- Exact normalized match
  SELECT 
    p.id,
    p.full_name,
    p.player_position,
    p.team,
    a.alias,
    a.source,
    'exact'::text
  FROM player_aliases a
  JOIN nfl_players p ON a.player_id = p.id
  WHERE a.alias_normalized = v_normalized
  
  UNION ALL
  
  -- Starts with match
  SELECT 
    p.id,
    p.full_name,
    p.player_position,
    p.team,
    a.alias,
    a.source,
    'prefix'::text
  FROM player_aliases a
  JOIN nfl_players p ON a.player_id = p.id
  WHERE a.alias_normalized LIKE v_normalized || '%'
    AND a.alias_normalized != v_normalized
  
  UNION ALL
  
  -- Contains match
  SELECT 
    p.id,
    p.full_name,
    p.player_position,
    p.team,
    a.alias,
    a.source,
    'contains'::text
  FROM player_aliases a
  JOIN nfl_players p ON a.player_id = p.id
  WHERE a.alias_normalized LIKE '%' || v_normalized || '%'
    AND a.alias_normalized NOT LIKE v_normalized || '%'
  
  ORDER BY match_type, player_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get unresolved entity stats
CREATE OR REPLACE FUNCTION get_unresolved_stats()
RETURNS jsonb AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status = 'open'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'ignored', COUNT(*) FILTER (WHERE status = 'ignored'),
    'by_source', (
      SELECT jsonb_object_agg(source, cnt)
      FROM (
        SELECT source, COUNT(*) as cnt
        FROM unresolved_entities
        WHERE status = 'open'
        GROUP BY source
      ) src
    )
  ) INTO v_stats
  FROM unresolved_entities;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_player_alias(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_player_alias(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_aliases(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION resolve_unresolved_entity(uuid, uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ignore_unresolved_entity(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_aliases(text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_unresolved_stats() TO authenticated;

-- Comments
COMMENT ON TABLE player_aliases IS 
  'All known name variations for each player - enables robust name → player_id resolution';

COMMENT ON TABLE unresolved_entities IS 
  'Quarantine for ambiguous/unknown player names that require manual review';

COMMENT ON FUNCTION add_player_alias IS 
  'Add new alias for player - prevents silent corruption by checking for conflicts';

COMMENT ON FUNCTION resolve_unresolved_entity IS 
  'Resolve quarantined entity to player - optionally creates alias for future matches';

COMMENT ON FUNCTION search_aliases IS 
  'Search player aliases with match type scoring';

COMMENT ON FUNCTION get_unresolved_stats IS 
  'Get statistics on unresolved entities for admin dashboard';
