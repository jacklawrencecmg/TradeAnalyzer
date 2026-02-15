/*
  # Live Model Tuning System

  1. New Tables
    - `model_config`
      - `key` (text, primary key) - Config parameter name
      - `value` (numeric) - Current value
      - `category` (text) - Grouping (core_value, market_behavior, advice_engine, league_effects)
      - `description` (text) - Human-readable description
      - `min_value` (numeric) - Minimum allowed value
      - `max_value` (numeric) - Maximum allowed value
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who made the change

    - `model_config_history`
      - `id` (uuid, primary key) - Unique identifier
      - `key` (text) - Config parameter that changed
      - `old_value` (numeric) - Previous value
      - `new_value` (numeric) - New value
      - `changed_by` (uuid) - User who made the change
      - `created_at` (timestamptz) - When change was made
      - `metadata` (jsonb) - Additional context

  2. Security
    - Enable RLS on both tables
    - Service role can read/write (for edge functions)
    - Authenticated users can read config
    - Admin secret required for updates (enforced at edge function level)

  3. Features
    - Seeded with default production values
    - Triggers for automatic rebuild on change
    - Version history for rollback
*/

-- Create model_config table
CREATE TABLE IF NOT EXISTS model_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  category text NOT NULL CHECK (category IN ('core_value', 'market_behavior', 'advice_engine', 'league_effects', 'position_scaling', 'thresholds')),
  description text NOT NULL,
  min_value numeric NOT NULL,
  max_value numeric NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'system'
);

-- Create config history table
CREATE TABLE IF NOT EXISTS model_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  old_value numeric NOT NULL,
  new_value numeric NOT NULL,
  changed_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE model_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_config_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for model_config (allow all for authenticated, enforce security at edge function level)
CREATE POLICY "Authenticated users can read model config"
  ON model_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage model config"
  ON model_config FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for model_config_history
CREATE POLICY "Authenticated users can read config history"
  ON model_config_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert config history"
  ON model_config_history FOR INSERT
  WITH CHECK (true);

