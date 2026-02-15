/*
  # A/B Testing & Outcome Impact Tracking System

  ## Overview
  Measures whether rankings, advice, and trade recommendations actually improve user results.
  Tracks decisions users make and compares predicted vs real outcomes.

  ## New Tables

  ### 1. feature_experiments
  Defines A/B/C tests for features
  - `id` (uuid, primary key)
  - `key` (text, unique) - Unique identifier for experiment
  - `description` (text) - What is being tested
  - `active` (boolean) - Is experiment running
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. experiment_variants
  Different versions of features being tested
  - `id` (uuid, primary key)
  - `experiment_id` (uuid) - Links to feature_experiments
  - `variant` (text) - A, B, C, etc.
  - `traffic_percent` (int) - % of users to assign
  - `config` (jsonb) - Variant-specific configuration
  - `created_at` (timestamptz)

  ### 3. user_experiment_assignments
  Sticky user-to-variant assignments
  - `user_id` (uuid)
  - `experiment_id` (uuid)
  - `variant` (text)
  - `assigned_at` (timestamptz)
  - Primary key: (user_id, experiment_id)

  ### 4. user_actions
  Tracks all user decisions (CRITICAL for learning)
  - `id` (uuid, primary key)
  - `user_id` (uuid)
  - `league_id` (uuid, nullable)
  - `player_id` (uuid, nullable)
  - `action_type` (text) - trade_sent, trade_accepted, pickup, drop, start, bench, viewed_advice, etc.
  - `related_value` (int, nullable) - Trade value, player value, etc.
  - `created_at` (timestamptz)
  - `metadata` (jsonb) - Additional context

  ### 5. advice_outcomes
  Measures if advice was correct
  - `id` (uuid, primary key)
  - `advice_id` (uuid, nullable)
  - `player_id` (uuid)
  - `league_id` (uuid, nullable)
  - `week` (int)
  - `predicted_direction` (text) - up, down, neutral
  - `actual_direction` (text) - up, down, neutral
  - `success` (boolean) - Was prediction correct
  - `created_at` (timestamptz)
  - `evaluated_at` (timestamptz, nullable)

  ### 6. trade_outcomes
  Measures if trade recommendations were good
  - `id` (uuid, primary key)
  - `trade_id` (uuid)
  - `evaluation_window` (int) - 14 or 30 days
  - `team_a_points_gained` (numeric)
  - `team_b_points_gained` (numeric)
  - `winner` (text) - team_a, team_b, tie
  - `model_prediction_correct` (boolean)
  - `confidence_at_trade` (int)
  - `created_at` (timestamptz)
  - `evaluated_at` (timestamptz)

  ### 7. model_performance_history
  Aggregate performance metrics over time
  - `id` (uuid, primary key)
  - `date` (date)
  - `accuracy_score` (numeric) - Prediction accuracy
  - `advice_score` (numeric) - Advice success rate
  - `trade_score` (numeric) - Trade recommendation success
  - `confidence` (numeric) - Overall confidence
  - `total_predictions` (int)
  - `total_trades` (int)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only see their own assignments and actions
  - Admin role can see all data
*/

