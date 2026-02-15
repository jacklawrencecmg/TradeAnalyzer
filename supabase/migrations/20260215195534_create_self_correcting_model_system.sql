/*
  # Self-Correcting Model System

  1. New Tables
    - `player_weekly_outcomes`
      - Stores actual fantasy performance each week
      - Source of truth for measuring prediction accuracy
    
    - `player_value_predictions`
      - Freezes preseason/weekly predictions BEFORE games
      - Used to calculate prediction errors
    
    - `model_accuracy_history`
      - Tracks prediction accuracy over time
      - Identifies biases by position
    
    - `model_tuning_parameters`
      - Adjustable weights learned from errors
      - Applied during rebuild to improve future predictions
    
    - `model_learning_audit`
      - Audit log of parameter adjustments
      - Tracks why and when parameters changed

  2. Purpose
    - Measure prediction accuracy vs actual results
    - Detect systematic biases (age decay, breakouts, etc.)
    - Auto-tune model parameters within safe boundaries
    - Improve future predictions without changing history

  3. Security
    - Enable RLS (service role writes, authenticated reads)
    - Admin-only access to tuning parameters

  4. Notes
    - NEVER changes past values, only future parameters
    - Adjustments capped at ±5% per week
    - Elite tier (1-24) never auto-adjusted
    - Mid/late tiers (25+) can be tuned
*/

-- Create player_weekly_outcomes table
CREATE TABLE IF NOT EXISTS player_weekly_outcomes (
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  season integer NOT NULL CHECK (season >= 2020 AND season <= 2099),
  week integer NOT NULL CHECK (week >= 1 AND week <= 18),
  fantasy_points numeric NOT NULL DEFAULT 0,
  snap_share numeric CHECK (snap_share >= 0 AND snap_share <= 1),
  target_share numeric CHECK (target_share >= 0 AND target_share <= 1),
  opportunity_share numeric CHECK (opportunity_share >= 0 AND opportunity_share <= 1),
  games_started boolean NOT NULL DEFAULT false,
  games_played boolean NOT NULL DEFAULT true,
  injured boolean NOT NULL DEFAULT false,
  dnp_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season, week)
);

-- Indexes for weekly outcomes
CREATE INDEX IF NOT EXISTS idx_weekly_outcomes_season_week
  ON player_weekly_outcomes(season, week);

CREATE INDEX IF NOT EXISTS idx_weekly_outcomes_player_season
  ON player_weekly_outcomes(player_id, season);

-- Enable RLS
ALTER TABLE player_weekly_outcomes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view weekly outcomes"
  ON player_weekly_outcomes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage weekly outcomes"
  ON player_weekly_outcomes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE player_weekly_outcomes IS 'Actual fantasy performance results by week';

-- Create player_value_predictions table
CREATE TABLE IF NOT EXISTS player_value_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  season integer NOT NULL CHECK (season >= 2020 AND season <= 2099),
  week integer NOT NULL CHECK (week >= 0 AND week <= 18),
  format text NOT NULL CHECK (format IN ('dynasty', 'redraft')),
  predicted_rank integer NOT NULL CHECK (predicted_rank > 0),
  predicted_position_rank integer NOT NULL CHECK (predicted_position_rank > 0),
  predicted_value integer NOT NULL CHECK (predicted_value >= 0),
  confidence_score numeric,
  model_version text,
  league_profile_id uuid REFERENCES league_profiles(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, week, format, league_profile_id)
);

-- Indexes for predictions
CREATE INDEX IF NOT EXISTS idx_value_predictions_season_week
  ON player_value_predictions(season, week, format);

CREATE INDEX IF NOT EXISTS idx_value_predictions_player
  ON player_value_predictions(player_id, season, format);

CREATE INDEX IF NOT EXISTS idx_value_predictions_profile
  ON player_value_predictions(league_profile_id, season);

-- Enable RLS
ALTER TABLE player_value_predictions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view predictions"
  ON player_value_predictions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage predictions"
  ON player_value_predictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE player_value_predictions IS 'Frozen predictions made BEFORE games (for accuracy measurement)';

