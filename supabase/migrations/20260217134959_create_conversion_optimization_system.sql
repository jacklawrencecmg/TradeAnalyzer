/*
  # Create Conversion Optimization System

  1. New Tables
    - `visitor_sessions`
      - `session_id` (uuid, primary key)
      - `first_seen` (timestamptz)
      - `last_seen` (timestamptz)
      - `visit_count` (integer)
      - `intent_score` (integer) - 0-100
      - `intent_level` (text) - 'low', 'medium', 'high'
      - `converted` (boolean) - Signed up
      - `converted_at` (timestamptz)
      - `fingerprint` (text) - Browser fingerprint (non-PII)

    - `visitor_events`
      - `event_id` (uuid, primary key)
      - `session_id` (uuid) - FK to visitor_sessions
      - `event_type` (text) - 'view_player', 'run_trade', 'compare_players', etc.
      - `metadata` (jsonb) - Event-specific data
      - `created_at` (timestamptz)

    - `cta_experiments`
      - `experiment_id` (uuid, primary key)
      - `experiment_name` (text)
      - `variants` (jsonb) - Array of variant configs
      - `is_active` (boolean)
      - `start_date` (timestamptz)
      - `end_date` (timestamptz)
      - `winner_variant_id` (text)

    - `cta_experiment_results`
      - `result_id` (uuid, primary key)
      - `experiment_id` (uuid) - FK to cta_experiments
      - `variant_id` (text)
      - `session_id` (uuid) - FK to visitor_sessions
      - `shown_at` (timestamptz)
      - `clicked` (boolean)
      - `converted` (boolean)
      - `conversion_time_seconds` (integer)

    - `email_captures`
      - `capture_id` (uuid, primary key)
      - `session_id` (uuid) - FK to visitor_sessions
      - `email` (text)
      - `capture_reason` (text) - 'trade_save', 'watchlist', 'report'
      - `captured_at` (timestamptz)
      - `account_created` (boolean)
      - `account_created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public can insert visitor events (anonymous tracking)
    - Service role full access
*/

-- Visitor Sessions
CREATE TABLE IF NOT EXISTS visitor_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  visit_count integer DEFAULT 1,
  intent_score integer DEFAULT 0,
  intent_level text DEFAULT 'low',
  converted boolean DEFAULT false,
  converted_at timestamptz,
  fingerprint text,
  CONSTRAINT valid_intent_level CHECK (intent_level IN ('low', 'medium', 'high'))
);

-- Visitor Events
CREATE TABLE IF NOT EXISTS visitor_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- CTA Experiments
CREATE TABLE IF NOT EXISTS cta_experiments (
  experiment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_name text NOT NULL,
  variants jsonb NOT NULL,
  is_active boolean DEFAULT true,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  winner_variant_id text
);