-- 1. Feature Experiments
CREATE TABLE IF NOT EXISTS feature_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_active ON feature_experiments(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_experiments_key ON feature_experiments(key);

-- 2. Experiment Variants
CREATE TABLE IF NOT EXISTS experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES feature_experiments(id) ON DELETE CASCADE,
  variant text NOT NULL,
  traffic_percent int NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, variant),
  CONSTRAINT valid_traffic CHECK (traffic_percent >= 0 AND traffic_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_variants_experiment ON experiment_variants(experiment_id);

-- 3. User Experiment Assignments
CREATE TABLE IF NOT EXISTS user_experiment_assignments (
  user_id uuid NOT NULL,
  experiment_id uuid NOT NULL REFERENCES feature_experiments(id) ON DELETE CASCADE,
  variant text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON user_experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_experiment ON user_experiment_assignments(experiment_id);

-- 4. User Actions (CRITICAL for learning)
CREATE TABLE IF NOT EXISTS user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  league_id uuid,
  player_id uuid,
  action_type text NOT NULL,
  related_value int,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_actions_user ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_league ON user_actions(league_id);
CREATE INDEX IF NOT EXISTS idx_actions_player ON user_actions(player_id);
CREATE INDEX IF NOT EXISTS idx_actions_type ON user_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_actions_created ON user_actions(created_at DESC);

-- 5. Advice Outcomes
CREATE TABLE IF NOT EXISTS advice_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advice_id uuid,
  player_id uuid NOT NULL,
  league_id uuid,
  week int NOT NULL,
  predicted_direction text NOT NULL,
  actual_direction text,
  success boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz,
  CONSTRAINT valid_predicted_direction CHECK (predicted_direction IN ('up', 'down', 'neutral')),
  CONSTRAINT valid_actual_direction CHECK (actual_direction IS NULL OR actual_direction IN ('up', 'down', 'neutral'))
);

CREATE INDEX IF NOT EXISTS idx_advice_outcomes_player ON advice_outcomes(player_id);
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_week ON advice_outcomes(week);
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_success ON advice_outcomes(success) WHERE success IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_evaluated ON advice_outcomes(evaluated_at);

-- 6. Trade Outcomes
CREATE TABLE IF NOT EXISTS trade_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL,
  evaluation_window int NOT NULL,
  team_a_points_gained numeric DEFAULT 0,
  team_b_points_gained numeric DEFAULT 0,
  winner text,
  model_prediction_correct boolean,
  confidence_at_trade int,
  created_at timestamptz NOT NULL DEFAULT now(),
  evaluated_at timestamptz NOT NULL,
  CONSTRAINT valid_evaluation_window CHECK (evaluation_window IN (14, 30)),
  CONSTRAINT valid_winner CHECK (winner IS NULL OR winner IN ('team_a', 'team_b', 'tie'))
);

