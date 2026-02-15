/*
  # Recreate Top 1000 Value System

  ## Summary
  Drops and recreates the value system to ensure clean schema.

  ## Changes
  1. Add missing columns to nfl_players
  2. Drop and recreate value_snapshots table
  3. Drop and recreate latest_player_values view
  4. Create top_1000_current table
  5. Create sync_status table
*/

-- Drop existing view
DROP VIEW IF EXISTS latest_player_values CASCADE;

-- Add missing columns to nfl_players if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfl_players' AND column_name = 'provider'
  ) THEN
    ALTER TABLE nfl_players ADD COLUMN provider text DEFAULT 'sleeper';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfl_players' AND column_name = 'years_exp'
  ) THEN
    ALTER TABLE nfl_players ADD COLUMN years_exp integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfl_players' AND column_name = 'depth_chart_position'
  ) THEN
    ALTER TABLE nfl_players ADD COLUMN depth_chart_position integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfl_players' AND column_name = 'injury_status'
  ) THEN
    ALTER TABLE nfl_players ADD COLUMN injury_status text;
  END IF;
END $$;

-- Create value_snapshots table
CREATE TABLE IF NOT EXISTS value_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  source text NOT NULL,
  format text NOT NULL,
  position text NOT NULL,
  position_rank integer,
  market_value integer,
  fdp_value integer,
  dynasty_value integer,
  redraft_value integer,
  notes text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_snapshots_player_format ON value_snapshots(player_id, format, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_format_position ON value_snapshots(format, position, position_rank);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_captured ON value_snapshots(captured_at DESC);

ALTER TABLE value_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read value snapshots"
  ON value_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon users to read value snapshots"
  ON value_snapshots
  FOR SELECT
  TO anon
  USING (true);

-- Create latest_player_values view (anti-drift)
CREATE OR REPLACE VIEW latest_player_values AS
SELECT DISTINCT ON (vs.player_id, vs.format)
  vs.id AS snapshot_id,
  vs.player_id,
  vs.source,
  vs.format,
  vs.position,
  vs.position_rank,
  vs.market_value,
  vs.fdp_value,
  vs.dynasty_value,
  vs.redraft_value,
  vs.notes,
  vs.captured_at,
  np.full_name,
  np.search_name,
  np.player_position,
  np.team,
  np.status,
  np.birthdate,
  np.years_exp,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, np.birthdate))::integer AS age
FROM value_snapshots vs
JOIN nfl_players np ON vs.player_id = np.id
ORDER BY vs.player_id, vs.format, vs.captured_at DESC;

-- Grant access to the view
GRANT SELECT ON latest_player_values TO authenticated;
GRANT SELECT ON latest_player_values TO anon;

-- Create top_1000_current table
CREATE TABLE IF NOT EXISTS top_1000_current (
  as_of_date date NOT NULL,
  format text NOT NULL,
  items jsonb NOT NULL,
  offense_count integer,
  idp_count integer,
  total_count integer,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (as_of_date, format)
);

ALTER TABLE top_1000_current ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read top 1000"
  ON top_1000_current
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon users to read top 1000"
  ON top_1000_current
  FOR SELECT
  TO anon
  USING (true);

-- Create sync_status table
CREATE TABLE IF NOT EXISTS sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_ms integer,
  records_processed integer,
  records_created integer,
  records_updated integer,
  unresolved_count integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_status_type_completed ON sync_status(sync_type, completed_at DESC);

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read sync status"
  ON sync_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Add helpful comments
COMMENT ON TABLE value_snapshots IS 'Time series of player values from multiple sources and formats';
COMMENT ON VIEW latest_player_values IS 'Anti-drift view - always returns the most recent value snapshot per player per format';
COMMENT ON TABLE top_1000_current IS 'Materialized top 1000 players list for fast reads';
COMMENT ON TABLE sync_status IS 'Tracks all sync operations for health monitoring';
