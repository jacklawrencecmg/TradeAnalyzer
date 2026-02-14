/*
  # Create Team Strategy Cache System

  1. Purpose
    - Cache team strategy evaluations (Contend/Retool/Rebuild)
    - Store strengths, weaknesses, and recommendations
    - Avoid recalculating on every page load
    - Enable historical tracking of strategy changes

  2. New Tables
    
    `team_strategies`
    - `id` (uuid, primary key) - Unique identifier
    - `league_id` (uuid) - Foreign key to leagues table
    - `roster_id` (int) - Sleeper roster ID
    - `user_id` (uuid) - Team owner (nullable)
    - `strategy_window` (text) - Strategy: contend, retool, or rebuild
    - `confidence` (int) - Confidence score (0-100)
    - `strengths` (jsonb) - Array of strength descriptions
    - `weaknesses` (jsonb) - Array of weakness descriptions
    - `recommendations` (jsonb) - Array of actionable recommendations
    - `metrics` (jsonb) - Detailed metrics (starter_strength, future_value, etc.)
    - `calculated_at` (timestamptz) - When strategy was calculated
    - `expires_at` (timestamptz) - Cache expiration (12 hours)
    - `created_at` (timestamptz) - Record creation time

  3. Security
    - Enable RLS on table
    - Users can view their own team strategies
    - Users can view strategies for public leagues
    - System can insert/update via service role

  4. Indexes
    - Index on (league_id, roster_id) for lookups
    - Index on expires_at for cache invalidation
    - Index on calculated_at for historical queries

  5. Cache Policy
    - Strategies expire after 12 hours
    - Recalculated when:
      - Cache expired
      - League rankings updated
      - User manually requests refresh
*/

-- Create team_strategies table
CREATE TABLE IF NOT EXISTS team_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  roster_id int NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  strategy_window text NOT NULL CHECK (strategy_window IN ('contend', 'retool', 'rebuild')),
  confidence int NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '12 hours'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(league_id, roster_id)
);

-- Enable RLS
ALTER TABLE team_strategies ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view strategies for public leagues
CREATE POLICY "Anyone can view public league strategies"
  ON team_strategies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = team_strategies.league_id
      AND leagues.is_public = true
    )
  );

-- Authenticated users can view their own team strategies
CREATE POLICY "Users can view own team strategies"
  ON team_strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can view strategies for leagues they own
CREATE POLICY "Users can view strategies for their leagues"
  ON team_strategies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = team_strategies.league_id
      AND leagues.owner_user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_strategies_league_roster 
  ON team_strategies(league_id, roster_id);

CREATE INDEX IF NOT EXISTS idx_team_strategies_expires_at 
  ON team_strategies(expires_at);

CREATE INDEX IF NOT EXISTS idx_team_strategies_calculated_at 
  ON team_strategies(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_strategies_user_id 
  ON team_strategies(user_id);

-- Function to check if strategy cache is valid
CREATE OR REPLACE FUNCTION is_strategy_cache_valid(p_league_id uuid, p_roster_id int)
RETURNS boolean AS $$
DECLARE
  strategy_record record;
BEGIN
  SELECT * INTO strategy_record
  FROM team_strategies
  WHERE league_id = p_league_id
  AND roster_id = p_roster_id
  AND expires_at > now()
  LIMIT 1;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get cached strategy or null if expired
CREATE OR REPLACE FUNCTION get_cached_strategy(p_league_id uuid, p_roster_id int)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'window', strategy_window,
    'confidence', confidence,
    'strengths', strengths,
    'weaknesses', weaknesses,
    'recommendations', recommendations,
    'metrics', metrics,
    'calculated_at', calculated_at
  ) INTO result
  FROM team_strategies
  WHERE league_id = p_league_id
  AND roster_id = p_roster_id
  AND expires_at > now()
  ORDER BY calculated_at DESC
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to invalidate strategies for a league (called when rankings update)
CREATE OR REPLACE FUNCTION invalidate_league_strategies(p_league_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE team_strategies
  SET expires_at = now() - interval '1 second'
  WHERE league_id = p_league_id
  AND expires_at > now();
END;
$$ LANGUAGE plpgsql VOLATILE;

-- View for latest valid strategies
CREATE OR REPLACE VIEW latest_team_strategies AS
SELECT DISTINCT ON (ts.league_id, ts.roster_id)
  ts.*,
  l.name as league_name,
  l.public_slug
FROM team_strategies ts
JOIN leagues l ON l.id = ts.league_id
WHERE ts.expires_at > now()
ORDER BY ts.league_id, ts.roster_id, ts.calculated_at DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_strategy_cache_valid(uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_cached_strategy(uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION invalidate_league_strategies(uuid) TO authenticated, anon;
GRANT SELECT ON latest_team_strategies TO authenticated, anon;

-- Add helpful comments
COMMENT ON TABLE team_strategies IS 
  'Cached team strategy evaluations (Contend/Retool/Rebuild) with recommendations';

COMMENT ON COLUMN team_strategies.strategy_window IS 
  'Competitive window: contend (win now), retool (middle ground), rebuild (future focus)';

COMMENT ON COLUMN team_strategies.confidence IS 
  'Confidence score 0-100 indicating how certain the classification is';

COMMENT ON COLUMN team_strategies.expires_at IS 
  'Cache expiration timestamp - strategies recalculated after this time';

COMMENT ON FUNCTION invalidate_league_strategies IS 
  'Invalidates all cached strategies for a league (call when rankings update)';
