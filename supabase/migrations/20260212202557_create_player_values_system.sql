/*
  # Player Values & Custom Adjustments System

  1. New Tables
    - `player_values`
      - `id` (uuid, primary key)
      - `player_id` (text) - Sleeper player ID
      - `player_name` (text)
      - `position` (text)
      - `team` (text)
      - `ktc_value` (integer) - Base value from Fantasy Draft Pros
      - `fdp_value` (integer) - Our custom adjusted value
      - `trend` (text) - 'up', 'down', or 'stable'
      - `last_updated` (timestamptz)
      - `metadata` (jsonb) - Additional player info
    
    - `value_adjustment_factors`
      - `id` (uuid, primary key)
      - `player_id` (text)
      - `superflex_boost` (decimal) - QB value boost for superflex
      - `playoff_schedule` (decimal) - Strength of playoff schedule
      - `recent_performance` (decimal) - Last 4 weeks performance factor
      - `injury_risk` (decimal) - Injury risk discount
      - `age_factor` (decimal) - Age-based adjustment for dynasty
      - `team_situation` (decimal) - Coaching/offensive scheme factor
      - `calculated_at` (timestamptz)
    
    - `user_custom_values`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `player_id` (text)
      - `custom_value` (integer) - User's personal override value
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for player_values and value_adjustment_factors
    - Users can only manage their own custom values
*/

-- Create player_values table
CREATE TABLE IF NOT EXISTS player_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text UNIQUE NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  team text,
  ktc_value integer DEFAULT 0,
  fdp_value integer DEFAULT 0,
  trend text DEFAULT 'stable',
  last_updated timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create value_adjustment_factors table
CREATE TABLE IF NOT EXISTS value_adjustment_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text UNIQUE NOT NULL,
  superflex_boost decimal DEFAULT 0,
  playoff_schedule decimal DEFAULT 0,
  recent_performance decimal DEFAULT 0,
  injury_risk decimal DEFAULT 0,
  age_factor decimal DEFAULT 0,
  team_situation decimal DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE CASCADE
);

-- Create user_custom_values table
CREATE TABLE IF NOT EXISTS user_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  custom_value integer NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, player_id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_values_position ON player_values(position);
CREATE INDEX IF NOT EXISTS idx_player_values_team ON player_values(team);
CREATE INDEX IF NOT EXISTS idx_player_values_fdp_value ON player_values(fdp_value DESC);
CREATE INDEX IF NOT EXISTS idx_user_custom_values_user_id ON user_custom_values(user_id);

-- Enable RLS
ALTER TABLE player_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_adjustment_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_values ENABLE ROW LEVEL SECURITY;

-- Policies for player_values (public read)
CREATE POLICY "Anyone can view player values"
  ON player_values FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage player values"
  ON player_values FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for value_adjustment_factors (public read)
CREATE POLICY "Anyone can view adjustment factors"
  ON value_adjustment_factors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage adjustment factors"
  ON value_adjustment_factors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for user_custom_values
CREATE POLICY "Users can view own custom values"
  ON user_custom_values FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom values"
  ON user_custom_values FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom values"
  ON user_custom_values FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom values"
  ON user_custom_values FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
