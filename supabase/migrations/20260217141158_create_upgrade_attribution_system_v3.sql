/*
  # Create Upgrade Attribution & Revenue Analytics System

  1. New Tables
    - `upgrade_events` - Track upgrade attribution
    - `user_actions` - Track important pre-upgrade actions
    - `cta_performance` - Track CTA effectiveness
    - `conversion_analytics` - Aggregate conversion data
    - `weekly_revenue_reports` - Store weekly insights

  2. Security
    - Enable RLS on all tables
    - Admin-only access to analytics
    - Users can view own actions
*/

-- User Actions Tracking
CREATE TABLE user_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  action_type text NOT NULL,
  action_context jsonb DEFAULT '{}',
  is_important boolean DEFAULT false,
  page_path text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_actions_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Upgrade Events (Attribution)
CREATE TABLE upgrade_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  trigger_context jsonb DEFAULT '{}',
  days_since_signup integer,
  session_actions integer,
  last_important_actions jsonb DEFAULT '[]',
  cta_shown text,
  cta_clicked text,
  trial_converted boolean DEFAULT false,
  subscription_tier text DEFAULT 'premium',
  revenue_amount numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- CTA Performance Tracking
CREATE TABLE cta_performance (
  cta_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cta_type text NOT NULL,
  cta_text text NOT NULL,
  trigger_context text DEFAULT 'general',
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue_generated numeric(10,2) DEFAULT 0,
  avg_time_to_conversion interval,
  last_updated timestamptz DEFAULT now()
);

