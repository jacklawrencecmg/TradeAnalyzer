/*
  # Player Identity & Data Reconciliation System

  ## Overview
  Prevents corrupted values by ensuring all data sources map to correct players.
  Canonical source of truth for player identity across all providers.

  ## Tables Created

  1. **player_identity** - Canonical player identity
     - `player_id` (uuid, pk) - Internal stable ID
     - `sleeper_id` (text) - Sleeper platform ID
     - `espn_id` (text) - ESPN platform ID
     - `gsis_id` (text) - NFL GSIS ID
     - `fantasypros_id` (text) - FantasyPros ID
     - `full_name` (text) - Official full name
     - `normalized_name` (text) - Normalized for matching
     - `birth_date` (date) - Birth date for disambiguation
     - `birth_year` (int) - Birth year for quick filtering
     - `team` (text) - Current team
     - `position` (text) - Core position (QB/RB/WR/TE/K/DEF/DL/LB/DB)
     - `sub_position` (text) - Sub-position (e.g., EDGE, SAF)
     - `status` (text) - active/inactive/retired
     - `last_seen_source` (text) - Last data source that saw this player
     - `last_seen_at` (timestamptz) - When last seen
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **player_identity_conflicts** - Duplicate detection and conflicts
  3. **player_identity_history** - Track changes over time
  4. **player_merge_log** - Track player merges

  ## Security
  - Enable RLS on all tables
  - Public read access to player_identity
  - Admin-only write access
*/

-- =====================================================
-- 1. PLAYER_IDENTITY TABLE (Canonical Source of Truth)
-- =====================================================

