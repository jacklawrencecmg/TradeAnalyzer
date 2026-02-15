/*
  # Player Advice Engine

  Creates automated player recommendations system.
*/

-- Create player_advice table
CREATE TABLE IF NOT EXISTS player_advice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  league_profile_id uuid REFERENCES league_profiles(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('dynasty', 'redraft')),
  advice_type text NOT NULL CHECK (advice_type IN ('buy_low', 'sell_high', 'breakout', 'waiver', 'stash', 'avoid')),
  confidence integer NOT NULL CHECK (confidence >= 1 AND confidence <= 100),
  score integer NOT NULL,
  reason text NOT NULL,
  supporting_factors jsonb NOT NULL DEFAULT '[]',
  model_value integer,
  market_value integer,
  value_delta integer,
  recent_change_7d integer,
  recent_change_24h integer,
  usage_trend numeric,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, league_profile_id, format, advice_type)
);

CREATE INDEX IF NOT EXISTS idx_advice_profile_format ON player_advice(league_profile_id, format, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advice_type ON player_advice(advice_type, confidence DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advice_player ON player_advice(player_id, format, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advice_expires ON player_advice(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advice_confidence ON player_advice(confidence DESC, created_at DESC);

ALTER TABLE player_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View advice" ON player_advice FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage advice" ON player_advice FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_advice()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM player_advice
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Summary function
CREATE OR REPLACE FUNCTION get_advice_summary(
  p_league_profile_id uuid DEFAULT NULL,
  p_format text DEFAULT 'dynasty'
)
RETURNS TABLE (
  advice_type text,
  player_count bigint,
  avg_confidence numeric,
  top_player_name text,
  top_player_confidence integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH advice_stats AS (
    SELECT
      pa.advice_type,
      COUNT(*) as player_count,
      AVG(pa.confidence) as avg_confidence
    FROM player_advice pa
    WHERE (p_league_profile_id IS NULL OR pa.league_profile_id = p_league_profile_id)
      AND pa.format = p_format
      AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
    GROUP BY pa.advice_type
  ),
  top_players AS (
    SELECT DISTINCT ON (pa.advice_type)
      pa.advice_type,
      np.full_name,
      pa.confidence
    FROM player_advice pa
    JOIN nfl_players np ON pa.player_id = np.id
    WHERE (p_league_profile_id IS NULL OR pa.league_profile_id = p_league_profile_id)
      AND pa.format = p_format
      AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
    ORDER BY pa.advice_type, pa.confidence DESC
  )
  SELECT
    stats.advice_type,
    stats.player_count,
    ROUND(stats.avg_confidence, 0),
    tp.full_name,
    tp.confidence
  FROM advice_stats stats
  LEFT JOIN top_players tp ON stats.advice_type = tp.advice_type
  ORDER BY stats.player_count DESC;
END;
$$;

-- Active advice view
CREATE OR REPLACE VIEW active_player_advice AS
SELECT
  pa.id,
  pa.player_id,
  np.full_name as player_name,
  np.player_position,
  pa.league_profile_id,
  pa.format,
  pa.advice_type,
  pa.confidence,
  pa.score,
  pa.reason,
  pa.supporting_factors,
  pa.model_value,
  pa.market_value,
  pa.value_delta,
  pa.recent_change_7d,
  pa.recent_change_24h,
  pa.usage_trend,
  pa.expires_at,
  pa.created_at
FROM player_advice pa
JOIN nfl_players np ON pa.player_id = np.id
WHERE pa.expires_at IS NULL OR pa.expires_at > NOW()
ORDER BY pa.confidence DESC, pa.created_at DESC;

-- Top opportunities function
CREATE OR REPLACE FUNCTION get_top_opportunities(
  p_format text DEFAULT 'dynasty',
  p_league_profile_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  advice_type text,
  player_id uuid,
  player_name text,
  player_position text,
  confidence integer,
  reason text,
  value_delta integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pa.advice_type)
    pa.advice_type,
    pa.player_id,
    np.full_name,
    np.player_position,
    pa.confidence,
    pa.reason,
    pa.value_delta
  FROM player_advice pa
  JOIN nfl_players np ON pa.player_id = np.id
  WHERE pa.format = p_format
    AND (p_league_profile_id IS NULL OR pa.league_profile_id = p_league_profile_id)
    AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
  ORDER BY pa.advice_type, pa.confidence DESC, pa.score DESC;
END;
$$;
