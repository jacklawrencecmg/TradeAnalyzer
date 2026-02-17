/*
  # Create Authority Signals System for Natural Backlinks

  1. New Tables
    - `widget_embeds`
      - `embed_id` (uuid, primary key)
      - `player_id` (text)
      - `domain` (text) - Embedding site domain
      - `widget_type` (text) - 'player_card', 'rankings_list', 'trade_comparison'
      - `first_seen` (timestamptz)
      - `last_seen` (timestamptz)
      - `total_views` (integer)
      - `is_verified` (boolean) - Manual verification of quality sites

    - `api_access_keys`
      - `key_id` (uuid, primary key)
      - `api_key` (text, unique)
      - `key_name` (text) - Friendly name
      - `owner_email` (text)
      - `rate_limit_per_hour` (integer) - Default 100
      - `endpoints_allowed` (text[]) - Array of allowed endpoints
      - `created_at` (timestamptz)
      - `last_used` (timestamptz)
      - `is_active` (boolean)

    - `api_usage_log`
      - `log_id` (uuid, primary key)
      - `api_key` (text)
      - `endpoint` (text)
      - `request_params` (jsonb)
      - `response_status` (integer)
      - `response_time_ms` (integer)
      - `user_agent` (text)
      - `ip_address` (text)
      - `created_at` (timestamptz)

    - `share_links`
      - `share_id` (uuid, primary key)
      - `slug` (text, unique)
      - `share_type` (text) - 'trade', 'player', 'rankings'
      - `share_data` (jsonb) - Trade details, player IDs, etc.
      - `created_at` (timestamptz)
      - `view_count` (integer)
      - `unique_visitors` (integer)

    - `backlink_tracking`
      - `backlink_id` (uuid, primary key)
      - `source_domain` (text)
      - `source_url` (text)
      - `target_url` (text) - Our URL
      - `anchor_text` (text)
      - `link_type` (text) - 'widget', 'api', 'share', 'organic'
      - `first_detected` (timestamptz)
      - `last_verified` (timestamptz)
      - `is_active` (boolean)
      - `domain_authority` (integer) - If known

  2. Security
    - Enable RLS on all tables
    - Public read for widget/share data
    - Admin-only for backlink tracking
*/

-- Widget Embeds Tracking
CREATE TABLE IF NOT EXISTS widget_embeds (
  embed_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  domain text NOT NULL,
  widget_type text NOT NULL,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  total_views integer DEFAULT 1,
  is_verified boolean DEFAULT false,
  UNIQUE(player_id, domain, widget_type)
);

-- API Access Keys
CREATE TABLE IF NOT EXISTS api_access_keys (
  key_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text UNIQUE NOT NULL,
  key_name text NOT NULL,
  owner_email text,
  rate_limit_per_hour integer DEFAULT 100,
  endpoints_allowed text[] DEFAULT '{"public"}',
  created_at timestamptz DEFAULT now(),
  last_used timestamptz,
  is_active boolean DEFAULT true
);

