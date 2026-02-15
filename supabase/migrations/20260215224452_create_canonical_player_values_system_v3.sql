/*
  # Canonical Player Values System v3

  Single Source of Truth for all player values with epoch versioning and atomic swaps.
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS latest_player_values CASCADE;

-- Create value_epochs table
CREATE TABLE IF NOT EXISTS value_epochs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_number serial UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system',
  trigger_reason text,
  players_processed integer DEFAULT 0,
  profiles_processed integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'rolled_back')),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_value_epochs_created_at ON value_epochs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_epochs_status ON value_epochs(status);

-- Backup existing player_values if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_values' AND table_schema = 'public') THEN
    ALTER TABLE player_values RENAME TO player_values_legacy_backup;
  END IF;
END $$;

-- Create canonical player_values table
CREATE TABLE IF NOT EXISTS player_values_canonical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  team text,
  league_profile_id uuid,
  format text NOT NULL DEFAULT 'dynasty' CHECK (format IN ('dynasty', 'redraft', 'bestball')),
  base_value integer NOT NULL DEFAULT 0,
  adjusted_value integer NOT NULL DEFAULT 0,
  market_value integer,
  rank_overall integer,
  rank_position integer,
  tier text CHECK (tier IN ('elite', 'high', 'mid', 'low', 'depth', 'unranked')),
  value_epoch_id uuid REFERENCES value_epochs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  source text DEFAULT 'fdp_model',
  confidence_score numeric(3, 2),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(player_id, league_profile_id, format, value_epoch_id)
);

-- Create staging table
CREATE TABLE IF NOT EXISTS player_values_staging (
  LIKE player_values_canonical INCLUDING ALL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pv_player_id ON player_values_canonical(player_id);
CREATE INDEX IF NOT EXISTS idx_pv_epoch ON player_values_canonical(value_epoch_id);
CREATE INDEX IF NOT EXISTS idx_pv_profile_format ON player_values_canonical(league_profile_id, format);
CREATE INDEX IF NOT EXISTS idx_pv_lookup ON player_values_canonical(player_id, league_profile_id, format, value_epoch_id);
CREATE INDEX IF NOT EXISTS idx_pv_by_value ON player_values_canonical(format, league_profile_id, adjusted_value DESC);

-- Create latest values view
CREATE OR REPLACE VIEW latest_player_values AS
SELECT pv.*
FROM player_values_canonical pv
WHERE pv.value_epoch_id = (
  SELECT id FROM value_epochs WHERE status = 'active' ORDER BY epoch_number DESC LIMIT 1
);

-- Enable RLS
ALTER TABLE value_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_values_canonical ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_values_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read epochs" ON value_epochs;
CREATE POLICY "Anyone can read epochs"
  ON value_epochs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage epochs" ON value_epochs;
CREATE POLICY "Service role can manage epochs"
  ON value_epochs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read player values" ON player_values_canonical;
CREATE POLICY "Anyone can read player values"
  ON player_values_canonical FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage player values" ON player_values_canonical;
CREATE POLICY "Service role can manage player values"
  ON player_values_canonical FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage staging" ON player_values_staging;
CREATE POLICY "Service role can manage staging"
  ON player_values_staging FOR ALL USING (true) WITH CHECK (true);

-- Helper functions
CREATE OR REPLACE FUNCTION get_current_epoch()
RETURNS uuid AS $$
  SELECT id FROM value_epochs WHERE status = 'active' ORDER BY epoch_number DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_latest_epoch_number()
RETURNS integer AS $$
  SELECT COALESCE(MAX(epoch_number), 0) FROM value_epochs;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION create_new_epoch(
  p_trigger_reason text DEFAULT 'manual',
  p_created_by text DEFAULT 'system'
)
RETURNS uuid AS $$
DECLARE
  new_epoch_id uuid;
BEGIN
  UPDATE value_epochs SET status = 'archived' WHERE status = 'active';
  INSERT INTO value_epochs (created_by, trigger_reason, status)
  VALUES (p_created_by, p_trigger_reason, 'active')
  RETURNING id INTO new_epoch_id;
  RETURN new_epoch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
