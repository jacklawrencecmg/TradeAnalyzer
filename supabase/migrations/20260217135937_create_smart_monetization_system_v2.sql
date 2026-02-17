/*
  # Create Smart Monetization System

  1. New Tables
    - `user_usage_tracking` - Track daily usage quotas
    - `trial_grants` - Track trial periods
    - `upgrade_triggers` - Track when upgrade prompts shown
    - `missed_opportunities` - Track value user could have captured

  2. Security
    - Enable RLS on all tables
    - Users can only see their own data
*/

-- User Usage Tracking
CREATE TABLE IF NOT EXISTS user_usage_tracking (
  usage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  action_type text NOT NULL,
  quota_type text,
  count integer DEFAULT 1,
  last_reset date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT usage_tracking_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Trial Grants
CREATE TABLE IF NOT EXISTS trial_grants (
  trial_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  trigger_action text NOT NULL,
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  converted_to_paid boolean DEFAULT false,
  CONSTRAINT trial_grants_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Upgrade Triggers
CREATE TABLE IF NOT EXISTS upgrade_triggers (
  trigger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  context jsonb DEFAULT '{}',
  shown_at timestamptz DEFAULT now(),
  clicked boolean DEFAULT false,
  converted boolean DEFAULT false,
  CONSTRAINT upgrade_triggers_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Missed Opportunities
CREATE TABLE IF NOT EXISTS missed_opportunities (
  opportunity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_type text NOT NULL,
  player_id text NOT NULL,
  value_before integer NOT NULL,
  value_after integer NOT NULL,
  detected_at timestamptz DEFAULT now(),
  premium_user_notified_at timestamptz,
  free_user_could_have_saved text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON user_usage_tracking(user_id, quota_type, last_reset);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_session ON user_usage_tracking(session_id, quota_type, last_reset);
CREATE INDEX IF NOT EXISTS idx_trial_grants_user ON trial_grants(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_trial_grants_session ON trial_grants(session_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_upgrade_triggers_user ON upgrade_triggers(user_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_missed_opportunities_user ON missed_opportunities(user_id, detected_at DESC);

-- Enable RLS
ALTER TABLE user_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE missed_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_usage_tracking
CREATE POLICY "Users can view own usage"
  ON user_usage_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous can track usage"
  ON user_usage_tracking FOR INSERT
  TO anon
  WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Service role full access to usage"
  ON user_usage_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for trial_grants
CREATE POLICY "Users can view own trials"
  ON trial_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage trials"
  ON trial_grants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for upgrade_triggers
CREATE POLICY "Users can view own triggers"
  ON upgrade_triggers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create triggers"
  ON upgrade_triggers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage triggers"
  ON upgrade_triggers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for missed_opportunities
CREATE POLICY "Users can view own missed opportunities"
  ON missed_opportunities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage opportunities"
  ON missed_opportunities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if user has active trial or subscription
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  has_subscription boolean;
  has_trial boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND tier = 'premium'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_subscription;

  IF has_subscription THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM trial_grants
    WHERE user_id = p_user_id
      AND expires_at > now()
  ) INTO has_trial;

  RETURN has_trial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check usage quota
CREATE OR REPLACE FUNCTION check_usage_quota(
  p_user_id uuid,
  p_quota_type text,
  p_free_limit integer
)
RETURNS jsonb AS $$
DECLARE
  current_count integer;
  has_premium boolean;
  result jsonb;
BEGIN
  has_premium := has_premium_access(p_user_id);

  IF has_premium THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'has_premium', true,
      'current_count', 0,
      'limit', null,
      'remaining', null
    );
  END IF;

  SELECT COALESCE(SUM(count), 0)
  INTO current_count
  FROM user_usage_tracking
  WHERE user_id = p_user_id
    AND quota_type = p_quota_type
    AND last_reset = CURRENT_DATE;

  result := jsonb_build_object(
    'allowed', current_count < p_free_limit,
    'has_premium', false,
    'current_count', current_count,
    'limit', p_free_limit,
    'remaining', GREATEST(0, p_free_limit - current_count)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id uuid,
  p_action_type text,
  p_quota_type text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  existing_usage record;
BEGIN
  SELECT * INTO existing_usage
  FROM user_usage_tracking
  WHERE user_id = p_user_id
    AND quota_type = p_quota_type
    AND last_reset = CURRENT_DATE;

  IF FOUND THEN
    UPDATE user_usage_tracking
    SET count = count + 1
    WHERE usage_id = existing_usage.usage_id;
  ELSE
    INSERT INTO user_usage_tracking (user_id, action_type, quota_type, count, last_reset)
    VALUES (p_user_id, p_action_type, p_quota_type, 1, CURRENT_DATE);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant trial
CREATE OR REPLACE FUNCTION grant_trial(
  p_user_id uuid,
  p_trigger_action text,
  p_duration_hours integer DEFAULT 24
)
RETURNS uuid AS $$
DECLARE
  trial_id uuid;
  existing_trial boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM trial_grants
    WHERE user_id = p_user_id
  ) INTO existing_trial;

  IF existing_trial THEN
    RETURN NULL;
  END IF;

  INSERT INTO trial_grants (user_id, trigger_action, expires_at)
  VALUES (
    p_user_id,
    p_trigger_action,
    now() + (p_duration_hours || ' hours')::interval
  )
  RETURNING trial_grants.trial_id INTO trial_id;

  RETURN trial_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record missed opportunity
CREATE OR REPLACE FUNCTION record_missed_opportunity(
  p_user_id uuid,
  p_opportunity_type text,
  p_player_id text,
  p_value_before integer,
  p_value_after integer,
  p_benefit_description text
)
RETURNS uuid AS $$
DECLARE
  opportunity_id uuid;
  has_premium boolean;
BEGIN
  has_premium := has_premium_access(p_user_id);

  IF has_premium THEN
    RETURN NULL;
  END IF;

  INSERT INTO missed_opportunities (
    user_id,
    opportunity_type,
    player_id,
    value_before,
    value_after,
    free_user_could_have_saved
  )
  VALUES (
    p_user_id,
    p_opportunity_type,
    p_player_id,
    p_value_before,
    p_value_after,
    p_benefit_description
  )
  RETURNING missed_opportunities.opportunity_id INTO opportunity_id;

  RETURN opportunity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's value proof data
CREATE OR REPLACE FUNCTION get_value_proof(p_user_id uuid)
RETURNS TABLE (
  missed_opportunities_count bigint,
  total_value_change integer,
  avg_hours_delayed numeric,
  top_opportunities jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as missed_opportunities_count,
    SUM(ABS(value_after - value_before))::integer as total_value_change,
    ROUND(AVG(EXTRACT(EPOCH FROM (now() - detected_at)) / 3600), 1) as avg_hours_delayed,
    jsonb_agg(
      jsonb_build_object(
        'player_id', mo.player_id,
        'type', mo.opportunity_type,
        'value_change', mo.value_after - mo.value_before,
        'detected_at', mo.detected_at,
        'description', mo.free_user_could_have_saved
      )
      ORDER BY ABS(mo.value_after - mo.value_before) DESC
    ) FILTER (WHERE mo.opportunity_id IS NOT NULL) as top_opportunities
  FROM missed_opportunities mo
  WHERE mo.user_id = p_user_id
    AND mo.detected_at > now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
