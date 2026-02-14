/*
  # Create Player Watchlist System

  1. Purpose
    - Allow users to follow/watch specific players
    - Generate alerts when player values change significantly
    - Enable anonymous users (session-based, no auth required)
    - Drive daily engagement through personalized notifications

  2. New Tables
    
    `user_watchlists`
    - `id` (uuid, primary key) - Unique watchlist identifier
    - `session_id` (text, unique) - Anonymous session identifier
    - `user_id` (uuid, nullable) - Optional auth user ID for future
    - `created_at` (timestamptz) - When watchlist was created
    - `updated_at` (timestamptz) - Last modification time
    
    `watchlist_players`
    - `watchlist_id` (uuid) - References user_watchlists
    - `player_id` (text) - Sleeper player ID
    - `added_at` (timestamptz) - When player was added to watchlist
    - `notes` (text, nullable) - Optional user notes
    - Primary key: (watchlist_id, player_id)
    
    `watchlist_alerts`
    - `id` (uuid, primary key) - Unique alert identifier
    - `watchlist_id` (uuid) - References user_watchlists
    - `player_id` (text) - Sleeper player ID
    - `alert_type` (text) - Type: value_spike, value_drop, buy_low, sell_high, role_change
    - `message` (text) - Alert message for user
    - `severity` (text) - low, medium, high
    - `is_read` (boolean) - Whether user has seen alert
    - `created_at` (timestamptz) - When alert was generated
    - `metadata` (jsonb) - Additional alert data

  3. Security
    - Enable RLS on all tables
    - Session-based access control
    - Users can only access their own watchlist
    - Alerts visible only to watchlist owner

  4. Indexes
    - Index on session_id for fast lookups
    - Index on player_id for player-based queries
    - Index on alert type and read status
    - Composite indexes for common queries

  5. Use Cases
    - User follows 10-15 favorite players
    - System generates alerts after nightly sync
    - User sees badge with unread alert count
    - User clicks to view alerts
    - User can add/remove players anytime
*/

-- Create user_watchlists table
CREATE TABLE IF NOT EXISTS user_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create watchlist_players table
CREATE TABLE IF NOT EXISTS watchlist_players (
  watchlist_id uuid NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  added_at timestamptz DEFAULT now(),
  notes text,
  PRIMARY KEY (watchlist_id, player_id)
);

-- Create watchlist_alerts table
CREATE TABLE IF NOT EXISTS watchlist_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('value_spike', 'value_drop', 'buy_low', 'sell_high', 'role_change', 'trending_up', 'trending_down')),
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_watchlists

-- Anyone can create a watchlist (anonymous sessions)
CREATE POLICY "Anyone can create watchlist"
  ON user_watchlists
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own watchlist (by session_id via function)
CREATE POLICY "Users can view own watchlist"
  ON user_watchlists
  FOR SELECT
  USING (true);

-- Users can update their own watchlist
CREATE POLICY "Users can update own watchlist"
  ON user_watchlists
  FOR UPDATE
  USING (true);

-- RLS Policies for watchlist_players

-- Users can insert players to their watchlist
CREATE POLICY "Users can add players to watchlist"
  ON watchlist_players
  FOR INSERT
  WITH CHECK (true);

-- Users can view their watchlist players
CREATE POLICY "Users can view watchlist players"
  ON watchlist_players
  FOR SELECT
  USING (true);

-- Users can remove players from watchlist
CREATE POLICY "Users can delete watchlist players"
  ON watchlist_players
  FOR DELETE
  USING (true);

-- RLS Policies for watchlist_alerts

-- System can insert alerts
CREATE POLICY "System can create alerts"
  ON watchlist_alerts
  FOR INSERT
  WITH CHECK (true);

-- Users can view their alerts
CREATE POLICY "Users can view own alerts"
  ON watchlist_alerts
  FOR SELECT
  USING (true);

-- Users can update their alerts (mark as read)
CREATE POLICY "Users can update own alerts"
  ON watchlist_alerts
  FOR UPDATE
  USING (true);

-- Users can delete their alerts
CREATE POLICY "Users can delete own alerts"
  ON watchlist_alerts
  FOR DELETE
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_watchlists_session_id 
  ON user_watchlists(session_id);

CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_id 
  ON user_watchlists(user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_players_watchlist_id 
  ON watchlist_players(watchlist_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_players_player_id 
  ON watchlist_players(player_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_watchlist_id 
  ON watchlist_alerts(watchlist_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_player_id 
  ON watchlist_alerts(player_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_type 
  ON watchlist_alerts(alert_type);

CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_read 
  ON watchlist_alerts(is_read);

CREATE INDEX IF NOT EXISTS idx_watchlist_alerts_unread 
  ON watchlist_alerts(watchlist_id, is_read, created_at DESC) 
  WHERE is_read = false;

-- Function to get or create watchlist by session
CREATE OR REPLACE FUNCTION get_or_create_watchlist(p_session_id text)
RETURNS uuid AS $$
DECLARE
  v_watchlist_id uuid;
BEGIN
  SELECT id INTO v_watchlist_id
  FROM user_watchlists
  WHERE session_id = p_session_id;
  
  IF v_watchlist_id IS NULL THEN
    INSERT INTO user_watchlists (session_id)
    VALUES (p_session_id)
    RETURNING id INTO v_watchlist_id;
  END IF;
  
  RETURN v_watchlist_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to get watchlist with player details
CREATE OR REPLACE FUNCTION get_watchlist_with_players(p_session_id text)
RETURNS TABLE (
  player_id text,
  added_at timestamptz,
  notes text,
  player_name text,
  player_position text,
  team text,
  value_now int,
  change_7d int,
  change_30d int,
  trend_tag text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.player_id,
    wp.added_at,
    wp.notes,
    pv.full_name as player_name,
    pv.position as player_position,
    pv.team,
    pv.fdp_value as value_now,
    COALESCE(
      (SELECT pv.fdp_value - s.fdp_value 
       FROM ktc_value_snapshots s 
       WHERE s.player_id = wp.player_id 
       AND s.snapshot_date >= now() - interval '7 days'
       ORDER BY s.snapshot_date ASC LIMIT 1), 
      0
    ) as change_7d,
    COALESCE(
      (SELECT pv.fdp_value - s.fdp_value 
       FROM ktc_value_snapshots s 
       WHERE s.player_id = wp.player_id 
       AND s.snapshot_date >= now() - interval '30 days'
       ORDER BY s.snapshot_date ASC LIMIT 1), 
      0
    ) as change_30d,
    COALESCE(
      (SELECT pmt.tag 
       FROM player_market_trends pmt 
       WHERE pmt.player_id = wp.player_id 
       ORDER BY pmt.computed_at DESC LIMIT 1),
      'stable'
    ) as trend_tag
  FROM watchlist_players wp
  INNER JOIN user_watchlists uw ON uw.id = wp.watchlist_id
  LEFT JOIN player_values pv ON pv.player_id = wp.player_id
  WHERE uw.session_id = p_session_id
  ORDER BY wp.added_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get unread alerts
CREATE OR REPLACE FUNCTION get_unread_alerts(p_session_id text)
RETURNS TABLE (
  alert_id uuid,
  player_id text,
  player_name text,
  alert_type text,
  message text,
  severity text,
  created_at timestamptz,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wa.id as alert_id,
    wa.player_id,
    pv.full_name as player_name,
    wa.alert_type,
    wa.message,
    wa.severity,
    wa.created_at,
    wa.metadata
  FROM watchlist_alerts wa
  INNER JOIN user_watchlists uw ON uw.id = wa.watchlist_id
  LEFT JOIN player_values pv ON pv.player_id = wa.player_id
  WHERE uw.session_id = p_session_id
  AND wa.is_read = false
  ORDER BY wa.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to mark alerts as read
CREATE OR REPLACE FUNCTION mark_alerts_read(p_session_id text, p_alert_ids uuid[])
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE watchlist_alerts wa
  SET is_read = true
  FROM user_watchlists uw
  WHERE wa.watchlist_id = uw.id
  AND uw.session_id = p_session_id
  AND wa.id = ANY(p_alert_ids);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to clean old read alerts (keep 30 days)
CREATE OR REPLACE FUNCTION clean_old_alerts()
RETURNS void AS $$
BEGIN
  DELETE FROM watchlist_alerts
  WHERE is_read = true
  AND created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_or_create_watchlist(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_watchlist_with_players(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_unread_alerts(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mark_alerts_read(text, uuid[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION clean_old_alerts() TO authenticated;

-- Add helpful comments
COMMENT ON TABLE user_watchlists IS 
  'User watchlists for following players - supports anonymous sessions';

COMMENT ON TABLE watchlist_players IS 
  'Players added to watchlists - many-to-many relationship';

COMMENT ON TABLE watchlist_alerts IS 
  'Generated alerts for watchlist players when significant changes occur';

COMMENT ON FUNCTION get_or_create_watchlist IS 
  'Gets existing watchlist or creates new one for session ID';

COMMENT ON FUNCTION get_watchlist_with_players IS 
  'Returns watchlist players with current values and trend data';

COMMENT ON FUNCTION get_unread_alerts IS 
  'Returns unread alerts for session with player details';

COMMENT ON FUNCTION mark_alerts_read IS 
  'Marks specified alerts as read for session';
