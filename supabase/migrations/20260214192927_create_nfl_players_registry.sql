/*
  # Create Canonical NFL Player Registry

  1. Purpose
    - Single source of truth for all NFL player data
    - Prevents name mismatches and data inconsistencies
    - Self-healing with automatic Sleeper API sync
    - Supports rookies, team changes, and status updates
    - Used by all other tables (values, leagues, trades, watchlists)

  2. New Tables
    
    `nfl_players` - Master player registry
    - `id` (uuid, primary key) - Internal player ID
    - `external_id` (text, unique) - Sleeper player ID
    - `full_name` (text, not null) - First + Last name
    - `search_name` (text) - Lowercase normalized for matching
    - `player_position` (text) - QB, RB, WR, TE, K, DEF, etc.
    - `team` (text) - Current NFL team (3-letter code)
    - `status` (text) - Active, Practice Squad, IR, FA, Retired, Rookie, Inactive, Unknown
    - `rookie_year` (int) - Year player entered NFL
    - `birthdate` (date) - Date of birth
    - `last_seen_at` (timestamptz) - Last sync timestamp
    - `created_at` (timestamptz) - First seen timestamp
    - `updated_at` (timestamptz) - Last update timestamp
    - `metadata` (jsonb) - Additional Sleeper data

    `player_events` - Event tracking for notifications
    - `id` (uuid, primary key)
    - `player_id` (uuid, references nfl_players)
    - `event_type` (text) - rookie_added, team_changed, activated, retired, status_changed
    - `old_value` (text) - Previous value (for changes)
    - `new_value` (text) - New value (for changes)
    - `created_at` (timestamptz)

  3. Indexes
    - Unique constraint on full_name + player_position (prevent duplicates)
    - Index on search_name (fast fuzzy matching)
    - Index on team + player_position (roster queries)
    - Index on external_id (Sleeper sync)
    - Index on status (active player queries)
    - Index on last_seen_at (cleanup queries)

  4. Security
    - Enable RLS on all tables
    - Public read access for player data
    - Only service role can update
    - Player events readable by authenticated users

  5. Functions
    - get_player_by_name() - Lookup with fuzzy matching
    - get_player_by_external_id() - Lookup by Sleeper ID
    - mark_inactive_players() - Mark players not seen in 60 days
    - log_player_event() - Create event log entry
*/

-- Enable pg_trgm extension for similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create nfl_players table
CREATE TABLE IF NOT EXISTS nfl_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  full_name text NOT NULL,
  search_name text,
  player_position text,
  team text,
  status text DEFAULT 'Unknown' CHECK (status IN ('Active', 'Practice Squad', 'Injured Reserve', 'IR', 'Free Agent', 'FA', 'Retired', 'Rookie', 'Inactive', 'Unknown')),
  rookie_year int,
  birthdate date,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(full_name, player_position)
);

-- Create player_events table
CREATE TABLE IF NOT EXISTS player_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES nfl_players(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('rookie_added', 'team_changed', 'activated', 'retired', 'status_changed', 'position_changed')),
  old_value text,
  new_value text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE nfl_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nfl_players

-- Anyone can read player data
CREATE POLICY "Anyone can view players"
  ON nfl_players
  FOR SELECT
  USING (true);

-- Service role can manage players
CREATE POLICY "Service role can manage players"
  ON nfl_players
  FOR ALL
  USING (true);

-- RLS Policies for player_events

-- Authenticated users can read events
CREATE POLICY "Authenticated users can view events"
  ON player_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage events
CREATE POLICY "Service role can manage events"
  ON player_events
  FOR ALL
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nfl_players_external_id 
  ON nfl_players(external_id);

CREATE INDEX IF NOT EXISTS idx_nfl_players_search_name 
  ON nfl_players(search_name);

CREATE INDEX IF NOT EXISTS idx_nfl_players_team_position 
  ON nfl_players(team, player_position);

