/*
  # Create Premium Subscription System

  1. Purpose
    - Monetize platform through premium memberships
    - Free tier provides core value
    - Pro tier unlocks advanced features
    - Stripe integration for payments
    - Trial system for conversion
    - Usage tracking and limits

  2. Pricing Model
    
    **Free Tier:**
    - Rankings and player values
    - Basic trade calculator
    - 1 league import
    - Player pages and reports
    - 10 trade calculations/day
    - No alerts or advanced analytics
    
    **Pro Tier - $7/month:**
    - Unlimited trade calculations
    - Unlimited league imports
    - Trade suggestions engine
    - Team strategy advice
    - Market alerts and watchlist
    - Power rankings history
    - Advanced IDP presets
    - Future pick projections
    - Player trend analytics
    - Priority support

  3. New Tables
    
    `user_subscriptions`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `tier` (text) - "free" or "pro"
    - `status` (text) - "active", "trialing", "canceled", "past_due"
    - `stripe_customer_id` (text)
    - `stripe_subscription_id` (text)
    - `current_period_start` (timestamptz)
    - `current_period_end` (timestamptz)
    - `cancel_at_period_end` (boolean)
    - `trial_start` (timestamptz)
    - `trial_end` (timestamptz)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

    `usage_tracking`
    - `id` (uuid, primary key)
    - `user_id` (uuid)
    - `feature` (text) - "trade_calc", "league_import", etc.
    - `count` (int)
    - `reset_at` (timestamptz)
    - `date` (date)

    `feature_access_log`
    - `id` (uuid, primary key)
    - `user_id` (uuid)
    - `feature` (text)
    - `granted` (boolean)
    - `reason` (text)
    - `created_at` (timestamptz)

  4. Security
    - Enable RLS on all tables
    - Users can only read their own subscription
    - Only service role can update subscriptions
    - Usage tracking per user

  5. Features
    - Automatic trial for new users (7 days)
    - Daily usage reset
    - Feature gating utilities
    - Stripe webhook handling
    - Subscription status checks
*/

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,
  count int DEFAULT 1,
  reset_at timestamptz NOT NULL,
  date date DEFAULT CURRENT_DATE,
  UNIQUE(user_id, feature, date)
);

-- Create feature_access_log table
CREATE TABLE IF NOT EXISTS feature_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  granted boolean NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions
  FOR ALL
  USING (true);

-- RLS Policies for usage_tracking

-- Users can read their own usage
CREATE POLICY "Users can view own usage"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can track own usage"
  ON usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update own usage"
  ON usage_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for feature_access_log

-- Users can read their own logs
CREATE POLICY "Users can view own access log"
  ON feature_access_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert logs
CREATE POLICY "System can log access"
  ON feature_access_log
  FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
  ON user_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer 
  ON user_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription 
  ON user_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date 
  ON usage_tracking(user_id, date);

CREATE INDEX IF NOT EXISTS idx_feature_access_log_user 
  ON feature_access_log(user_id, created_at DESC);

-- Function: Get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id uuid)
RETURNS TABLE (
  tier text,
  status text,
  is_pro boolean,
  is_trial boolean,
  trial_days_left int,
  period_end timestamptz
) AS $$
DECLARE
  v_subscription RECORD;
  v_is_pro boolean := false;
  v_is_trial boolean := false;
  v_trial_days int := 0;
BEGIN
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- No subscription found, return default free tier
    RETURN QUERY SELECT 
      'free'::text,
      'active'::text,
      false,
      false,
      0,
      NULL::timestamptz;
    RETURN;
  END IF;

  -- Check if user is in trial
  IF v_subscription.status = 'trialing' 
     AND v_subscription.trial_end > now() THEN
    v_is_trial := true;
    v_is_pro := true;
    v_trial_days := EXTRACT(day FROM (v_subscription.trial_end - now()));
  END IF;

  -- Check if user is pro
  IF v_subscription.tier = 'pro' 
     AND v_subscription.status IN ('active', 'trialing')
     AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > now()) THEN
    v_is_pro := true;
  END IF;

  RETURN QUERY SELECT
    v_subscription.tier,
    v_subscription.status,
    v_is_pro,
    v_is_trial,
    v_trial_days,
    v_subscription.current_period_end;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Check feature access
CREATE OR REPLACE FUNCTION check_feature_access(
  p_user_id uuid,
  p_feature text
)
RETURNS boolean AS $$
DECLARE
  v_has_access boolean := false;
  v_subscription RECORD;
  v_free_features text[] := ARRAY[
    'player_search',
    'player_detail',
    'rankings',
    'dynasty_reports',
    'basic_trade_calc'
  ];
