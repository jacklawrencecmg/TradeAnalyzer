/*
  # KTC-Style Player Values Enhancements

  1. New Tables
    - `player_value_history`
      - Tracks historical value snapshots over time
      - Enables trend charts and value change analytics
      - `id` (uuid, primary key)
      - `player_id` (text, foreign key)
      - `value` (integer) - Value at this snapshot
      - `source` (text) - 'ktc' or 'fdp'
      - `snapshot_date` (date) - Date of this snapshot
      - `created_at` (timestamptz)
    
    - `dynasty_draft_picks`
      - Draft pick values for trade comparisons
      - `id` (uuid, primary key)
      - `pick_id` (text) - e.g., '2024_1.01', '2025_2.05'
      - `year` (integer) - Draft year
      - `round` (integer) - Draft round (1-4)
      - `pick_number` (integer) - Pick within round (1-12)
      - `value` (integer) - Current value
      - `display_name` (text) - e.g., '2024 1.01'
      - `last_updated` (timestamptz)
    
    - Enhanced player_values columns:
      - `age` (decimal) - Player age
      - `years_experience` (integer)
      - `injury_status` (text) - 'healthy', 'questionable', 'doubtful', 'out', 'ir'
      - `bye_week` (integer)
      - `college` (text)
      - `draft_year` (integer)
      - `draft_round` (integer)
      - `draft_pick` (integer)
      - `contract_years_remaining` (integer)
      - `tier` (text) - 'elite', 'tier1', 'tier2', 'tier3', 'flex', 'depth'
      - `volatility_score` (decimal) - How volatile the value is

  2. New Tables for Analytics
    - `player_value_changes`
      - Pre-calculated value changes for performance
      - `player_id` (text, primary key)
      - `change_7d` (integer) - 7-day change
      - `change_30d` (integer) - 30-day change
      - `change_season` (integer) - Season-long change
      - `percent_7d` (decimal)
      - `percent_30d` (decimal)
      - `percent_season` (decimal)
      - `last_calculated` (timestamptz)

  3. Security
    - Enable RLS on all new tables
    - Public read access for all data
    - Service role can manage all data
*/

-- Add new columns to player_values
ALTER TABLE player_values
  ADD COLUMN IF NOT EXISTS age decimal,
  ADD COLUMN IF NOT EXISTS years_experience integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS injury_status text DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS bye_week integer,
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS draft_year integer,
  ADD COLUMN IF NOT EXISTS draft_round integer,
  ADD COLUMN IF NOT EXISTS draft_pick integer,
  ADD COLUMN IF NOT EXISTS contract_years_remaining integer,
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'flex',
  ADD COLUMN IF NOT EXISTS volatility_score decimal DEFAULT 0;

-- Create player_value_history table
CREATE TABLE IF NOT EXISTS player_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  value integer NOT NULL,
  source text DEFAULT 'fdp',
  snapshot_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, source, snapshot_date),
  FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE CASCADE
);

-- Create dynasty_draft_picks table
CREATE TABLE IF NOT EXISTS dynasty_draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id text UNIQUE NOT NULL,
  year integer NOT NULL,
  round integer NOT NULL,
  pick_number integer NOT NULL,
  value integer DEFAULT 0,
  display_name text NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create player_value_changes table for analytics