-- Conversion Analytics (Aggregated)
CREATE TABLE conversion_analytics (
  analytics_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_value jsonb NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Weekly Revenue Reports
CREATE TABLE weekly_revenue_reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_upgrades integer DEFAULT 0,
  total_revenue numeric(10,2) DEFAULT 0,
  top_converting_trigger text,
  top_converting_trigger_rate numeric(5,2),
  worst_converting_trigger text,
  worst_converting_trigger_rate numeric(5,2),
  avg_days_to_upgrade numeric(5,2),
  avg_actions_to_upgrade numeric(5,2),
  best_performing_cta text,
  insights jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_actions_user ON user_actions(user_id, created_at DESC);
CREATE INDEX idx_user_actions_session ON user_actions(session_id, created_at DESC);
CREATE INDEX idx_user_actions_important ON user_actions(user_id, is_important, created_at DESC) WHERE is_important = true;
CREATE INDEX idx_upgrade_events_user ON upgrade_events(user_id);
CREATE INDEX idx_upgrade_events_trigger ON upgrade_events(trigger_event);
CREATE INDEX idx_upgrade_events_created ON upgrade_events(created_at DESC);
CREATE INDEX idx_cta_performance_type ON cta_performance(cta_type);
CREATE INDEX idx_conversion_analytics_period ON conversion_analytics(period_start, period_end);
CREATE INDEX idx_weekly_reports_week ON weekly_revenue_reports(week_start DESC);

-- Unique constraints
ALTER TABLE cta_performance ADD CONSTRAINT unique_cta_performance UNIQUE (cta_type, cta_text, trigger_context);
ALTER TABLE weekly_revenue_reports ADD CONSTRAINT unique_weekly_report UNIQUE (week_start, week_end);

-- Enable RLS
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_revenue_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_actions
CREATE POLICY "Users can view own actions"
  ON user_actions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions"
  ON user_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous can track actions"
  ON user_actions FOR INSERT
  TO anon
  WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Service role full access to actions"
  ON user_actions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for upgrade_events
CREATE POLICY "Users can view own upgrades"
  ON upgrade_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to upgrades"
  ON upgrade_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for analytics (admin only)
CREATE POLICY "Service role full access to cta_performance"
  ON cta_performance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to conversion_analytics"
  ON conversion_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to weekly_reports"
  ON weekly_revenue_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to track user action
CREATE OR REPLACE FUNCTION track_user_action(
  p_user_id uuid,
  p_session_id uuid,
  p_action_type text,
  p_action_context jsonb DEFAULT '{}',
  p_page_path text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  action_id uuid;
  is_important boolean;
BEGIN
  is_important := p_action_type IN (
    'trade_eval',
    'watch_player',
    'compare_players',
    'open_advice',
    'open_report',
    'return_visit',
    'view_value_proof',
    'click_upgrade_trigger',
    'start_trial',
    'hit_quota_limit',
    'multiple_trades',
    'view_pricing'
  );

  INSERT INTO user_actions (
    user_id,
    session_id,
    action_type,
    action_context,
    is_important,
    page_path
  )
  VALUES (
    p_user_id,
    p_session_id,
    p_action_type,
    p_action_context,
    is_important,
    p_page_path
  )
  RETURNING user_actions.action_id INTO action_id;

  RETURN action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to determine upgrade trigger
CREATE OR REPLACE FUNCTION determine_upgrade_trigger(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  last_action record;
  repeated_actions jsonb;
  days_since_signup integer;
  session_count integer;
  trigger_event text;
  trigger_context jsonb;
  last_20_actions jsonb;
BEGIN
  SELECT EXTRACT(DAY FROM (now() - created_at))::integer
  INTO days_since_signup
  FROM auth.users
  WHERE id = p_user_id;

  SELECT *
  INTO last_action
  FROM user_actions
  WHERE user_id = p_user_id
    AND is_important = true
    AND created_at > now() - interval '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'count', count
    )
    ORDER BY count DESC
  )
  INTO repeated_actions
  FROM (
    SELECT action_type, COUNT(*) as count
    FROM user_actions
    WHERE user_id = p_user_id
      AND created_at > now() - interval '24 hours'
    GROUP BY action_type
    HAVING COUNT(*) > 2
  ) counts;

  SELECT COUNT(DISTINCT session_id)
  INTO session_count
  FROM user_actions
  WHERE user_id = p_user_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'created_at', created_at,
      'context', action_context
    )
    ORDER BY created_at DESC
  )
  INTO last_20_actions
  FROM (
    SELECT action_type, created_at, action_context
    FROM user_actions
    WHERE user_id = p_user_id
      AND is_important = true
    ORDER BY created_at DESC
    LIMIT 20
  ) recent;

  IF last_action IS NOT NULL THEN
    trigger_event := last_action.action_type;
    trigger_context := last_action.action_context;
  ELSIF repeated_actions IS NOT NULL THEN
    trigger_event := 'repeated_action';
    trigger_context := jsonb_build_object('actions', repeated_actions);
  ELSE
    trigger_event := 'organic';
    trigger_context := '{}';
  END IF;

  RETURN jsonb_build_object(
    'trigger_event', trigger_event,
    'trigger_context', trigger_context,
    'days_since_signup', COALESCE(days_since_signup, 0),
    'session_actions', COALESCE(session_count, 0),
    'last_20_actions', COALESCE(last_20_actions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record upgrade event
CREATE OR REPLACE FUNCTION record_upgrade_event(
  p_user_id uuid,
  p_cta_shown text DEFAULT NULL,
  p_cta_clicked text DEFAULT NULL,
  p_trial_converted boolean DEFAULT false,
  p_revenue_amount numeric DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
  attribution jsonb;
BEGIN
  attribution := determine_upgrade_trigger(p_user_id);

  INSERT INTO upgrade_events (
    user_id,
    trigger_event,
    trigger_context,
    days_since_signup,
    session_actions,
    last_important_actions,
    cta_shown,
    cta_clicked,
    trial_converted,
    revenue_amount
  )
  VALUES (
    p_user_id,
    attribution->>'trigger_event',
    attribution->'trigger_context',
    (attribution->>'days_since_signup')::integer,
    (attribution->>'session_actions')::integer,
    attribution->'last_20_actions',
    p_cta_shown,
    p_cta_clicked,
    p_trial_converted,
    p_revenue_amount
  )
  RETURNING upgrade_events.event_id INTO event_id;

  IF p_cta_clicked IS NOT NULL THEN
    UPDATE cta_performance
    SET conversions = conversions + 1,
        revenue_generated = revenue_generated + COALESCE(p_revenue_amount, 0),
        last_updated = now()
    WHERE cta_type = p_cta_clicked;
  END IF;

  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track CTA impression
CREATE OR REPLACE FUNCTION track_cta_impression(
  p_cta_type text,
  p_cta_text text,
  p_trigger_context text DEFAULT 'general'
)
RETURNS void AS $$
BEGIN
  INSERT INTO cta_performance (
    cta_type,
    cta_text,
    trigger_context,
    impressions
  )
  VALUES (
    p_cta_type,
    p_cta_text,
    p_trigger_context,
    1
  )
  ON CONFLICT (cta_type, cta_text, trigger_context)
  DO UPDATE SET
    impressions = cta_performance.impressions + 1,
    last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track CTA click
CREATE OR REPLACE FUNCTION track_cta_click(
  p_cta_type text,
  p_cta_text text,
  p_trigger_context text DEFAULT 'general'
)
RETURNS void AS $$
BEGIN
  UPDATE cta_performance
  SET clicks = clicks + 1,
      last_updated = now()
  WHERE cta_type = p_cta_type
    AND cta_text = p_cta_text
    AND trigger_context = p_trigger_context;

  IF NOT FOUND THEN
    INSERT INTO cta_performance (cta_type, cta_text, trigger_context, clicks)
    VALUES (p_cta_type, p_cta_text, p_trigger_context, 1)
    ON CONFLICT (cta_type, cta_text, trigger_context)
    DO UPDATE SET clicks = cta_performance.clicks + 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revenue insights
CREATE OR REPLACE FUNCTION get_revenue_insights(
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  total_upgrades bigint,
  total_revenue numeric,
  upgrades_by_trigger jsonb,
  conversion_rate_by_trigger jsonb,
  avg_days_to_upgrade numeric,
  avg_actions_to_upgrade numeric,
  best_performing_cta jsonb,
  worst_performing_cta jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH upgrade_stats AS (
    SELECT
      COUNT(*)::bigint as total_count,
      SUM(revenue_amount) as total_rev,
      AVG(days_since_signup) as avg_days,
      AVG(session_actions) as avg_actions
    FROM upgrade_events
    WHERE created_at > now() - (p_days_back || ' days')::interval
  ),
  trigger_stats AS (
    SELECT
      trigger_event,
      COUNT(*) as count,
      AVG(days_since_signup) as avg_days_for_trigger
    FROM upgrade_events
    WHERE created_at > now() - (p_days_back || ' days')::interval
    GROUP BY trigger_event
  ),
  cta_stats AS (
    SELECT
      cta_type,
      cta_text,
      impressions,
      clicks,
      conversions,
      revenue_generated,
      CASE
        WHEN impressions > 0 THEN (conversions::numeric / impressions::numeric * 100)
        ELSE 0
      END as conversion_rate
    FROM cta_performance
    ORDER BY conversion_rate DESC
  )
  SELECT
    COALESCE(us.total_count, 0),
    COALESCE(ROUND(us.total_rev, 2), 0),
    (SELECT jsonb_object_agg(trigger_event, count)
     FROM trigger_stats),
    (SELECT jsonb_object_agg(
       trigger_event,
       jsonb_build_object(
         'count', count,
         'avg_days', ROUND(avg_days_for_trigger, 2)
       )
     )
     FROM trigger_stats),
    COALESCE(ROUND(us.avg_days, 2), 0),
    COALESCE(ROUND(us.avg_actions, 2), 0),
    (SELECT jsonb_build_object(
       'cta_type', cta_type,
       'cta_text', cta_text,
       'conversion_rate', ROUND(conversion_rate, 2),
       'conversions', conversions,
       'revenue', revenue_generated
     )
     FROM cta_stats
     WHERE conversions > 0
     ORDER BY conversion_rate DESC
     LIMIT 1),
    (SELECT jsonb_build_object(
       'cta_type', cta_type,
       'cta_text', cta_text,
       'conversion_rate', ROUND(conversion_rate, 2),
       'conversions', conversions,
       'impressions', impressions
     )
     FROM cta_stats
     WHERE impressions > 10
     ORDER BY conversion_rate ASC
     LIMIT 1)
  FROM upgrade_stats us;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