-- API Usage Log
CREATE TABLE IF NOT EXISTS api_usage_log (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text,
  endpoint text NOT NULL,
  request_params jsonb DEFAULT '{}',
  response_status integer,
  response_time_ms integer,
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Share Links
CREATE TABLE IF NOT EXISTS share_links (
  share_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  share_type text NOT NULL,
  share_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  view_count integer DEFAULT 0,
  unique_visitors integer DEFAULT 0
);

-- Backlink Tracking
CREATE TABLE IF NOT EXISTS backlink_tracking (
  backlink_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain text NOT NULL,
  source_url text,
  target_url text NOT NULL,
  anchor_text text,
  link_type text NOT NULL,
  first_detected timestamptz DEFAULT now(),
  last_verified timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  domain_authority integer,
  UNIQUE(source_domain, target_url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_widget_embeds_domain ON widget_embeds(domain);
CREATE INDEX IF NOT EXISTS idx_widget_embeds_player ON widget_embeds(player_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_access_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_key ON api_usage_log(api_key);
CREATE INDEX IF NOT EXISTS idx_share_links_slug ON share_links(slug);
CREATE INDEX IF NOT EXISTS idx_backlink_tracking_source ON backlink_tracking(source_domain);
CREATE INDEX IF NOT EXISTS idx_backlink_tracking_active ON backlink_tracking(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE widget_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlink_tracking ENABLE ROW LEVEL SECURITY;

-- Public read access for widget and share data
CREATE POLICY "Anyone can view widget embeds"
  ON widget_embeds FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view share links"
  ON share_links FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role full access
CREATE POLICY "Service role can manage widget embeds"
  ON widget_embeds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage api keys"
  ON api_access_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage api logs"
  ON api_usage_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage share links"
  ON share_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage backlinks"
  ON backlink_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to track widget embed
CREATE OR REPLACE FUNCTION track_widget_embed(
  p_player_id text,
  p_domain text,
  p_widget_type text
)
RETURNS void AS $$
BEGIN
  INSERT INTO widget_embeds (player_id, domain, widget_type, first_seen, last_seen, total_views)
  VALUES (p_player_id, p_domain, p_widget_type, now(), now(), 1)
  ON CONFLICT (player_id, domain, widget_type)
  DO UPDATE SET
    last_seen = now(),
    total_views = widget_embeds.total_views + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to validate API key and check rate limit
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key text)
RETURNS TABLE (
  is_valid boolean,
  rate_limit integer,
  current_usage integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.is_active,
    k.rate_limit_per_hour,
    (
      SELECT COUNT(*)::integer
      FROM api_usage_log
      WHERE api_key = p_api_key
        AND created_at > now() - interval '1 hour'
    )
  FROM api_access_keys k
  WHERE k.api_key = p_api_key;
END;
$$ LANGUAGE plpgsql;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  p_api_key text,
  p_endpoint text,
  p_params jsonb,
  p_status integer,
  p_response_time integer,
  p_user_agent text,
  p_ip text
)
RETURNS void AS $$
BEGIN
  INSERT INTO api_usage_log (
    api_key, endpoint, request_params, response_status,
    response_time_ms, user_agent, ip_address
  )
  VALUES (
    p_api_key, p_endpoint, p_params, p_status,
    p_response_time, p_user_agent, p_ip
  );

  UPDATE api_access_keys
  SET last_used = now()
  WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql;

-- Function to increment share link views
CREATE OR REPLACE FUNCTION increment_share_view(p_slug text)
RETURNS void AS $$
BEGIN
  UPDATE share_links
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to get top backlink sources
CREATE OR REPLACE FUNCTION get_top_backlink_sources(p_limit integer DEFAULT 50)
RETURNS TABLE (
  source_domain text,
  backlink_count bigint,
  total_views bigint,
  avg_domain_authority numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.source_domain,
    COUNT(*)::bigint,
    COALESCE(SUM(w.total_views), 0)::bigint,
    AVG(b.domain_authority)
  FROM backlink_tracking b
  LEFT JOIN widget_embeds w ON b.source_domain = w.domain
  WHERE b.is_active = true
  GROUP BY b.source_domain
  ORDER BY COUNT(*) DESC, SUM(w.total_views) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to track backlink
CREATE OR REPLACE FUNCTION track_backlink(
  p_source_domain text,
  p_source_url text,
  p_target_url text,
  p_anchor_text text,
  p_link_type text,
  p_domain_authority integer DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO backlink_tracking (
    source_domain, source_url, target_url, anchor_text,
    link_type, domain_authority
  )
  VALUES (
    p_source_domain, p_source_url, p_target_url, p_anchor_text,
    p_link_type, p_domain_authority
  )
  ON CONFLICT (source_domain, target_url)
  DO UPDATE SET
    last_verified = now(),
    is_active = true;
END;
$$ LANGUAGE plpgsql;