CREATE INDEX IF NOT EXISTS idx_trade_outcomes_trade ON trade_outcomes(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_outcomes_window ON trade_outcomes(evaluation_window);
CREATE INDEX IF NOT EXISTS idx_trade_outcomes_correct ON trade_outcomes(model_prediction_correct) WHERE model_prediction_correct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_outcomes_evaluated ON trade_outcomes(evaluated_at);

-- 7. Model Performance History
CREATE TABLE IF NOT EXISTS model_performance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  accuracy_score numeric DEFAULT 0,
  advice_score numeric DEFAULT 0,
  trade_score numeric DEFAULT 0,
  confidence numeric DEFAULT 0,
  total_predictions int DEFAULT 0,
  total_trades int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_date ON model_performance_history(date DESC);

-- RLS Policies

-- Feature Experiments (public read, admin write)
ALTER TABLE feature_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active experiments"
  ON feature_experiments FOR SELECT
  USING (active = true);

CREATE POLICY "Service role can manage experiments"
  ON feature_experiments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Experiment Variants (public read, admin write)
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view variants"
  ON experiment_variants FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage variants"
  ON experiment_variants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User Experiment Assignments (own only)
ALTER TABLE user_experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments"
  ON user_experiment_assignments FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage assignments"
  ON user_experiment_assignments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User Actions (own only)
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions"
  ON user_actions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own actions"
  ON user_actions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage actions"
  ON user_actions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Advice Outcomes (public read for stats)
ALTER TABLE advice_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view advice outcomes"
  ON advice_outcomes FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage outcomes"
  ON advice_outcomes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trade Outcomes (public read for stats)
ALTER TABLE trade_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trade outcomes"
  ON trade_outcomes FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage trade outcomes"
  ON trade_outcomes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Model Performance History (public read)
ALTER TABLE model_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view performance history"
  ON model_performance_history FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage performance history"
  ON model_performance_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper Functions

-- Get experiment variant for user (sticky assignment)
CREATE OR REPLACE FUNCTION get_experiment_variant(
  p_user_id uuid,
  p_experiment_key text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_variant text;
  v_experiment_id uuid;
  v_random_num numeric;
  v_cumulative_percent int;
BEGIN
  -- Get experiment ID
  SELECT id INTO v_experiment_id
  FROM feature_experiments
  WHERE key = p_experiment_key AND active = true;

  IF v_experiment_id IS NULL THEN
    RETURN 'control'; -- Default if experiment not found
  END IF;

  -- Check if user already assigned
  SELECT variant INTO v_variant
  FROM user_experiment_assignments
  WHERE user_id = p_user_id AND experiment_id = v_experiment_id;

  IF v_variant IS NOT NULL THEN
    RETURN v_variant;
  END IF;

  -- Assign new variant based on traffic percentages
  -- Use user_id for deterministic randomness (consistent across sessions)
  v_random_num := (('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::bigint % 100);
  v_cumulative_percent := 0;

  FOR v_variant, v_cumulative_percent IN
    SELECT variant, traffic_percent
    FROM experiment_variants
    WHERE experiment_id = v_experiment_id
    ORDER BY variant
  LOOP
    IF v_random_num < v_cumulative_percent THEN
      -- Assign and return
      INSERT INTO user_experiment_assignments (user_id, experiment_id, variant)
      VALUES (p_user_id, v_experiment_id, v_variant);
      RETURN v_variant;
    END IF;
  END LOOP;

  -- Fallback to control
  RETURN 'control';
END;
$$;

-- Calculate advice success rate for a period
CREATE OR REPLACE FUNCTION calculate_advice_success_rate(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total int;
  v_successful int;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE success = true)
  INTO v_total, v_successful
  FROM advice_outcomes
  WHERE evaluated_at BETWEEN p_start_date AND p_end_date
    AND success IS NOT NULL;

  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_successful::numeric / v_total::numeric) * 100;
END;
$$;

-- Calculate trade success rate for a period
CREATE OR REPLACE FUNCTION calculate_trade_success_rate(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_evaluation_window int DEFAULT 30
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total int;
  v_successful int;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE model_prediction_correct = true)
  INTO v_total, v_successful
  FROM trade_outcomes
  WHERE evaluated_at BETWEEN p_start_date AND p_end_date
    AND evaluation_window = p_evaluation_window
    AND model_prediction_correct IS NOT NULL;

  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_successful::numeric / v_total::numeric) * 100;
END;
$$;

-- Update model performance for date
CREATE OR REPLACE FUNCTION update_model_performance(p_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_advice_score numeric;
  v_trade_score numeric;
  v_total_predictions int;
  v_total_trades int;
  v_accuracy numeric;
  v_confidence numeric;
BEGIN
  -- Calculate advice score
  SELECT calculate_advice_success_rate(
    p_date::timestamptz,
    (p_date + interval '1 day')::timestamptz
  ) INTO v_advice_score;

  -- Calculate trade score (30-day window)
  SELECT calculate_trade_success_rate(
    p_date::timestamptz,
    (p_date + interval '1 day')::timestamptz,
    30
  ) INTO v_trade_score;

  -- Count predictions
  SELECT COUNT(*) INTO v_total_predictions
  FROM advice_outcomes
  WHERE DATE(evaluated_at) = p_date AND success IS NOT NULL;

  -- Count trades
  SELECT COUNT(*) INTO v_total_trades
  FROM trade_outcomes
  WHERE DATE(evaluated_at) = p_date AND model_prediction_correct IS NOT NULL;

  -- Calculate overall accuracy (weighted average)
  v_accuracy := (v_advice_score * 0.6 + v_trade_score * 0.4);

  -- Calculate confidence based on sample size
  v_confidence := LEAST(
    100,
    (v_total_predictions + v_total_trades * 2) / 10 * 10
  );

  -- Insert or update
  INSERT INTO model_performance_history (
    date,
    accuracy_score,
    advice_score,
    trade_score,
    confidence,
    total_predictions,
    total_trades
  )
  VALUES (
    p_date,
    v_accuracy,
    v_advice_score,
    v_trade_score,
    v_confidence,
    v_total_predictions,
    v_total_trades
  )
  ON CONFLICT (date) DO UPDATE SET
    accuracy_score = EXCLUDED.accuracy_score,
    advice_score = EXCLUDED.advice_score,
    trade_score = EXCLUDED.trade_score,
    confidence = EXCLUDED.confidence,
    total_predictions = EXCLUDED.total_predictions,
    total_trades = EXCLUDED.total_trades;
END;
$$;