-- CTA Experiment Results
CREATE TABLE IF NOT EXISTS cta_experiment_results (
  result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES cta_experiments(experiment_id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  session_id uuid NOT NULL REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  shown_at timestamptz DEFAULT now(),
  clicked boolean DEFAULT false,
  converted boolean DEFAULT false,
  conversion_time_seconds integer
);

-- Email Captures
CREATE TABLE IF NOT EXISTS email_captures (
  capture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES visitor_sessions(session_id) ON DELETE CASCADE,
  email text NOT NULL,
  capture_reason text NOT NULL,
  captured_at timestamptz DEFAULT now(),
  account_created boolean DEFAULT false,
  account_created_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visitor_events_session ON visitor_events(session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_type ON visitor_events(event_type);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_fingerprint ON visitor_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_intent ON visitor_sessions(intent_level, intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_converted ON visitor_sessions(converted);
CREATE INDEX IF NOT EXISTS idx_cta_results_experiment ON cta_experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_cta_results_variant ON cta_experiment_results(variant_id);
CREATE INDEX IF NOT EXISTS idx_email_captures_email ON email_captures(email);
CREATE INDEX IF NOT EXISTS idx_email_captures_session ON email_captures(session_id);

-- Enable RLS
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_experiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_captures ENABLE ROW LEVEL SECURITY;

-- Public can create sessions and log events (anonymous tracking)
CREATE POLICY "Anyone can create visitor sessions"
  ON visitor_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update own session"
  ON visitor_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view own session"
  ON visitor_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create visitor events"
  ON visitor_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view experiments"
  ON cta_experiments FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Anyone can create experiment results"
  ON cta_experiment_results FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can capture email"
  ON email_captures FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role can manage sessions"
  ON visitor_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage events"
  ON visitor_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage experiments"
  ON cta_experiments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage results"
  ON cta_experiment_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage email captures"
  ON email_captures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to calculate intent score based on events
CREATE OR REPLACE FUNCTION calculate_intent_score(p_session_id uuid)
RETURNS integer AS $$
DECLARE
  score integer := 0;
  event_counts jsonb;
BEGIN
  SELECT jsonb_object_agg(event_type, count)
  INTO event_counts
  FROM (
    SELECT event_type, COUNT(*) as count
    FROM visitor_events
    WHERE session_id = p_session_id
    GROUP BY event_type
  ) counts;

  score := score + COALESCE((event_counts->>'view_player')::integer * 5, 0);
  score := score + COALESCE((event_counts->>'run_trade')::integer * 20, 0);
  score := score + COALESCE((event_counts->>'compare_players')::integer * 15, 0);
  score := score + COALESCE((event_counts->>'scroll_rankings')::integer * 8, 0);
  score := score + COALESCE((event_counts->>'repeat_visit')::integer * 25, 0);
  score := score + COALESCE((event_counts->>'view_player_twice')::integer * 12, 0);
  score := score + COALESCE((event_counts->>'save_attempt')::integer * 30, 0);
  score := score + COALESCE((event_counts->>'click_cta')::integer * 10, 0);

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to get intent level from score
CREATE OR REPLACE FUNCTION get_intent_level(p_score integer)
RETURNS text AS $$
BEGIN
  IF p_score >= 50 THEN
    RETURN 'high';
  ELSIF p_score >= 20 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update session intent
CREATE OR REPLACE FUNCTION update_session_intent(p_session_id uuid)
RETURNS void AS $$
DECLARE
  new_score integer;
  new_level text;
BEGIN
  new_score := calculate_intent_score(p_session_id);
  new_level := get_intent_level(new_score);

  UPDATE visitor_sessions
  SET
    intent_score = new_score,
    intent_level = new_level,
    last_seen = now()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track event and update intent
CREATE OR REPLACE FUNCTION track_visitor_event(
  p_session_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO visitor_events (session_id, event_type, metadata)
  VALUES (p_session_id, p_event_type, p_metadata)
  RETURNING visitor_events.event_id INTO event_id;

  PERFORM update_session_intent(p_session_id);

  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get active experiment variant
CREATE OR REPLACE FUNCTION get_experiment_variant(
  p_experiment_name text,
  p_session_id uuid
)
RETURNS jsonb AS $$
DECLARE
  experiment record;
  variant_index integer;
  variants_array jsonb;
BEGIN
  SELECT * INTO experiment
  FROM cta_experiments
  WHERE experiment_name = p_experiment_name
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  variants_array := experiment.variants;
  variant_index := (hashtext(p_session_id::text) % jsonb_array_length(variants_array));

  RETURN variants_array->variant_index;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversion metrics
CREATE OR REPLACE FUNCTION get_conversion_metrics(
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  date date,
  total_sessions bigint,
  converted_sessions bigint,
  conversion_rate numeric,
  low_intent_sessions bigint,
  medium_intent_sessions bigint,
  high_intent_sessions bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(first_seen) as date,
    COUNT(*)::bigint as total_sessions,
    COUNT(*) FILTER (WHERE converted = true)::bigint as converted_sessions,
    ROUND(
      COUNT(*) FILTER (WHERE converted = true)::numeric / NULLIF(COUNT(*), 0) * 100,
      2
    ) as conversion_rate,
    COUNT(*) FILTER (WHERE intent_level = 'low')::bigint as low_intent_sessions,
    COUNT(*) FILTER (WHERE intent_level = 'medium')::bigint as medium_intent_sessions,
    COUNT(*) FILTER (WHERE intent_level = 'high')::bigint as high_intent_sessions
  FROM visitor_sessions
  WHERE first_seen > now() - (p_days || ' days')::interval
  GROUP BY DATE(first_seen)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get experiment performance
CREATE OR REPLACE FUNCTION get_experiment_performance(p_experiment_id uuid)
RETURNS TABLE (
  variant_id text,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  click_rate numeric,
  conversion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.variant_id,
    COUNT(*)::bigint as impressions,
    COUNT(*) FILTER (WHERE clicked = true)::bigint as clicks,
    COUNT(*) FILTER (WHERE converted = true)::bigint as conversions,
    ROUND(
      COUNT(*) FILTER (WHERE clicked = true)::numeric / NULLIF(COUNT(*), 0) * 100,
      2
    ) as click_rate,
    ROUND(
      COUNT(*) FILTER (WHERE converted = true)::numeric / NULLIF(COUNT(*), 0) * 100,
      2
    ) as conversion_rate
  FROM cta_experiment_results r
  WHERE r.experiment_id = p_experiment_id
  GROUP BY r.variant_id
  ORDER BY conversion_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert default experiment
INSERT INTO cta_experiments (experiment_name, variants, is_active)
VALUES (
  'headline_test',
  '[
    {"id": "control", "headline": "Dynasty Values", "subheadline": "See real dynasty values — updated daily"},
    {"id": "variant_a", "headline": "Win More Trades", "subheadline": "Stop losing trades with accurate values"},
    {"id": "variant_b", "headline": "Fix Your Team", "subheadline": "See which players are hurting your roster"},
    {"id": "variant_c", "headline": "Stop Losing Trades", "subheadline": "Get the edge with dynasty values"}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
