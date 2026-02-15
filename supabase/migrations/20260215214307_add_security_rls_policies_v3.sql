/*
  # Security & RLS Policies v3

  Add RLS policies and security tables.
  Fixed UUID type casting.
*/

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON admin_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON admin_audit_log(actor, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_failures
  ON admin_audit_log(success, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit log"
  ON admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- RATE LIMITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset
  ON rate_limits(reset_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can manage rate limits"
  ON rate_limits FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RLS POLICIES FOR USER TABLES
-- ============================================

-- LEAGUES (uses owner_user_id UUID)
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own leagues" ON leagues;
DROP POLICY IF EXISTS "Users can insert own leagues" ON leagues;
DROP POLICY IF EXISTS "Users can update own leagues" ON leagues;
DROP POLICY IF EXISTS "Users can delete own leagues" ON leagues;

CREATE POLICY "Users can read own leagues"
  ON leagues FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own leagues"
  ON leagues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own leagues"
  ON leagues FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own leagues"
  ON leagues FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- PUBLIC READ-ONLY FOR ADMIN TABLES
-- VALUE_SNAPSHOTS
ALTER TABLE value_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read snapshots" ON value_snapshots;
DROP POLICY IF EXISTS "Service role can manage snapshots" ON value_snapshots;

CREATE POLICY "Public can read snapshots"
  ON value_snapshots FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage snapshots"
  ON value_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- NFL_PLAYERS
ALTER TABLE nfl_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read players" ON nfl_players;
DROP POLICY IF EXISTS "Service role can manage players" ON nfl_players;

CREATE POLICY "Public can read players"
  ON nfl_players FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage players"
  ON nfl_players FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- PLAYER_VALUES
ALTER TABLE player_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read values" ON player_values;
DROP POLICY IF EXISTS "Service role can manage values" ON player_values;

CREATE POLICY "Public can read values"
  ON player_values FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage values"
  ON player_values FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- PLAYER_VALUES_VERSIONED
ALTER TABLE player_values_versioned ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read versioned values" ON player_values_versioned;
DROP POLICY IF EXISTS "Service role can manage versioned values" ON player_values_versioned;

CREATE POLICY "Public can read versioned values"
  ON player_values_versioned FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage versioned values"
  ON player_values_versioned FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE reset_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_audit_log WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
