/*
  # KTC Value Snapshots System

  1. New Table
    - `ktc_value_snapshots`
      - `id` (uuid, primary key)
      - `player_id` (text) - References player_values.player_id
      - `full_name` (text) - Player name from KTC
      - `position` (text) - Position (QB, RB, WR, TE)
      - `team` (text) - Team abbreviation
      - `position_rank` (integer) - Rank within position (QB1, QB2, etc.)
      - `ktc_value` (integer) - Raw value from KTC
      - `format` (text) - 'dynasty_sf', 'dynasty_1qb', etc.
      - `source` (text) - Always 'KTC'
      - `captured_at` (timestamptz) - When this snapshot was taken
      - `created_at` (timestamptz)

  2. Indexes
    - Fast lookups by player_id and date
    - Fast filtering by position and format
    - Fast sorting by position_rank

  3. Security
    - Enable RLS
    - Public read access for all users
    - Only service role can insert/update
*/

-- Create ktc_value_snapshots table
CREATE TABLE IF NOT EXISTS ktc_value_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text,
  full_name text NOT NULL,
  position text NOT NULL,
  team text,
  position_rank integer NOT NULL,
  ktc_value integer NOT NULL,
  format text NOT NULL DEFAULT 'dynasty_sf',
  source text NOT NULL DEFAULT 'KTC',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_player_date 
  ON ktc_value_snapshots(player_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_position_rank 
  ON ktc_value_snapshots(format, position, position_rank);

CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_captured_at 
  ON ktc_value_snapshots(captured_at DESC);

-- Enable RLS
ALTER TABLE ktc_value_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view KTC snapshots"
  ON ktc_value_snapshots FOR SELECT
  TO public
  USING (true);

-- Service role can manage snapshots
CREATE POLICY "Service role can manage KTC snapshots"
  ON ktc_value_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