-- Trigger to log config changes to history
CREATE OR REPLACE FUNCTION log_model_config_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO model_config_history (key, old_value, new_value, changed_by, metadata)
  VALUES (
    OLD.key,
    OLD.value,
    NEW.value,
    NEW.updated_by,
    jsonb_build_object(
      'category', NEW.category,
      'description', NEW.description
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_config_change_trigger ON model_config;
CREATE TRIGGER model_config_change_trigger
  AFTER UPDATE ON model_config
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION log_model_config_change();

-- Seed initial configuration values
INSERT INTO model_config (key, value, category, description, min_value, max_value) VALUES
  -- Core Value Weights
  ('production_weight', 0.60, 'core_value', 'Weight given to production statistics', 0.30, 0.80),
  ('age_curve_weight', 0.10, 'core_value', 'Weight given to age-based adjustments', 0.00, 0.30),
  ('snap_share_weight', 0.20, 'core_value', 'Weight given to opportunity metrics', 0.10, 0.40),
  ('depth_chart_weight', 0.10, 'core_value', 'Weight given to depth chart position', 0.00, 0.20),
  
  -- Market Behavior
  ('market_anchor_tier1', 0.15, 'market_behavior', 'Market anchor strength for elite players (top 5%)', 0.05, 0.40),
  ('market_anchor_tier2', 0.20, 'market_behavior', 'Market anchor strength for high-end players (top 25%)', 0.10, 0.50),
  ('market_anchor_tier3', 0.25, 'market_behavior', 'Market anchor strength for mid-tier players', 0.15, 0.60),
  ('market_anchor_tier4', 0.35, 'market_behavior', 'Market anchor strength for depth players', 0.20, 0.70),
  
  -- Advice Engine Thresholds
  ('breakout_usage_threshold', 0.25, 'advice_engine', 'Minimum usage % to flag as breakout candidate', 0.15, 0.40),
  ('buy_low_delta', 600, 'advice_engine', 'Value drop threshold to trigger buy-low alert', 300, 1500),
  ('sell_high_delta', -600, 'advice_engine', 'Value spike threshold to trigger sell-high alert', -1500, -300),
  
  -- Position Scaling
  ('elite_tier_percent', 0.05, 'thresholds', 'Percentile threshold for elite tier classification', 0.03, 0.10),
  ('scarcity_multiplier', 1.35, 'position_scaling', 'Multiplier for scarce position (TE) premium', 1.10, 1.60),
  ('qb_superflex_boost', 1.25, 'league_effects', 'QB value boost in superflex leagues', 1.10, 1.50),
  ('te_premium_factor', 0.30, 'league_effects', 'TE premium in TEP leagues', 0.15, 0.50),
  
  -- RB Adjustments
  ('rb_workhorse_bonus', 250, 'position_scaling', 'Bonus for RBs with workhorse role', 100, 500),
  ('rb_committee_penalty', -150, 'position_scaling', 'Penalty for RBs in committee', -300, -50),
  
  -- Rookie Adjustments
  ('rookie_draft_capital_weight', 0.35, 'core_value', 'Weight given to draft capital for rookies', 0.20, 0.60),
  ('rookie_uncertainty_discount', 0.85, 'core_value', 'Discount factor for rookie uncertainty', 0.70, 0.95),
  
  -- Value Band Thresholds
  ('value_tier_elite', 8000, 'thresholds', 'Minimum value for elite tier', 6000, 10000),
  ('value_tier_high', 5000, 'thresholds', 'Minimum value for high tier', 3000, 7000),
  ('value_tier_mid', 2500, 'thresholds', 'Minimum value for mid tier', 1500, 4000),
  ('value_tier_low', 1000, 'thresholds', 'Minimum value for low tier', 500, 2000)
ON CONFLICT (key) DO NOTHING;

-- Function to trigger rebuild when config changes
CREATE OR REPLACE FUNCTION trigger_model_rebuild()
RETURNS TRIGGER AS $$
BEGIN
  -- Log that rebuild is needed
  INSERT INTO system_health_metrics (
    metric_name,
    metric_value,
    severity,
    metadata
  ) VALUES (
    'model_config_changed',
    1,
    'info',
    jsonb_build_object(
      'key', NEW.key,
      'old_value', OLD.value,
      'new_value', NEW.value,
      'changed_by', NEW.updated_by,
      'timestamp', now()
    )
  );
  
  -- Note: Actual rebuild is triggered by edge function monitoring this table
  -- or by scheduled job that checks for recent config changes
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_config_rebuild_trigger ON model_config;
CREATE TRIGGER model_config_rebuild_trigger
  AFTER UPDATE ON model_config
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION trigger_model_rebuild();

-- Create indexes for faster config lookups
CREATE INDEX IF NOT EXISTS idx_model_config_category ON model_config(category);
CREATE INDEX IF NOT EXISTS idx_model_config_updated_at ON model_config(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_config_history_key ON model_config_history(key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_config_history_created_at ON model_config_history(created_at DESC);

-- Function to validate config weights don't exceed limits
CREATE OR REPLACE FUNCTION validate_model_config_weights()
RETURNS TRIGGER AS $$
DECLARE
  weight_sum numeric;
BEGIN
  -- Validate value is within bounds
  IF NEW.value < NEW.min_value OR NEW.value > NEW.max_value THEN
    RAISE EXCEPTION 'Value % is outside allowed range [%, %]', NEW.value, NEW.min_value, NEW.max_value;
  END IF;
  
  -- For weight categories, ensure sum doesn't exceed 1.5
  IF NEW.category = 'core_value' AND NEW.key LIKE '%_weight' THEN
    SELECT COALESCE(SUM(value), 0) INTO weight_sum
    FROM model_config
    WHERE category = 'core_value'
      AND key LIKE '%_weight'
      AND key != NEW.key;
    
    IF (weight_sum + NEW.value) > 1.5 THEN
      RAISE EXCEPTION 'Sum of core value weights cannot exceed 1.5 (current sum: %, attempted: %)',
        weight_sum, weight_sum + NEW.value;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_config_before_update ON model_config;
CREATE TRIGGER validate_config_before_update
  BEFORE INSERT OR UPDATE ON model_config
  FOR EACH ROW
  EXECUTE FUNCTION validate_model_config_weights();

-- Function to revert to a previous config value
CREATE OR REPLACE FUNCTION revert_model_config(
  p_key text,
  p_history_id uuid,
  p_user_name text DEFAULT 'admin'
)
RETURNS boolean AS $$
DECLARE
  v_old_value numeric;
BEGIN
  -- Get the old value from history
  SELECT old_value INTO v_old_value
  FROM model_config_history
  WHERE id = p_history_id AND key = p_key;
  
  IF v_old_value IS NULL THEN
    RAISE EXCEPTION 'History record not found';
  END IF;
  
  -- Update config back to old value
  UPDATE model_config
  SET value = v_old_value,
      updated_at = now(),
      updated_by = p_user_name
  WHERE key = p_key;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all config as JSON (for caching)
CREATE OR REPLACE FUNCTION get_model_config_json()
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_object_agg(key, value)
    FROM model_config
  );
END;
$$ LANGUAGE plpgsql STABLE;
