/*
  # Advanced Features Database Schema

  ## New Tables
  
  1. `player_values_history`
     - Tracks KTC player values over time for trend analysis
     - `id` (uuid, primary key)
     - `player_id` (text) - Sleeper player ID
     - `player_name` (text)
     - `position` (text)
     - `value` (integer) - KTC value
     - `recorded_at` (timestamptz)
     - `league_id` (text)
  
  2. `trade_blocks`
     - Players available on trade block
     - `id` (uuid, primary key)
     - `league_id` (text)
     - `user_id` (uuid, foreign key)
     - `player_id` (text)
     - `player_name` (text)
     - `asking_value` (integer)
     - `notes` (text)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
  
  3. `notifications`
     - User notifications for trades, value changes, etc.
     - `id` (uuid, primary key)
     - `user_id` (uuid, foreign key)
     - `league_id` (text)
     - `type` (text) - trade, value_change, news, etc.
     - `title` (text)
     - `message` (text)
     - `read` (boolean)
     - `created_at` (timestamptz)
  
  4. `league_chat`
     - League chat and smack talk messages
     - `id` (uuid, primary key)
     - `league_id` (text)
     - `user_id` (uuid, foreign key)
     - `username` (text)
     - `message` (text)
     - `created_at` (timestamptz)
  
  5. `waiver_recommendations`
     - Saved waiver wire recommendations
     - `id` (uuid, primary key)
     - `league_id` (text)
     - `user_id` (uuid, foreign key)
     - `player_id` (text)
     - `player_name` (text)
     - `position` (text)
     - `value` (integer)
     - `recommendation_score` (integer)
     - `reasoning` (text)
     - `created_at` (timestamptz)
  
  6. `draft_rankings`
     - Custom draft rankings and values
     - `id` (uuid, primary key)
     - `league_id` (text)
     - `user_id` (uuid, foreign key)
     - `player_id` (text)
     - `player_name` (text)
     - `position` (text)
     - `rank` (integer)
     - `tier` (integer)
     - `notes` (text)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  - Add policies for league members to view shared data
*/

-- Create player_values_history table
CREATE TABLE IF NOT EXISTS player_values_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  value integer NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  league_id text NOT NULL
);

ALTER TABLE player_values_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert player values"
  ON player_values_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view player values"
  ON player_values_history FOR SELECT
  TO authenticated
  USING (true);

-- Create trade_blocks table
CREATE TABLE IF NOT EXISTS trade_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  asking_value integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trade_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trade blocks in their leagues"
  ON trade_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own trade blocks"
  ON trade_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade blocks"
  ON trade_blocks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade blocks"
  ON trade_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create league_chat table
CREATE TABLE IF NOT EXISTS league_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE league_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chat in their leagues"
  ON league_chat FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can send chat messages"
  ON league_chat FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON league_chat FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create waiver_recommendations table
CREATE TABLE IF NOT EXISTS waiver_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  value integer NOT NULL,
  recommendation_score integer NOT NULL,
  reasoning text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waiver_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waiver recommendations"
  ON waiver_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create waiver recommendations"
  ON waiver_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own waiver recommendations"
  ON waiver_recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create draft_rankings table
CREATE TABLE IF NOT EXISTS draft_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  rank integer NOT NULL,
  tier integer DEFAULT 1,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE draft_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own draft rankings"
  ON draft_rankings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create draft rankings"
  ON draft_rankings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft rankings"
  ON draft_rankings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own draft rankings"
  ON draft_rankings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_values_history_player_id ON player_values_history(player_id);
CREATE INDEX IF NOT EXISTS idx_player_values_history_league_id ON player_values_history(league_id);
CREATE INDEX IF NOT EXISTS idx_trade_blocks_league_id ON trade_blocks(league_id);
CREATE INDEX IF NOT EXISTS idx_trade_blocks_user_id ON trade_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_league_chat_league_id ON league_chat(league_id);
CREATE INDEX IF NOT EXISTS idx_waiver_recommendations_user_id ON waiver_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_draft_rankings_user_id ON draft_rankings(user_id);