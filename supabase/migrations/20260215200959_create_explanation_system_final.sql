/*
  # Explainable AI System

  Creates tables for generating human-readable explanations.
*/

-- Drop existing tables
DROP TABLE IF EXISTS trade_explanations CASCADE;
DROP TABLE IF EXISTS weekly_market_reports CASCADE;
DROP TABLE IF EXISTS daily_value_changes CASCADE;
DROP TABLE IF EXISTS player_value_explanations CASCADE;

-- Player value explanations
CREATE TABLE player_value_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  league_profile_id uuid REFERENCES league_profiles(id) ON DELETE CASCADE,
  format text NOT NULL,
  old_value integer NOT NULL,
  new_value integer NOT NULL,
  delta integer NOT NULL,
  primary_reason text NOT NULL,
  primary_reason_delta integer NOT NULL,
  secondary_reasons jsonb DEFAULT '[]',
  explanation_text text NOT NULL,
  confidence_change numeric,
  rank_change integer,
  epoch text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_exp_player ON player_value_explanations(player_id, generated_at DESC);
CREATE INDEX idx_exp_format ON player_value_explanations(format, epoch);

ALTER TABLE player_value_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View explanations" ON player_value_explanations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage explanations" ON player_value_explanations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Daily value changes
CREATE TABLE daily_value_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_date date NOT NULL,
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  format text NOT NULL,
  old_value integer NOT NULL,
  new_value integer NOT NULL,
  delta integer NOT NULL,
  percent_change numeric NOT NULL,
  old_rank integer,
  new_rank integer,
  rank_change integer,
  explanation_text text NOT NULL,
  primary_reason text NOT NULL,
  change_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_date ON daily_value_changes(change_date DESC);
CREATE INDEX idx_daily_player ON daily_value_changes(player_id, change_date DESC);

ALTER TABLE daily_value_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View daily changes" ON daily_value_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage daily changes" ON daily_value_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Weekly market reports
CREATE TABLE weekly_market_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  format text NOT NULL,
  season integer NOT NULL,
  week_number integer,
  biggest_gainers jsonb DEFAULT '[]',
  biggest_losers jsonb DEFAULT '[]',
  most_volatile jsonb DEFAULT '[]',
  position_trends jsonb DEFAULT '{}',
  key_insights jsonb DEFAULT '[]',
  market_sentiment text,
  total_value_changes integer DEFAULT 0,
  avg_volatility numeric DEFAULT 0,
  most_active_position text,
  report_title text NOT NULL,
  report_summary text NOT NULL,
  report_content text,
  published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reports_date ON weekly_market_reports(week_start DESC);

ALTER TABLE weekly_market_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View published reports" ON weekly_market_reports FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "Manage reports" ON weekly_market_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trade explanations
CREATE TABLE trade_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid,
  session_id text,
  team_a_value integer NOT NULL,
  team_b_value integer NOT NULL,
  value_difference integer NOT NULL,
  fairness_score numeric NOT NULL,
  overall_assessment text NOT NULL,
  team_a_analysis jsonb DEFAULT '[]',
  team_b_analysis jsonb DEFAULT '[]',
  fairness_factors jsonb DEFAULT '[]',
  warnings jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  format text NOT NULL,
  league_profile_id uuid REFERENCES league_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_trade_exp_session ON trade_explanations(session_id, created_at DESC);

ALTER TABLE trade_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View trade explanations" ON trade_explanations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage trade explanations" ON trade_explanations FOR ALL TO service_role USING (true) WITH CHECK (true);
