/*
  # Dynasty Value Rebalance System
  
  1. New Tables
    - `dynasty_adjustments` - Tracks individual value adjustments by signal source
    - `dynasty_value_snapshots` - Historical dynasty values with adjustment breakdown
    - `weekly_player_stats` - Performance data for trend analysis
  
  2. Purpose
    - Enable weekly dynasty value updates based on performance and market trends
    - Maintain transparency with adjustment history
    - Keep values stable yet responsive to real changes
  
  3. Security
    - Enable RLS on all tables
    - Public read access for transparency
    - Service role for writes
*/

-- Dynasty Adjustments Table
CREATE TABLE IF NOT EXISTS dynasty_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  signal_source text NOT NULL CHECK (signal_source IN ('performance', 'market', 'blended')),
  delta integer NOT NULL,
  reason text NOT NULL,
  confidence decimal DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, as_of_date, signal_source)
);

-- Dynasty Value Snapshots Table
CREATE TABLE IF NOT EXISTS dynasty_value_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  dynasty_value integer NOT NULL CHECK (dynasty_value >= 0 AND dynasty_value <= 10000),
  base_dynasty_value integer NOT NULL CHECK (base_dynasty_value >= 0 AND base_dynasty_value <= 10000),
  adjustment_total integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, as_of_date)
);

-- Weekly Player Stats Table
CREATE TABLE IF NOT EXISTS weekly_player_stats (
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  season integer NOT NULL,
  week integer NOT NULL CHECK (week >= 1 AND week <= 18),
  fantasy_points decimal DEFAULT 0,
  snap_share decimal,
  usage decimal,
  targets integer,
  carries integer,
  receptions integer,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, season, week)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dynasty_adjustments_player_date ON dynasty_adjustments(player_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_dynasty_adjustments_date ON dynasty_adjustments(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_dynasty_value_snapshots_player_date ON dynasty_value_snapshots(player_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_dynasty_value_snapshots_date ON dynasty_value_snapshots(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_player_season ON weekly_player_stats(player_id, season DESC, week DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_season_week ON weekly_player_stats(season DESC, week DESC);

-- Enable RLS
ALTER TABLE dynasty_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_value_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_player_stats ENABLE ROW LEVEL SECURITY;

-- Public read policies (transparency)
CREATE POLICY "Anyone can read dynasty adjustments"
  ON dynasty_adjustments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read dynasty value snapshots"
  ON dynasty_value_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read weekly stats"
  ON weekly_player_stats FOR SELECT
  USING (true);

-- Service role write policies
CREATE POLICY "Service role can manage dynasty adjustments"
  ON dynasty_adjustments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage dynasty snapshots"
  ON dynasty_value_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage weekly stats"
  ON weekly_player_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated users can write dynasty adjustments"
  ON dynasty_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can write dynasty snapshots"
  ON dynasty_value_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can write weekly stats"
  ON weekly_player_stats FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Helper function: Get recent adjustments for a player
CREATE OR REPLACE FUNCTION get_recent_dynasty_adjustments(
  p_player_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  adjustment_date date,
  signal_source text,
  delta integer,
  reason text,
  confidence decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.as_of_date,
    da.signal_source,
    da.delta,
    da.reason,
    da.confidence
  FROM dynasty_adjustments da
  WHERE da.player_id = p_player_id
    AND da.as_of_date >= CURRENT_DATE - p_days
  ORDER BY da.as_of_date DESC, da.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate adjustment total for a player
CREATE OR REPLACE FUNCTION calculate_dynasty_adjustment_total(
  p_player_id uuid,
  p_days integer DEFAULT 30
)
RETURNS integer AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(delta), 0)
  INTO total
  FROM dynasty_adjustments
  WHERE player_id = p_player_id
    AND as_of_date >= CURRENT_DATE - p_days;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Get dynasty value history
CREATE OR REPLACE FUNCTION get_dynasty_value_history(
  p_player_id uuid,
  p_days integer DEFAULT 90
)
RETURNS TABLE (
  snapshot_date date,
  dynasty_value integer,
  base_dynasty_value integer,
  adjustment_total integer,
  value_change integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dvs.as_of_date,
    dvs.dynasty_value,
    dvs.base_dynasty_value,
    dvs.adjustment_total,
    dvs.dynasty_value - LAG(dvs.dynasty_value) OVER (ORDER BY dvs.as_of_date) as value_change
  FROM dynasty_value_snapshots dvs
  WHERE dvs.player_id = p_player_id
    AND dvs.as_of_date >= CURRENT_DATE - p_days
  ORDER BY dvs.as_of_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE dynasty_adjustments IS 'Weekly value adjustments based on performance and market signals';
COMMENT ON TABLE dynasty_value_snapshots IS 'Historical dynasty values with adjustment breakdown for transparency';
COMMENT ON TABLE weekly_player_stats IS 'Weekly performance data for trend analysis';
