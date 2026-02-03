/*
  # User Leagues and Trade History Schema

  1. New Tables
    - `user_leagues`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `league_id` (text, Sleeper league ID)
      - `league_name` (text)
      - `is_superflex` (boolean)
      - `team_name` (text, user's team name in league)
      - `is_active` (boolean, for soft delete)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `saved_trades`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `league_id` (text)
      - `trade_data` (jsonb, stores full trade details)
      - `trade_result` (jsonb, stores evaluation results)
      - `notes` (text)
      - `created_at` (timestamptz)
    
    - `user_preferences`
      - `user_id` (uuid, primary key, references auth.users)
      - `default_league_id` (text)
      - `theme` (text)
      - `email_notifications` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Policies for authenticated users only

  3. Indexes
    - user_leagues: (user_id, league_id)
    - saved_trades: (user_id, league_id)
*/

-- Create user_leagues table
CREATE TABLE IF NOT EXISTS user_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id text NOT NULL,
  league_name text NOT NULL,
  is_superflex boolean DEFAULT false,
  team_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, league_id)
);

-- Create saved_trades table
CREATE TABLE IF NOT EXISTS saved_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id text NOT NULL,
  trade_data jsonb NOT NULL,
  trade_result jsonb,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_league_id text,
  theme text DEFAULT 'light',
  email_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_leagues
CREATE POLICY "Users can view own leagues"
  ON user_leagues FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leagues"
  ON user_leagues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leagues"
  ON user_leagues FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leagues"
  ON user_leagues FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for saved_trades
CREATE POLICY "Users can view own trades"
  ON saved_trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON saved_trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON saved_trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON saved_trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_leagues_user_id ON user_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leagues_league_id ON user_leagues(league_id);
CREATE INDEX IF NOT EXISTS idx_saved_trades_user_id ON saved_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_trades_league_id ON saved_trades(league_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_leagues_updated_at ON user_leagues;
CREATE TRIGGER update_user_leagues_updated_at
  BEFORE UPDATE ON user_leagues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();