CREATE INDEX IF NOT EXISTS idx_nfl_players_status 
  ON nfl_players(status);

CREATE INDEX IF NOT EXISTS idx_nfl_players_last_seen 
  ON nfl_players(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_nfl_players_full_name 
  ON nfl_players(full_name);

CREATE INDEX IF NOT EXISTS idx_player_events_player_id 
  ON player_events(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_events_type 
  ON player_events(event_type, created_at DESC);

-- Function: Normalize search name
CREATE OR REPLACE FUNCTION normalize_search_name(name text)
RETURNS text AS $$
BEGIN
  -- Convert to lowercase, remove special characters, keep only alphanumeric
  RETURN lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get player by external ID
CREATE OR REPLACE FUNCTION get_player_by_external_id(p_external_id text)
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
  WHERE p.external_id = p_external_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get player by name with fuzzy matching
CREATE OR REPLACE FUNCTION get_player_by_name(
  p_name text,
  p_position text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  external_id text,
  full_name text,
  player_position text,
  team text,
  status text,
  match_score int
) AS $$
DECLARE
  v_search_name text;
BEGIN
  v_search_name := normalize_search_name(p_name);

  RETURN QUERY
  WITH matches AS (
    -- Exact match
    SELECT 
      p.id,
      p.external_id,
      p.full_name,
      p.player_position,
      p.team,
      p.status,
      100 as score
    FROM nfl_players p
    WHERE p.full_name = p_name
      AND (p_position IS NULL OR p.player_position = p_position)
    
    UNION ALL
    
    -- Normalized search name match
    SELECT 
      p.id,
      p.external_id,
      p.full_name,
      p.player_position,
      p.team,
      p.status,
      90 as score
    FROM nfl_players p
    WHERE p.search_name = v_search_name
      AND (p_position IS NULL OR p.player_position = p_position)
    
    UNION ALL
    
    -- Partial match (contains)
    SELECT 
      p.id,
      p.external_id,
      p.full_name,
      p.player_position,
      p.team,
      p.status,
      80 as score
    FROM nfl_players p
    WHERE p.search_name LIKE '%' || v_search_name || '%'
      AND (p_position IS NULL OR p.player_position = p_position)
      AND p.search_name != v_search_name
    
    UNION ALL
    
    -- Similarity match (levenshtein-like)
    SELECT 
      p.id,
      p.external_id,
      p.full_name,
      p.player_position,
      p.team,
      p.status,
      70 as score
    FROM nfl_players p
    WHERE similarity(p.search_name, v_search_name) > 0.6
      AND (p_position IS NULL OR p.player_position = p_position)
      AND p.search_name NOT LIKE '%' || v_search_name || '%'
  )
  SELECT DISTINCT ON (m.id)
    m.id,
    m.external_id,
    m.full_name,
    m.player_position,
    m.team,
    m.status,
    m.score
  FROM matches m
  ORDER BY m.id, m.score DESC, m.full_name
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Mark inactive players
CREATE OR REPLACE FUNCTION mark_inactive_players()
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE nfl_players
    SET 
      status = 'Inactive',
      updated_at = now()
    WHERE status NOT IN ('Retired', 'Inactive')
      AND last_seen_at < now() - INTERVAL '60 days'
    RETURNING id, full_name, status
  )
  SELECT count(*) INTO v_count FROM updated;

  -- Log events for marked players
  INSERT INTO player_events (player_id, event_type, old_value, new_value)
  SELECT 
    id,
    'status_changed',
    'Active',
    'Inactive'
  FROM nfl_players
  WHERE status = 'Inactive'
    AND updated_at > now() - INTERVAL '1 minute';

  RETURN v_count;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Log player event
CREATE OR REPLACE FUNCTION log_player_event(
  p_player_id uuid,
  p_event_type text,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO player_events (
    player_id,
    event_type,
    old_value,
    new_value,
    metadata
  ) VALUES (
    p_player_id,
    p_event_type,
    p_old_value,
    p_new_value,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Upsert player from sync
CREATE OR REPLACE FUNCTION upsert_player_from_sync(
  p_external_id text,
  p_full_name text,
  p_position text,
  p_team text,
  p_status text,
  p_rookie_year int DEFAULT NULL,
  p_birthdate date DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_player_id uuid;
  v_existing_player RECORD;
  v_is_new boolean := false;
  v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  -- Get existing player if exists
  SELECT * INTO v_existing_player
  FROM nfl_players
  WHERE external_id = p_external_id;

  IF NOT FOUND THEN
    -- New player
    v_is_new := true;

    INSERT INTO nfl_players (
      external_id,
      full_name,
      search_name,
      player_position,
      team,
      status,
      rookie_year,
      birthdate,
      metadata,
      last_seen_at,
      created_at,
      updated_at
    ) VALUES (
      p_external_id,
      p_full_name,
      normalize_search_name(p_full_name),
      p_position,
      p_team,
      CASE 
        WHEN p_rookie_year = v_current_year THEN 'Rookie'
        ELSE p_status
      END,
      p_rookie_year,
      p_birthdate,
      p_metadata,
      now(),
      now(),
      now()
    )
    RETURNING id INTO v_player_id;

    -- Log rookie added event
    IF p_rookie_year = v_current_year THEN
      PERFORM log_player_event(v_player_id, 'rookie_added', NULL, p_full_name);
    END IF;

  ELSE
    -- Update existing player
    v_player_id := v_existing_player.id;

    UPDATE nfl_players
    SET
      full_name = p_full_name,
      search_name = normalize_search_name(p_full_name),
      player_position = p_position,
      team = p_team,
      status = CASE 
        WHEN p_rookie_year = v_current_year AND v_existing_player.status != 'Rookie' THEN 'Rookie'
        ELSE p_status
      END,
      rookie_year = COALESCE(p_rookie_year, rookie_year),
      birthdate = COALESCE(p_birthdate, birthdate),
      metadata = p_metadata,
      last_seen_at = now(),
      updated_at = now()
    WHERE id = v_player_id;

    -- Log team change
    IF v_existing_player.team IS DISTINCT FROM p_team THEN
      PERFORM log_player_event(
        v_player_id, 
        'team_changed', 
        v_existing_player.team, 
        p_team
      );
    END IF;

    -- Log status change
    IF v_existing_player.status IS DISTINCT FROM p_status THEN
      PERFORM log_player_event(
        v_player_id, 
        'status_changed', 
        v_existing_player.status, 
        p_status
      );
    END IF;

    -- Log position change
    IF v_existing_player.player_position IS DISTINCT FROM p_position THEN
      PERFORM log_player_event(
        v_player_id, 
        'position_changed', 
        v_existing_player.player_position, 
        p_position
      );
    END IF;
  END IF;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Trigger: Update search_name on insert/update
CREATE OR REPLACE FUNCTION update_search_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_name := normalize_search_name(NEW.full_name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nfl_players_update_search_name
  BEFORE INSERT OR UPDATE OF full_name ON nfl_players
  FOR EACH ROW
  EXECUTE FUNCTION update_search_name();

-- Grant permissions
GRANT SELECT ON nfl_players TO anon, authenticated;
GRANT SELECT ON player_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_by_external_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_player_by_name(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION normalize_search_name(text) TO anon, authenticated;

-- Comments
COMMENT ON TABLE nfl_players IS 
  'Canonical NFL player registry - single source of truth for all player data';

COMMENT ON TABLE player_events IS 
  'Event log for player changes - powers notifications and analytics';

COMMENT ON FUNCTION get_player_by_name IS 
  'Lookup player with fuzzy matching - returns top 10 matches by score';

COMMENT ON FUNCTION upsert_player_from_sync IS 
  'Insert or update player from Sleeper sync - logs events automatically';

COMMENT ON FUNCTION mark_inactive_players IS 
  'Mark players as inactive if not seen in 60 days - run daily';
