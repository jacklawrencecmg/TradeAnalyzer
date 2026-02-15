/*
  # Beta Feedback & Weekly Team Reports System

  1. New Tables
    - `user_feedback`
      - Collects bug reports, value complaints, feature requests
      - Auto-captures context (player, trade, league, page)
      - Supports quick reactions (thumbs up/down)
    
    - `weekly_team_reports`
      - Personalized weekly summaries for each user's team
      - Tracks value changes, missed opportunities, recommendations
      - Builds habit through consistent engagement

  2. Security
    - Enable RLS on both tables
    - Users can create/read their own feedback
    - Users can read their own weekly reports
    - Service role bypasses RLS for admin operations

  3. Indexes
    - Feedback: by user, type, status, created_at
    - Reports: by user, league, week, season
*/

-- User Feedback Table
CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  page text NOT NULL,
  type text NOT NULL CHECK (type IN ('bug', 'wrong_value', 'confusing', 'feature', 'other', 'reaction')),
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fixed', 'wont_fix', 'duplicate')),
  admin_notes text
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_page ON user_feedback(page);

-- Weekly Team Reports Table
CREATE TABLE IF NOT EXISTS weekly_team_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  week int NOT NULL,
  season int NOT NULL DEFAULT 2025,
  summary text NOT NULL,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  missed_moves jsonb DEFAULT '[]'::jsonb,
  recommended_moves jsonb DEFAULT '[]'::jsonb,
  value_change numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, league_id, week, season)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_league ON weekly_team_reports(user_id, league_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_season ON weekly_team_reports(week, season);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_created_at ON weekly_team_reports(created_at DESC);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_team_reports ENABLE ROW LEVEL SECURITY;

-- User Feedback Policies
CREATE POLICY "Users can create their own feedback"
  ON user_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read their own feedback"
  ON user_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow anonymous feedback submission"
  ON user_feedback FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Weekly Team Reports Policies
CREATE POLICY "Users can read their own weekly reports"
  ON weekly_team_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create weekly reports"
  ON weekly_team_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);
