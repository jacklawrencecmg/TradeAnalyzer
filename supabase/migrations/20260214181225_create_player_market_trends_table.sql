/*
  # Create Player Market Trends System

  1. Purpose
    - Cache daily market trend analysis for all players
    - Identify buy-low and sell-high opportunities
    - Track rising, falling, and stable value trends
    - Enable fast API queries without recomputing

  2. New Tables
    
    `player_market_trends`
    - `id` (uuid, primary key) - Unique identifier
    - `player_id` (text) - Sleeper player ID
    - `player_name` (text) - Player full name
    - `player_position` (text) - QB, RB, WR, TE, etc.
    - `team` (text) - NFL team abbreviation
    - `value_now` (int) - Current FDP value
    - `value_7d` (int) - Value 7 days ago
    - `value_30d` (int) - Value 30 days ago
    - `change_7d` (int) - 7-day change in value
    - `change_30d` (int) - 30-day change in value
    - `change_7d_pct` (numeric) - 7-day percentage change
    - `change_30d_pct` (numeric) - 30-day percentage change
    - `volatility` (int) - Standard deviation of recent values
    - `tag` (text) - buy_low, sell_high, rising, falling, stable
    - `signal_strength` (int) - 0-100 confidence score
    - `computed_at` (timestamptz) - When trend was calculated
    - `created_at` (timestamptz) - Record creation time

  3. Security
    - Enable RLS on table
    - Anyone can view trends (public data)
    - Only system can insert/update via service role

  4. Indexes
    - Index on tag for filtering
    - Index on player_position for filtering
    - Index on signal_strength for sorting
    - Index on computed_at for freshness checks
    - Composite index on (tag, signal_strength DESC)

  5. Refresh Policy
    - Trends computed daily after value sync
    - Old trends deleted when new ones computed
    - Keep only latest computation per player
*/

-- Create player_market_trends table
CREATE TABLE IF NOT EXISTS player_market_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  player_name text NOT NULL,
  player_position text NOT NULL,
  team text,
  value_now int NOT NULL DEFAULT 0,
  value_7d int NOT NULL DEFAULT 0,
  value_30d int NOT NULL DEFAULT 0,
  change_7d int NOT NULL DEFAULT 0,
  change_30d int NOT NULL DEFAULT 0,
  change_7d_pct numeric(10, 1) DEFAULT 0,
  change_30d_pct numeric(10, 1) DEFAULT 0,
  volatility int NOT NULL DEFAULT 0,
  tag text NOT NULL CHECK (tag IN ('buy_low', 'sell_high', 'rising', 'falling', 'stable')),
  signal_strength int NOT NULL DEFAULT 0 CHECK (signal_strength >= 0 AND signal_strength <= 100),
  computed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, computed_at)
);

-- Enable RLS
ALTER TABLE player_market_trends ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view market trends (public data)
CREATE POLICY "Anyone can view market trends"
  ON player_market_trends
  FOR SELECT
  USING (true);

-- System can insert/update via service role (no policy needed)

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_market_trends_tag 
  ON player_market_trends(tag);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_position 
  ON player_market_trends(player_position);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_signal_strength 
  ON player_market_trends(signal_strength DESC);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_computed_at 
  ON player_market_trends(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_player_id 
  ON player_market_trends(player_id);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_tag_strength 
  ON player_market_trends(tag, signal_strength DESC);

CREATE INDEX IF NOT EXISTS idx_player_market_trends_value_now 
  ON player_market_trends(value_now DESC);

-- Function to get latest trends
CREATE OR REPLACE FUNCTION get_latest_trends(
  p_tag text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  player_id text,
  player_name text,
  player_position text,
  team text,
  value_now int,
  value_7d int,
  value_30d int,
  change_7d int,
  change_30d int,
  change_7d_pct numeric,
  change_30d_pct numeric,
  volatility int,
  tag text,
  signal_strength int,
  computed_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pmt.player_id)
    pmt.player_id,
    pmt.player_name,
    pmt.player_position,
    pmt.team,
    pmt.value_now,
    pmt.value_7d,
    pmt.value_30d,
    pmt.change_7d,
    pmt.change_30d,
    pmt.change_7d_pct,
    pmt.change_30d_pct,
    pmt.volatility,
    pmt.tag,
    pmt.signal_strength,
    pmt.computed_at
  FROM player_market_trends pmt
  WHERE (p_tag IS NULL OR pmt.tag = p_tag)
  AND (p_position IS NULL OR pmt.player_position = p_position)
  ORDER BY pmt.player_id, pmt.computed_at DESC, pmt.signal_strength DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get buy-low opportunities
CREATE OR REPLACE FUNCTION get_buy_low_players(p_position text DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS TABLE (
  player_id text,
  player_name text,
  player_position text,
  team text,
  value_now int,
  change_30d int,
  change_30d_pct numeric,
  signal_strength int
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pmt.player_id)
    pmt.player_id,
    pmt.player_name,
    pmt.player_position,
    pmt.team,
    pmt.value_now,
    pmt.change_30d,
    pmt.change_30d_pct,
    pmt.signal_strength
  FROM player_market_trends pmt
  WHERE pmt.tag = 'buy_low'
  AND (p_position IS NULL OR pmt.player_position = p_position)
  ORDER BY pmt.player_id, pmt.computed_at DESC, pmt.signal_strength DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get sell-high opportunities
CREATE OR REPLACE FUNCTION get_sell_high_players(p_position text DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS TABLE (
  player_id text,
  player_name text,
  player_position text,
  team text,
  value_now int,
  change_30d int,
  change_30d_pct numeric,
  signal_strength int
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pmt.player_id)
    pmt.player_id,
    pmt.player_name,
    pmt.player_position,
    pmt.team,
    pmt.value_now,
    pmt.change_30d,
    pmt.change_30d_pct,
    pmt.signal_strength
  FROM player_market_trends pmt
  WHERE pmt.tag = 'sell_high'
  AND (p_position IS NULL OR pmt.player_position = p_position)
  ORDER BY pmt.player_id, pmt.computed_at DESC, pmt.signal_strength DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to clean old trends (keep only latest)
CREATE OR REPLACE FUNCTION clean_old_market_trends()
RETURNS void AS $$
BEGIN
  DELETE FROM player_market_trends
  WHERE computed_at < (
    SELECT MAX(computed_at) - interval '7 days'
    FROM player_market_trends
  );
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_latest_trends(text, text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_buy_low_players(text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_sell_high_players(text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION clean_old_market_trends() TO authenticated;

-- Add helpful comments
COMMENT ON TABLE player_market_trends IS 
  'Daily market trend analysis identifying buy-low and sell-high opportunities';

COMMENT ON COLUMN player_market_trends.tag IS 
  'Trend classification: buy_low, sell_high, rising, falling, stable';

COMMENT ON COLUMN player_market_trends.signal_strength IS 
  'Confidence score 0-100 indicating strength of trend signal';

COMMENT ON COLUMN player_market_trends.computed_at IS 
  'Timestamp when trend was calculated - used for daily refresh';

COMMENT ON FUNCTION get_buy_low_players IS 
  'Returns players with strongest buy-low signals, optionally filtered by position';

COMMENT ON FUNCTION get_sell_high_players IS 
  'Returns players with strongest sell-high signals, optionally filtered by position';