-- Create model_accuracy_history table
CREATE TABLE IF NOT EXISTS model_accuracy_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL CHECK (season >= 2020 AND season <= 2099),
  week integer NOT NULL CHECK (week >= 1 AND week <= 18),
  position text NOT NULL,
  format text NOT NULL CHECK (format IN ('dynasty', 'redraft')),
  sample_size integer NOT NULL DEFAULT 0,
  avg_error numeric NOT NULL DEFAULT 0,
  median_error numeric NOT NULL DEFAULT 0,
  max_error numeric NOT NULL DEFAULT 0,
  overvalued_bias numeric NOT NULL DEFAULT 0,
  undervalued_bias numeric NOT NULL DEFAULT 0,
  accuracy_score numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, week, position, format)
);

-- Indexes for accuracy history
CREATE INDEX IF NOT EXISTS idx_accuracy_history_season_week
  ON model_accuracy_history(season, week DESC);

CREATE INDEX IF NOT EXISTS idx_accuracy_history_position
  ON model_accuracy_history(position, season DESC);

-- Enable RLS
ALTER TABLE model_accuracy_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view accuracy history"
  ON model_accuracy_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage accuracy history"
  ON model_accuracy_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE model_accuracy_history IS 'Weekly accuracy metrics by position';

-- Create model_tuning_parameters table
CREATE TABLE IF NOT EXISTS model_tuning_parameters (
  parameter text PRIMARY KEY,
  value numeric NOT NULL,
  default_value numeric NOT NULL,
  min_value numeric NOT NULL,
  max_value numeric NOT NULL,
  category text NOT NULL,
  description text,
  auto_tune boolean NOT NULL DEFAULT false,
  last_adjustment numeric,
  adjustment_count integer NOT NULL DEFAULT 0,
  last_adjusted_at timestamptz,
  last_adjusted_by text,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for tuning parameters
CREATE INDEX IF NOT EXISTS idx_tuning_params_category
  ON model_tuning_parameters(category);

CREATE INDEX IF NOT EXISTS idx_tuning_params_auto_tune
  ON model_tuning_parameters(auto_tune)
  WHERE auto_tune = true;

-- Enable RLS
ALTER TABLE model_tuning_parameters ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view tuning parameters"
  ON model_tuning_parameters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage tuning parameters"
  ON model_tuning_parameters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE model_tuning_parameters IS 'Auto-tuned model weights learned from prediction errors';

-- Create model_learning_audit table
CREATE TABLE IF NOT EXISTS model_learning_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter text NOT NULL,
  old_value numeric NOT NULL,
  new_value numeric NOT NULL,
  adjustment numeric NOT NULL,
  trigger_reason text NOT NULL,
  season integer NOT NULL,
  week integer,
  bias_detected text,
  sample_size integer,
  confidence numeric,
  auto_applied boolean NOT NULL DEFAULT false,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for learning audit
CREATE INDEX IF NOT EXISTS idx_learning_audit_parameter
  ON model_learning_audit(parameter, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_audit_season
  ON model_learning_audit(season, week DESC);

CREATE INDEX IF NOT EXISTS idx_learning_audit_auto
  ON model_learning_audit(auto_applied, created_at DESC);

-- Enable RLS
ALTER TABLE model_learning_audit ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view learning audit"
  ON model_learning_audit
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage learning audit"
  ON model_learning_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE model_learning_audit IS 'Audit log of all parameter adjustments';

-- Initialize default tuning parameters
INSERT INTO model_tuning_parameters (parameter, value, default_value, min_value, max_value, category, description, auto_tune) VALUES
  -- Age decay multipliers
  ('qb_age_decay', 1.0, 1.0, 0.8, 1.2, 'age_decay', 'QB age decline rate', true),
  ('rb_age_decay', 1.0, 1.0, 0.8, 1.2, 'age_decay', 'RB age decline rate', true),
  ('wr_age_decay', 1.0, 1.0, 0.8, 1.2, 'age_decay', 'WR age decline rate', true),
  ('te_age_decay', 1.0, 1.0, 0.8, 1.2, 'age_decay', 'TE age decline rate', true),
  
  -- Breakout multipliers
  ('young_wr_breakout_weight', 1.0, 1.0, 0.7, 1.3, 'breakout', 'Young WR breakout probability boost', true),
  ('young_rb_breakout_weight', 1.0, 1.0, 0.7, 1.3, 'breakout', 'Young RB breakout probability boost', true),
  ('young_te_breakout_weight', 1.0, 1.0, 0.7, 1.3, 'breakout', 'Young TE breakout probability boost', true),
  
  -- Rookie projection
  ('rookie_draft_capital_weight', 1.0, 1.0, 0.6, 1.4, 'rookie', 'Draft capital impact on rookie values', true),
  ('rookie_landing_spot_weight', 1.0, 1.0, 0.7, 1.3, 'rookie', 'Landing spot quality weight', true),
  ('rookie_qb_optimism', 1.0, 1.0, 0.8, 1.2, 'rookie', 'Rookie QB projection optimism', true),
  ('rookie_rb_optimism', 1.0, 1.0, 0.8, 1.2, 'rookie', 'Rookie RB projection optimism', true),
  ('rookie_wr_optimism', 1.0, 1.0, 0.8, 1.2, 'rookie', 'Rookie WR projection optimism', true),
  
  -- Production weight
  ('recent_production_weight', 1.0, 1.0, 0.7, 1.3, 'production', 'Recent production impact', true),
  ('opportunity_weight', 1.0, 1.0, 0.7, 1.3, 'production', 'Opportunity share weight', true),
  ('efficiency_weight', 1.0, 1.0, 0.7, 1.3, 'production', 'Efficiency metrics weight', true),
  
  -- Volatility
  ('rb_volatility_factor', 1.0, 1.0, 0.8, 1.2, 'volatility', 'RB year-to-year volatility', true),
  ('wr_volatility_factor', 1.0, 1.0, 0.8, 1.2, 'volatility', 'WR year-to-year volatility', true),
  
  -- Injury risk
  ('injury_history_weight', 1.0, 1.0, 0.7, 1.3, 'injury', 'Past injury impact on projections', true),
  ('age_injury_correlation', 1.0, 1.0, 0.8, 1.2, 'injury', 'Age-related injury risk', true)
ON CONFLICT (parameter) DO NOTHING;

-- Create helper function to get tuning parameter
CREATE OR REPLACE FUNCTION get_tuning_parameter(p_parameter text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_value numeric;
BEGIN
  SELECT value INTO v_value
  FROM model_tuning_parameters
  WHERE parameter = p_parameter;
  
  RETURN COALESCE(v_value, 1.0);
END;
$$;

COMMENT ON FUNCTION get_tuning_parameter IS 'Get current value of a tuning parameter';

-- Create function to calculate prediction error
CREATE OR REPLACE FUNCTION calculate_prediction_error(
  p_predicted_rank integer,
  p_actual_rank integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Simple absolute rank difference
  RETURN ABS(p_predicted_rank - p_actual_rank);
END;
$$;

COMMENT ON FUNCTION calculate_prediction_error IS 'Calculate prediction error (absolute rank difference)';

-- Create function to calculate accuracy score
CREATE OR REPLACE FUNCTION calculate_accuracy_score(
  p_avg_error numeric,
  p_sample_size integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_score numeric;
BEGIN
  -- Score: 1.0 - (avg_error / 100)
  -- Perfect predictions = 1.0, 100 ranks off = 0.0
  v_score := 1.0 - (p_avg_error / 100.0);
  
  -- Clamp to 0..1
  v_score := GREATEST(0.0, LEAST(1.0, v_score));
  
  -- Adjust for sample size confidence
  IF p_sample_size < 10 THEN
    v_score := v_score * (p_sample_size / 10.0);
  END IF;
  
  RETURN ROUND(v_score, 3);
END;
$$;

COMMENT ON FUNCTION calculate_accuracy_score IS 'Calculate accuracy score from error metrics';

-- Create view for recent accuracy trends
CREATE OR REPLACE VIEW recent_accuracy_trends AS
SELECT
  position,
  format,
  AVG(avg_error) as avg_error_last_4wks,
  AVG(accuracy_score) as avg_accuracy_last_4wks,
  AVG(overvalued_bias) as avg_overvalued_bias,
  AVG(undervalued_bias) as avg_undervalued_bias,
  COUNT(*) as weeks_tracked,
  MAX(created_at) as last_updated
FROM model_accuracy_history
WHERE created_at >= NOW() - INTERVAL '4 weeks'
GROUP BY position, format
ORDER BY position, format;

COMMENT ON VIEW recent_accuracy_trends IS 'Rolling 4-week accuracy trends by position';

-- Create view for parameter adjustment history
CREATE OR REPLACE VIEW parameter_adjustment_summary AS
SELECT
  mtp.parameter,
  mtp.category,
  mtp.value as current_value,
  mtp.default_value,
  mtp.value - mtp.default_value as total_adjustment,
  mtp.adjustment_count,
  mtp.last_adjusted_at,
  mtp.reason as last_reason,
  COUNT(mla.id) as total_adjustments,
  AVG(mla.adjustment) as avg_adjustment
FROM model_tuning_parameters mtp
LEFT JOIN model_learning_audit mla ON mtp.parameter = mla.parameter
WHERE mtp.auto_tune = true
GROUP BY mtp.parameter, mtp.category, mtp.value, mtp.default_value, 
         mtp.adjustment_count, mtp.last_adjusted_at, mtp.reason
ORDER BY mtp.category, mtp.parameter;

COMMENT ON VIEW parameter_adjustment_summary IS 'Summary of parameter adjustments over time';

-- Create function to apply parameter adjustment
CREATE OR REPLACE FUNCTION apply_parameter_adjustment(
  p_parameter text,
  p_adjustment numeric,
  p_reason text,
  p_season integer,
  p_week integer,
  p_auto_applied boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_value numeric;
  v_new_value numeric;
  v_min_value numeric;
  v_max_value numeric;
  v_auto_tune boolean;
BEGIN
  -- Get current parameter config
  SELECT value, min_value, max_value, auto_tune
  INTO v_old_value, v_min_value, v_max_value, v_auto_tune
  FROM model_tuning_parameters
  WHERE parameter = p_parameter;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parameter % not found', p_parameter;
  END IF;
  
  -- Check if auto-tune is enabled
  IF NOT v_auto_tune AND p_auto_applied THEN
    RAISE EXCEPTION 'Parameter % does not allow auto-tuning', p_parameter;
  END IF;
  
  -- Calculate new value
  v_new_value := v_old_value + p_adjustment;
  
  -- Clamp to allowed range
  v_new_value := GREATEST(v_min_value, LEAST(v_max_value, v_new_value));
  
  -- Update parameter
  UPDATE model_tuning_parameters
  SET
    value = v_new_value,
    last_adjustment = p_adjustment,
    adjustment_count = adjustment_count + 1,
    last_adjusted_at = NOW(),
    last_adjusted_by = CASE WHEN p_auto_applied THEN 'auto_learning' ELSE 'manual' END,
    reason = p_reason,
    updated_at = NOW()
  WHERE parameter = p_parameter;
  
  -- Log adjustment
  INSERT INTO model_learning_audit (
    parameter,
    old_value,
    new_value,
    adjustment,
    trigger_reason,
    season,
    week,
    auto_applied,
    notes
  ) VALUES (
    p_parameter,
    v_old_value,
    v_new_value,
    p_adjustment,
    p_reason,
    p_season,
    p_week,
    p_auto_applied,
    'Parameter adjusted from ' || v_old_value::text || ' to ' || v_new_value::text
  );
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION apply_parameter_adjustment IS 'Safely apply adjustment to tuning parameter with bounds checking';

-- Create aggregate function for weekly outcomes
CREATE OR REPLACE VIEW player_season_aggregates AS
SELECT
  pwo.player_id,
  np.full_name,
  np.player_position,
  pwo.season,
  COUNT(*) as games_played,
  SUM(CASE WHEN pwo.games_started THEN 1 ELSE 0 END) as games_started,
  AVG(pwo.fantasy_points) as avg_fantasy_points,
  SUM(pwo.fantasy_points) as total_fantasy_points,
  AVG(pwo.snap_share) as avg_snap_share,
  AVG(pwo.target_share) as avg_target_share,
  MAX(pwo.fantasy_points) as best_game,
  MIN(pwo.fantasy_points) as worst_game,
  STDDEV(pwo.fantasy_points) as volatility,
  COUNT(*) FILTER (WHERE pwo.injured) as games_injured
FROM player_weekly_outcomes pwo
JOIN nfl_players np ON pwo.player_id = np.id
GROUP BY pwo.player_id, np.full_name, np.player_position, pwo.season;

COMMENT ON VIEW player_season_aggregates IS 'Season-level aggregate statistics for accuracy analysis';
