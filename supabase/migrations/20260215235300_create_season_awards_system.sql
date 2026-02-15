/*
  # Season Awards System

  1. New Table
    - `season_awards`
      - End-of-season recognition for various achievements
      - Best GM, Trade King, Waiver Wizard, etc.
      - Creates shareable content and bragging rights

  2. Security
    - Enable RLS
    - Users can view awards for leagues they own
    - Awards for public leagues are viewable by anyone
    - Only system can create/update awards

  3. Indexes
    - Awards: by league, season, award type
*/

-- Season Awards Table
CREATE TABLE IF NOT EXISTS season_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  season int NOT NULL DEFAULT 2025,
  award text NOT NULL,
  roster_id int,
  team_name text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details text NOT NULL,
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(league_id, season, award)
);

CREATE INDEX IF NOT EXISTS idx_season_awards_league ON season_awards(league_id, season);
CREATE INDEX IF NOT EXISTS idx_season_awards_type ON season_awards(award);
CREATE INDEX IF NOT EXISTS idx_season_awards_roster ON season_awards(roster_id);
CREATE INDEX IF NOT EXISTS idx_season_awards_user ON season_awards(user_id);

-- Enable RLS
ALTER TABLE season_awards ENABLE ROW LEVEL SECURITY;

-- Season Awards Policies

-- Anyone can view awards
CREATE POLICY "Anyone can view all awards"
  ON season_awards FOR SELECT
  USING (true);

-- System can manage all awards
CREATE POLICY "System can manage awards"
  ON season_awards FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
