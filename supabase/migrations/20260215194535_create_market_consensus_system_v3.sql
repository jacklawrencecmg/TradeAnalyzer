/*
  # Market Consensus Anchor System

  1. New Tables
    - `market_player_consensus`
      - Stores external market rankings (KTC, FantasyPros, etc.)
      - Used for gentle anchoring to prevent unrealistic values
      - Does NOT override model, just provides stability

  2. Purpose
    - Prevent model outliers
    - Build user trust with market transparency
    - Stabilize values while preserving model intelligence
    - Track market vs model confidence

  3. Security
    - Enable RLS (admin writes, public reads)
    - Only authenticated users can view
    - Only service role can write

  4. Notes
    - Stores RANK not VALUE (value computed from rank)
    - One snapshot per format (dynasty/redraft)
    - Updated via sync job (separate from rebuild)
    - Used in pipeline step 5 (after scarcity, before ranking)
*/

-- Create market_player_consensus table
CREATE TABLE IF NOT EXISTS market_player_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('dynasty', 'redraft')),
  market_rank integer NOT NULL CHECK (market_rank > 0),
  market_tier integer,
  market_source text NOT NULL,
  notes text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, format, market_source)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_market_consensus_player_format
  ON market_player_consensus(player_id, format);

CREATE INDEX IF NOT EXISTS idx_market_consensus_source_captured
  ON market_player_consensus(market_source, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_consensus_format_rank
  ON market_player_consensus(format, market_rank);

-- Enable RLS
ALTER TABLE market_player_consensus ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read, only service role can write
CREATE POLICY "Anyone can view market consensus"
  ON market_player_consensus
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert market consensus"
  ON market_player_consensus
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update market consensus"
  ON market_player_consensus
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete market consensus"
  ON market_player_consensus
  FOR DELETE
  TO service_role
  USING (true);

-- Add comments
COMMENT ON TABLE market_player_consensus IS 'External market rankings for anchoring model values';
COMMENT ON COLUMN market_player_consensus.player_id IS 'Player from nfl_players registry';
COMMENT ON COLUMN market_player_consensus.format IS 'Dynasty or redraft ranking';
COMMENT ON COLUMN market_player_consensus.market_rank IS 'Overall rank from external source (1 = best)';
COMMENT ON COLUMN market_player_consensus.market_tier IS 'Optional tier classification from source';
COMMENT ON COLUMN market_player_consensus.market_source IS 'Source of ranking (e.g., "ktc", "fantasypros", "consensus")';
COMMENT ON COLUMN market_player_consensus.captured_at IS 'When this ranking was captured';

-- Create view for latest market rankings
CREATE OR REPLACE VIEW latest_market_consensus AS
SELECT DISTINCT ON (player_id, format)
  mpc.*,
  np.full_name,
  np.player_position as position,
  np.team
FROM market_player_consensus mpc
JOIN nfl_players np ON mpc.player_id = np.id
ORDER BY mpc.player_id, mpc.format, mpc.captured_at DESC;

COMMENT ON VIEW latest_market_consensus IS 'Latest market ranking per player per format';

-- Create function to get market rank for player
CREATE OR REPLACE FUNCTION get_market_rank(
  p_player_id uuid,
  p_format text,
  p_source text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rank integer;
BEGIN
  SELECT market_rank INTO v_rank
  FROM market_player_consensus
  WHERE player_id = p_player_id
    AND format = p_format
    AND (p_source IS NULL OR market_source = p_source)
  ORDER BY captured_at DESC
  LIMIT 1;
  
  RETURN v_rank;
END;
$$;

COMMENT ON FUNCTION get_market_rank IS 'Get latest market rank for a player';

-- Create function to compute market value from rank
CREATE OR REPLACE FUNCTION market_rank_to_value(p_rank integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_value numeric;
BEGIN
  -- Formula: 10000 * exp(-0.0045 * (rank - 1))
  -- This creates exponential decay from rank 1 (10000) to rank 1000+ (near 0)
  v_value := 10000 * exp(-0.0045 * (p_rank - 1));
  
  -- Clamp to 0..10000
  v_value := GREATEST(0, LEAST(10000, v_value));
  
  RETURN ROUND(v_value)::integer;
END;
$$;

COMMENT ON FUNCTION market_rank_to_value IS 'Convert market rank to estimated value (exponential decay)';

-- Create helper function to calculate confidence score
CREATE OR REPLACE FUNCTION calculate_confidence_score(
  p_model_rank integer,
  p_market_rank integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rank_diff integer;
  v_confidence numeric;
BEGIN
  v_rank_diff := ABS(p_model_rank - p_market_rank);
  
  -- confidence = 1 - (rank_difference / 400)
  -- Perfect match = 1.0, 400 ranks apart = 0.0
  v_confidence := 1.0 - (v_rank_diff::numeric / 400.0);
  
  -- Clamp to 0..1
  v_confidence := GREATEST(0.0, LEAST(1.0, v_confidence));
  
  RETURN ROUND(v_confidence, 3);
END;
$$;

COMMENT ON FUNCTION calculate_confidence_score IS 'Calculate confidence score based on model vs market rank difference';

-- Create table for market anchor audit log
CREATE TABLE IF NOT EXISTS market_anchor_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  league_profile_id uuid NOT NULL REFERENCES league_profiles(id) ON DELETE CASCADE,
  format text NOT NULL,
  model_value integer NOT NULL,
  market_value integer NOT NULL,
  anchored_value integer NOT NULL,
  anchor_strength numeric NOT NULL,
  rank_difference integer NOT NULL,
  confidence_score numeric NOT NULL,
  is_outlier boolean NOT NULL DEFAULT false,
  is_breakout_protected boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_market_anchor_audit_player
  ON market_anchor_audit(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_anchor_audit_profile
  ON market_anchor_audit(league_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_anchor_audit_outliers
  ON market_anchor_audit(is_outlier, created_at DESC)
  WHERE is_outlier = true;

-- Enable RLS
ALTER TABLE market_anchor_audit ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role can manage market anchor audit"
  ON market_anchor_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view audit"
  ON market_anchor_audit
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE market_anchor_audit IS 'Audit log of market anchoring adjustments';

-- Add market anchor fields to value_snapshots (check each individually)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'value_snapshots' AND column_name = 'market_rank') THEN
    ALTER TABLE value_snapshots ADD COLUMN market_rank integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'value_snapshots' AND column_name = 'pre_anchor_value') THEN
    ALTER TABLE value_snapshots ADD COLUMN pre_anchor_value integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'value_snapshots' AND column_name = 'anchor_adjustment') THEN
    ALTER TABLE value_snapshots ADD COLUMN anchor_adjustment integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'value_snapshots' AND column_name = 'confidence_score') THEN
    ALTER TABLE value_snapshots ADD COLUMN confidence_score numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'value_snapshots' AND column_name = 'is_market_outlier') THEN
    ALTER TABLE value_snapshots ADD COLUMN is_market_outlier boolean DEFAULT false;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN value_snapshots.market_rank IS 'Market consensus rank at time of capture';
COMMENT ON COLUMN value_snapshots.pre_anchor_value IS 'Model value before market anchoring';
COMMENT ON COLUMN value_snapshots.anchor_adjustment IS 'Delta applied by market anchor';
COMMENT ON COLUMN value_snapshots.confidence_score IS 'Confidence in this value (0-1, based on model vs market agreement)';
COMMENT ON COLUMN value_snapshots.is_market_outlier IS 'True if model rank differs from market by 120+ spots';

-- Create index for market outliers
CREATE INDEX IF NOT EXISTS idx_value_snapshots_outliers
  ON value_snapshots(league_profile_id, format)
  WHERE is_market_outlier = true;

-- Create view for model vs market comparison
CREATE OR REPLACE VIEW model_vs_market_view AS
SELECT
  vs.player_id,
  np.full_name,
  np.player_position,
  vs.league_profile_id,
  lp.name as profile_name,
  vs.format,
  vs.position_rank,
  vs.market_rank,
  vs.market_rank - vs.position_rank as rank_difference,
  vs.pre_anchor_value as model_value,
  vs.market_value,
  vs.market_value as final_value,
  vs.anchor_adjustment,
  vs.confidence_score,
  vs.is_market_outlier,
  CASE
    WHEN vs.confidence_score >= 0.9 THEN 'Very High'
    WHEN vs.confidence_score >= 0.75 THEN 'High'
    WHEN vs.confidence_score >= 0.5 THEN 'Medium'
    WHEN vs.confidence_score >= 0.25 THEN 'Low'
    ELSE 'Very Low'
  END as confidence_label,
  vs.captured_at
FROM value_snapshots vs
JOIN nfl_players np ON vs.player_id = np.id
JOIN league_profiles lp ON vs.league_profile_id = lp.id
WHERE vs.market_rank IS NOT NULL
ORDER BY vs.captured_at DESC, ABS(vs.market_rank - vs.position_rank) DESC;

COMMENT ON VIEW model_vs_market_view IS 'Compare model rankings vs market consensus';

-- Create function to get anchor strength by tier
CREATE OR REPLACE FUNCTION get_anchor_strength_by_tier(p_rank integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Tier 1 (1-24): 0.15 (elite, barely move)
  IF p_rank <= 24 THEN
    RETURN 0.15;
  END IF;
  
  -- Tier 2 (25-60): 0.20 (solid, slight stabilization)
  IF p_rank <= 60 THEN
    RETURN 0.20;
  END IF;
  
  -- Tier 3 (61-120): 0.25 (mid, moderate stabilization)
  IF p_rank <= 120 THEN
    RETURN 0.25;
  END IF;
  
  -- Tier 4+ (120+): 0.35 (deep, track market more)
  RETURN 0.35;
END;
$$;

COMMENT ON FUNCTION get_anchor_strength_by_tier IS 'Get anchor strength based on player tier (rank)';