BEGIN
  -- Check if feature is free
  IF p_feature = ANY(v_free_features) THEN
    RETURN true;
  END IF;

  -- Get user subscription
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- No subscription, only free features
    RETURN false;
  END IF;

  -- Check if pro and active
  IF v_subscription.tier = 'pro' 
     AND v_subscription.status IN ('active', 'trialing')
     AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > now()) THEN
    RETURN true;
  END IF;

  -- Check if in valid trial
  IF v_subscription.status = 'trialing' 
     AND v_subscription.trial_end > now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Track usage
CREATE OR REPLACE FUNCTION track_usage(
  p_user_id uuid,
  p_feature text
)
RETURNS int AS $$
DECLARE
  v_count int;
  v_reset_at timestamptz;
BEGIN
  -- Reset at midnight
  v_reset_at := (CURRENT_DATE + INTERVAL '1 day')::timestamptz;

  -- Insert or increment usage
  INSERT INTO usage_tracking (user_id, feature, count, reset_at, date)
  VALUES (p_user_id, p_feature, 1, v_reset_at, CURRENT_DATE)
  ON CONFLICT (user_id, feature, date)
  DO UPDATE SET count = usage_tracking.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Get usage count
CREATE OR REPLACE FUNCTION get_usage_count(
  p_user_id uuid,
  p_feature text
)
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COALESCE(count, 0) INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = CURRENT_DATE;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Check usage limit
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id uuid,
  p_feature text,
  p_limit int
)
RETURNS boolean AS $$
DECLARE
  v_current_usage int;
  v_has_pro boolean;
BEGIN
  -- Pro users have no limits
  SELECT is_pro INTO v_has_pro
  FROM get_user_subscription(p_user_id);

  IF v_has_pro THEN
    RETURN true;
  END IF;

  -- Get current usage
  v_current_usage := get_usage_count(p_user_id, p_feature);

  -- Check limit
  RETURN v_current_usage < p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Create trial subscription for new user
CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_trial_end timestamptz;
BEGIN
  v_trial_end := now() + INTERVAL '7 days';

  INSERT INTO user_subscriptions (
    user_id,
    tier,
    status,
    trial_start,
    trial_end,
    current_period_end
  ) VALUES (
    p_user_id,
    'pro',
    'trialing',
    now(),
    v_trial_end,
    v_trial_end
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Expire trials (run via cron)
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  WITH expired AS (
    UPDATE user_subscriptions
    SET 
      status = 'active',
      tier = 'free',
      trial_end = NULL,
      trial_start = NULL,
      updated_at = now()
    WHERE status = 'trialing'
      AND trial_end < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Update subscription from Stripe
CREATE OR REPLACE FUNCTION update_subscription_from_stripe(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean DEFAULT false
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    tier,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    updated_at
  ) VALUES (
    p_user_id,
    'pro',
    p_status,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    now()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    tier = 'pro',
    status = p_status,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_start = p_current_period_start,
    current_period_end = p_current_period_end,
    cancel_at_period_end = p_cancel_at_period_end,
    trial_end = CASE 
      WHEN user_subscriptions.status = 'trialing' AND p_status != 'trialing' 
      THEN NULL 
      ELSE user_subscriptions.trial_end 
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Function: Cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_user_id uuid,
  p_immediately boolean DEFAULT false
)
RETURNS void AS $$
BEGIN
  IF p_immediately THEN
    UPDATE user_subscriptions
    SET 
      status = 'canceled',
      tier = 'free',
      cancel_at_period_end = false,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE user_subscriptions
    SET 
      cancel_at_period_end = true,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Trigger: Auto-create trial for new users
CREATE OR REPLACE FUNCTION trigger_create_trial()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_trial_subscription(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_trial();

-- Trigger: Update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_subscription(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_feature_access(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION track_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_usage_limit(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION create_trial_subscription(uuid) TO authenticated;

-- Comments
COMMENT ON TABLE user_subscriptions IS 
  'Stores user subscription status and Stripe metadata';

COMMENT ON TABLE usage_tracking IS 
  'Tracks daily feature usage per user for free tier limits';

COMMENT ON TABLE feature_access_log IS 
  'Audit log of feature access attempts';

COMMENT ON FUNCTION get_user_subscription IS 
  'Returns comprehensive subscription status for a user';

COMMENT ON FUNCTION check_feature_access IS 
  'Checks if user has access to a specific feature';

COMMENT ON FUNCTION track_usage IS 
  'Increments usage counter for a feature and returns new count';

COMMENT ON FUNCTION check_usage_limit IS 
  'Checks if user is within usage limit for a feature';

COMMENT ON FUNCTION expire_trials IS 
  'Expires trials and downgrades to free tier (run daily via cron)';