CREATE TABLE IF NOT EXISTS player_identity (
  player_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeper_id text UNIQUE,
  espn_id text UNIQUE,
  gsis_id text UNIQUE,
  fantasypros_id text UNIQUE,
  full_name text NOT NULL,
  normalized_name text NOT NULL,
  birth_date date,
  birth_year int,
  team text,
  position text NOT NULL,
  sub_position text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired', 'unknown')),
  last_seen_source text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_identity_sleeper_id ON player_identity(sleeper_id) WHERE sleeper_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_identity_espn_id ON player_identity(espn_id) WHERE espn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_identity_gsis_id ON player_identity(gsis_id) WHERE gsis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_identity_fantasypros_id ON player_identity(fantasypros_id) WHERE fantasypros_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_identity_normalized_name ON player_identity(normalized_name);
CREATE INDEX IF NOT EXISTS idx_player_identity_full_name ON player_identity(full_name);
CREATE INDEX IF NOT EXISTS idx_player_identity_team_position ON player_identity(team, position);
CREATE INDEX IF NOT EXISTS idx_player_identity_birth_year ON player_identity(birth_year) WHERE birth_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_identity_status ON player_identity(status);
CREATE INDEX IF NOT EXISTS idx_player_identity_last_seen ON player_identity(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_player_identity_name_team ON player_identity(normalized_name, team);
CREATE INDEX IF NOT EXISTS idx_player_identity_name_position ON player_identity(normalized_name, position);

-- =====================================================
-- 2. PLAYER_IDENTITY_CONFLICTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS player_identity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id uuid NOT NULL REFERENCES player_identity(player_id) ON DELETE CASCADE,
  player_b_id uuid NOT NULL REFERENCES player_identity(player_id) ON DELETE CASCADE,
  conflict_type text NOT NULL CHECK (conflict_type IN (
    'duplicate_name',
    'duplicate_external_id',
    'position_mismatch',
    'team_mismatch',
    'birth_date_mismatch',
    'possible_duplicate',
    'impossible_match'
  )),
  reason text NOT NULL,
  confidence numeric(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  detected_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution_action text,
  reviewed_by uuid,
  metadata jsonb,
  CONSTRAINT different_players CHECK (player_a_id != player_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_player_a ON player_identity_conflicts(player_a_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_player_b ON player_identity_conflicts(player_b_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON player_identity_conflicts(resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_conflicts_high_confidence ON player_identity_conflicts(confidence) WHERE confidence >= 0.9;
CREATE INDEX IF NOT EXISTS idx_conflicts_type ON player_identity_conflicts(conflict_type);

-- =====================================================
-- 3. PLAYER_IDENTITY_HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS player_identity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES player_identity(player_id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN (
    'team_change',
    'position_change',
    'name_change',
    'status_change',
    'external_id_added',
    'external_id_updated',
    'created'
  )),
  old_value jsonb,
  new_value jsonb NOT NULL,
  source text NOT NULL,
  confidence numeric(3, 2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  changed_at timestamptz DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_identity_history_player ON player_identity_history(player_id);
CREATE INDEX IF NOT EXISTS idx_identity_history_change_type ON player_identity_history(change_type);
CREATE INDEX IF NOT EXISTS idx_identity_history_changed_at ON player_identity_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_identity_history_source ON player_identity_history(source);

-- =====================================================
-- 4. PLAYER_MERGE_LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS player_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_player_id uuid NOT NULL REFERENCES player_identity(player_id) ON DELETE CASCADE,
  merged_player_id uuid NOT NULL,
  reason text NOT NULL,
  merged_data jsonb,
  merged_at timestamptz DEFAULT now(),
  merged_by text NOT NULL,
  CONSTRAINT different_merge_players CHECK (primary_player_id != merged_player_id)
);

CREATE INDEX IF NOT EXISTS idx_merge_log_primary ON player_merge_log(primary_player_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_merged ON player_merge_log(merged_player_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_merged_at ON player_merge_log(merged_at);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_player_name(name text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'),
        '\s+', ' ', 'g'
      ),
      '(^|\s)(jr|sr|ii|iii|iv)(\s|$)', '', 'gi'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_player_identity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_identity_updated_at
  BEFORE UPDATE ON player_identity
  FOR EACH ROW
  EXECUTE FUNCTION update_player_identity_updated_at();

CREATE OR REPLACE FUNCTION auto_normalize_player_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.normalized_name IS NULL OR NEW.normalized_name = '' THEN
    NEW.normalized_name = normalize_player_name(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_identity_normalize_name
  BEFORE INSERT OR UPDATE OF full_name ON player_identity
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_player_name();

CREATE OR REPLACE FUNCTION auto_extract_birth_year()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND (NEW.birth_year IS NULL OR OLD.birth_date != NEW.birth_date) THEN
    NEW.birth_year = EXTRACT(YEAR FROM NEW.birth_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_identity_extract_birth_year
  BEFORE INSERT OR UPDATE OF birth_date ON player_identity
  FOR EACH ROW
  EXECUTE FUNCTION auto_extract_birth_year();

CREATE OR REPLACE FUNCTION log_player_identity_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.team IS DISTINCT FROM NEW.team THEN
    INSERT INTO player_identity_history (player_id, change_type, old_value, new_value, source)
    VALUES (
      NEW.player_id,
      'team_change',
      jsonb_build_object('team', OLD.team),
      jsonb_build_object('team', NEW.team),
      COALESCE(NEW.last_seen_source, 'unknown')
    );
  END IF;

  IF OLD.position IS DISTINCT FROM NEW.position THEN
    INSERT INTO player_identity_history (player_id, change_type, old_value, new_value, source)
    VALUES (
      NEW.player_id,
      'position_change',
      jsonb_build_object('position', OLD.position, 'sub_position', OLD.sub_position),
      jsonb_build_object('position', NEW.position, 'sub_position', NEW.sub_position),
      COALESCE(NEW.last_seen_source, 'unknown')
    );
  END IF;

  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    INSERT INTO player_identity_history (player_id, change_type, old_value, new_value, source)
    VALUES (
      NEW.player_id,
      'name_change',
      jsonb_build_object('full_name', OLD.full_name),
      jsonb_build_object('full_name', NEW.full_name),
      COALESCE(NEW.last_seen_source, 'unknown')
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO player_identity_history (player_id, change_type, old_value, new_value, source)
    VALUES (
      NEW.player_id,
      'status_change',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      COALESCE(NEW.last_seen_source, 'unknown')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_identity_log_changes
  AFTER UPDATE ON player_identity
  FOR EACH ROW
  EXECUTE FUNCTION log_player_identity_changes();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE player_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_identity_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_identity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read player identity"
  ON player_identity FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can insert player identity"
  ON player_identity FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update player identity"
  ON player_identity FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete player identity"
  ON player_identity FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Anyone can read conflicts"
  ON player_identity_conflicts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage conflicts"
  ON player_identity_conflicts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read history"
  ON player_identity_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write history"
  ON player_identity_history FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Anyone can read merge log"
  ON player_merge_log FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can write merge log"
  ON player_merge_log FOR INSERT
  TO service_role
  WITH CHECK (true);