CREATE TABLE IF NOT EXISTS player_value_changes (
  player_id text PRIMARY KEY,
  change_7d integer DEFAULT 0,
  change_30d integer DEFAULT 0,
  change_season integer DEFAULT 0,
  percent_7d decimal DEFAULT 0,
  percent_30d decimal DEFAULT 0,
  percent_season decimal DEFAULT 0,
  last_calculated timestamptz DEFAULT now(),
  FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_value_history_player_date 
  ON player_value_history(player_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_value_history_snapshot_date 
  ON player_value_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_dynasty_picks_year_round 
  ON dynasty_draft_picks(year, round, pick_number);
CREATE INDEX IF NOT EXISTS idx_player_values_tier 
  ON player_values(tier);
CREATE INDEX IF NOT EXISTS idx_player_values_injury 
  ON player_values(injury_status);
CREATE INDEX IF NOT EXISTS idx_player_values_draft_year 
  ON player_values(draft_year);

-- Enable RLS
ALTER TABLE player_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_value_changes ENABLE ROW LEVEL SECURITY;

-- Policies for player_value_history (public read)
CREATE POLICY "Anyone can view value history"
  ON player_value_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage value history"
  ON player_value_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for dynasty_draft_picks (public read)
CREATE POLICY "Anyone can view draft picks"
  ON dynasty_draft_picks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage draft picks"
  ON dynasty_draft_picks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for player_value_changes (public read)
CREATE POLICY "Anyone can view value changes"
  ON player_value_changes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage value changes"
  ON player_value_changes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to calculate value changes (can be run periodically)
CREATE OR REPLACE FUNCTION calculate_player_value_changes()
RETURNS void AS $$
BEGIN
  INSERT INTO player_value_changes (player_id, change_7d, change_30d, change_season, percent_7d, percent_30d, percent_season, last_calculated)
  SELECT 
    pv.player_id,
    COALESCE(pv.fdp_value - h7.value, 0) as change_7d,
    COALESCE(pv.fdp_value - h30.value, 0) as change_30d,
    COALESCE(pv.fdp_value - hseason.value, 0) as change_season,
    CASE WHEN h7.value > 0 THEN ROUND(((pv.fdp_value - h7.value)::decimal / h7.value * 100), 2) ELSE 0 END as percent_7d,
    CASE WHEN h30.value > 0 THEN ROUND(((pv.fdp_value - h30.value)::decimal / h30.value * 100), 2) ELSE 0 END as percent_30d,
    CASE WHEN hseason.value > 0 THEN ROUND(((pv.fdp_value - hseason.value)::decimal / hseason.value * 100), 2) ELSE 0 END as percent_season,
    now()
  FROM player_values pv
  LEFT JOIN LATERAL (
    SELECT value FROM player_value_history 
    WHERE player_id = pv.player_id AND source = 'fdp' 
      AND snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY snapshot_date ASC LIMIT 1
  ) h7 ON true
  LEFT JOIN LATERAL (
    SELECT value FROM player_value_history 
    WHERE player_id = pv.player_id AND source = 'fdp' 
      AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY snapshot_date ASC LIMIT 1
  ) h30 ON true
  LEFT JOIN LATERAL (
    SELECT value FROM player_value_history 
    WHERE player_id = pv.player_id AND source = 'fdp' 
      AND snapshot_date >= CURRENT_DATE - INTERVAL '120 days'
    ORDER BY snapshot_date ASC LIMIT 1
  ) hseason ON true
  ON CONFLICT (player_id) 
  DO UPDATE SET
    change_7d = EXCLUDED.change_7d,
    change_30d = EXCLUDED.change_30d,
    change_season = EXCLUDED.change_season,
    percent_7d = EXCLUDED.percent_7d,
    percent_30d = EXCLUDED.percent_30d,
    percent_season = EXCLUDED.percent_season,
    last_calculated = EXCLUDED.last_calculated;
END;
$$ LANGUAGE plpgsql;

-- Insert initial dynasty draft pick values (standard rookie pick values)
INSERT INTO dynasty_draft_picks (pick_id, year, round, pick_number, display_name, value) VALUES
  -- 2024 picks
  ('2024_1.01', 2024, 1, 1, '2024 1.01', 9500),
  ('2024_1.02', 2024, 1, 2, '2024 1.02', 9000),
  ('2024_1.03', 2024, 1, 3, '2024 1.03', 8500),
  ('2024_1.04', 2024, 1, 4, '2024 1.04', 8000),
  ('2024_1.05', 2024, 1, 5, '2024 1.05', 7500),
  ('2024_1.06', 2024, 1, 6, '2024 1.06', 7000),
  ('2024_1.07', 2024, 1, 7, '2024 1.07', 6500),
  ('2024_1.08', 2024, 1, 8, '2024 1.08', 6000),
  ('2024_1.09', 2024, 1, 9, '2024 1.09', 5500),
  ('2024_1.10', 2024, 1, 10, '2024 1.10', 5000),
  ('2024_1.11', 2024, 1, 11, '2024 1.11', 4800),
  ('2024_1.12', 2024, 1, 12, '2024 1.12', 4600),
  ('2024_2.01', 2024, 2, 1, '2024 2.01', 3500),
  ('2024_2.02', 2024, 2, 2, '2024 2.02', 3300),
  ('2024_2.03', 2024, 2, 3, '2024 2.03', 3100),
  ('2024_2.04', 2024, 2, 4, '2024 2.04', 2900),
  ('2024_2.05', 2024, 2, 5, '2024 2.05', 2700),
  ('2024_2.06', 2024, 2, 6, '2024 2.06', 2500),
  ('2024_2.07', 2024, 2, 7, '2024 2.07', 2300),
  ('2024_2.08', 2024, 2, 8, '2024 2.08', 2100),
  ('2024_2.09', 2024, 2, 9, '2024 2.09', 2000),
  ('2024_2.10', 2024, 2, 10, '2024 2.10', 1900),
  ('2024_2.11', 2024, 2, 11, '2024 2.11', 1800),
  ('2024_2.12', 2024, 2, 12, '2024 2.12', 1700),
  ('2024_3.01', 2024, 3, 1, '2024 3.01', 1200),
  ('2024_3.02', 2024, 3, 2, '2024 3.02', 1100),
  ('2024_3.03', 2024, 3, 3, '2024 3.03', 1000),
  ('2024_3.04', 2024, 3, 4, '2024 3.04', 950),
  ('2024_3.05', 2024, 3, 5, '2024 3.05', 900),
  ('2024_3.06', 2024, 3, 6, '2024 3.06', 850),
  ('2024_3.07', 2024, 3, 7, '2024 3.07', 800),
  ('2024_3.08', 2024, 3, 8, '2024 3.08', 750),
  ('2024_3.09', 2024, 3, 9, '2024 3.09', 700),
  ('2024_3.10', 2024, 3, 10, '2024 3.10', 650),
  ('2024_3.11', 2024, 3, 11, '2024 3.11', 600),
  ('2024_3.12', 2024, 3, 12, '2024 3.12', 550),
  -- 2025 picks (higher value due to future uncertainty)
  ('2025_1.01', 2025, 1, 1, '2025 1.01', 8500),
  ('2025_1.02', 2025, 1, 2, '2025 1.02', 8000),
  ('2025_1.03', 2025, 1, 3, '2025 1.03', 7500),
  ('2025_1.04', 2025, 1, 4, '2025 1.04', 7000),
  ('2025_1.05', 2025, 1, 5, '2025 1.05', 6600),
  ('2025_1.06', 2025, 1, 6, '2025 1.06', 6200),
  ('2025_1.07', 2025, 1, 7, '2025 1.07', 5800),
  ('2025_1.08', 2025, 1, 8, '2025 1.08', 5400),
  ('2025_1.09', 2025, 1, 9, '2025 1.09', 5000),
  ('2025_1.10', 2025, 1, 10, '2025 1.10', 4700),
  ('2025_1.11', 2025, 1, 11, '2025 1.11', 4500),
  ('2025_1.12', 2025, 1, 12, '2025 1.12', 4300),
  ('2025_2.01', 2025, 2, 1, '2025 2.01', 3200),
  ('2025_2.02', 2025, 2, 2, '2025 2.02', 3000),
  ('2025_2.03', 2025, 2, 3, '2025 2.03', 2800),
  ('2025_2.04', 2025, 2, 4, '2025 2.04', 2650),
  ('2025_2.05', 2025, 2, 5, '2025 2.05', 2500),
  ('2025_2.06', 2025, 2, 6, '2025 2.06', 2350),
  ('2025_2.07', 2025, 2, 7, '2025 2.07', 2200),
  ('2025_2.08', 2025, 2, 8, '2025 2.08', 2050),
  ('2025_2.09', 2025, 2, 9, '2025 2.09', 1950),
  ('2025_2.10', 2025, 2, 10, '2025 2.10', 1850),
  ('2025_2.11', 2025, 2, 11, '2025 2.11', 1750),
  ('2025_2.12', 2025, 2, 12, '2025 2.12', 1650),
  ('2025_3.01', 2025, 3, 1, '2025 3.01', 1100),
  ('2025_3.02', 2025, 3, 2, '2025 3.02', 1000),
  ('2025_3.03', 2025, 3, 3, '2025 3.03', 950),
  ('2025_3.04', 2025, 3, 4, '2025 3.04', 900),
  ('2025_3.05', 2025, 3, 5, '2025 3.05', 850),
  ('2025_3.06', 2025, 3, 6, '2025 3.06', 800),
  ('2025_3.07', 2025, 3, 7, '2025 3.07', 750),
  ('2025_3.08', 2025, 3, 8, '2025 3.08', 700),
  ('2025_3.09', 2025, 3, 9, '2025 3.09', 650),
  ('2025_3.10', 2025, 3, 10, '2025 3.10', 600),
  ('2025_3.11', 2025, 3, 11, '2025 3.11', 550),
  ('2025_3.12', 2025, 3, 12, '2025 3.12', 500),
  -- 2026 picks (even more devalued)
  ('2026_1.01', 2026, 1, 1, '2026 1.01', 7500),
  ('2026_1.02', 2026, 1, 2, '2026 1.02', 7000),
  ('2026_1.03', 2026, 1, 3, '2026 1.03', 6500),
  ('2026_1.04', 2026, 1, 4, '2026 1.04', 6000),
  ('2026_1.05', 2026, 1, 5, '2026 1.05', 5700),
  ('2026_1.06', 2026, 1, 6, '2026 1.06', 5400),
  ('2026_1.07', 2026, 1, 7, '2026 1.07', 5100),
  ('2026_1.08', 2026, 1, 8, '2026 1.08', 4800),
  ('2026_1.09', 2026, 1, 9, '2026 1.09', 4500),
  ('2026_1.10', 2026, 1, 10, '2026 1.10', 4300),
  ('2026_1.11', 2026, 1, 11, '2026 1.11', 4100),
  ('2026_1.12', 2026, 1, 12, '2026 1.12', 3900),
  ('2026_2.01', 2026, 2, 1, '2026 2.01', 2800),
  ('2026_2.02', 2026, 2, 2, '2026 2.02', 2650),
  ('2026_2.03', 2026, 2, 3, '2026 2.03', 2500),
  ('2026_2.04', 2026, 2, 4, '2026 2.04', 2400),
  ('2026_2.05', 2026, 2, 5, '2026 2.05', 2300),
  ('2026_2.06', 2026, 2, 6, '2026 2.06', 2200),
  ('2026_2.07', 2026, 2, 7, '2026 2.07', 2100),
  ('2026_2.08', 2026, 2, 8, '2026 2.08', 2000),
  ('2026_2.09', 2026, 2, 9, '2026 2.09', 1900),
  ('2026_2.10', 2026, 2, 10, '2026 2.10', 1800),
  ('2026_2.11', 2026, 2, 11, '2026 2.11', 1700),
  ('2026_2.12', 2026, 2, 12, '2026 2.12', 1600)
ON CONFLICT (pick_id) DO NOTHING;
