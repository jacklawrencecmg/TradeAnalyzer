/*
  # Add Playoff Simulations Table

  1. New Tables
    - `playoff_simulations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `league_id` (text) - Sleeper league ID
      - `simulation_count` (integer) - Number of simulations run
      - `results` (jsonb) - Full simulation results array
      - `league_info` (jsonb) - League metadata (name, season, settings)
      - `notes` (text) - Optional user notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `playoff_simulations` table
    - Add policy for users to read their own simulations
    - Add policy for users to insert their own simulations
    - Add policy for users to update their own simulations
    - Add policy for users to delete their own simulations
*/

CREATE TABLE IF NOT EXISTS playoff_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  league_id text NOT NULL,
  simulation_count integer NOT NULL DEFAULT 1000,
  results jsonb NOT NULL,
  league_info jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE playoff_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own playoff simulations"
  ON playoff_simulations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playoff simulations"
  ON playoff_simulations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playoff simulations"
  ON playoff_simulations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own playoff simulations"
  ON playoff_simulations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_playoff_simulations_user_id ON playoff_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_playoff_simulations_league_id ON playoff_simulations(league_id);
CREATE INDEX IF NOT EXISTS idx_playoff_simulations_created_at ON playoff_simulations(created_at DESC);
