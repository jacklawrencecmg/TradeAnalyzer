/*
  # Add League Power Rankings Table

  ## Changes
  1. New Table: `league_power_rankings`
     - Stores calculated power rankings for teams in leagues
     - Includes team strength metrics and performance data
     - Historical tracking of rankings over time
  
  2. Security
     - Enable RLS on league_power_rankings table
     - Users can view rankings for their leagues
     - Only authenticated users can access rankings
  
  ## Notes
  - Power rankings are calculated based on roster strength, record, and performance
  - Supports weekly updates to track team trends
  - Data persists for historical analysis
*/

-- Create league_power_rankings table
CREATE TABLE IF NOT EXISTS league_power_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  league_id text NOT NULL,
  team_id text NOT NULL,
  team_name text NOT NULL,
  rank integer NOT NULL,
  power_score numeric DEFAULT 0,
  roster_strength numeric DEFAULT 0,
  record_score numeric DEFAULT 0,
  schedule_strength numeric DEFAULT 0,
  recent_performance numeric DEFAULT 0,
  week integer,
  season integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_league_power_rankings_user_league ON league_power_rankings(user_id, league_id);
CREATE INDEX IF NOT EXISTS idx_league_power_rankings_league_week ON league_power_rankings(league_id, week, season);
CREATE INDEX IF NOT EXISTS idx_league_power_rankings_rank ON league_power_rankings(rank);

-- Enable RLS
ALTER TABLE league_power_rankings ENABLE ROW LEVEL SECURITY;

-- Policies for league_power_rankings
CREATE POLICY "Users can view power rankings for their leagues"
  ON league_power_rankings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert power rankings for their leagues"
  ON league_power_rankings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update power rankings for their leagues"
  ON league_power_rankings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete power rankings for their leagues"
  ON league_power_rankings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
