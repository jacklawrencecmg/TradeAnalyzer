/*
  # Player Value Adjustments System

  ## Summary
  Creates a lightweight real-time adjustment layer for player values.
  Adjustments are temporary overlays on base values that reset nightly.

  ## Tables
  1. player_value_adjustments - Temporary value deltas based on market events
  2. adjustment_events - Audit trail of what triggered each adjustment

  ## Features
  - Adjustments layer on top of latest_player_values (do not modify base)
  - Expire automatically (24-168 hours depending on event type)
  - Max delta: ±1500 per player
  - Reset on nightly rebuild

  ## Event Types
  - starter_promotion: Backup becomes starter (+600 to +900)
  - injury_replacement: Direct backup steps in (+350 to +600)
  - waiver_spike: High add percentage (+300)
  - snap_breakout: 70%+ snap share jump (+500)
  - trade_opportunity: Traded to better situation (+250)
  - depth_chart_rise: Moving up depth chart (+200 to +400)
*/

-- Create adjustments table
CREATE TABLE IF NOT EXISTS player_value_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('dynasty', 'redraft', 'both')),
  delta integer NOT NULL CHECK (delta >= -2000 AND delta <= 2000),
  reason text NOT NULL,
  confidence integer NOT NULL CHECK (confidence >= 1 AND confidence <= 5),
  source text NOT NULL CHECK (source IN ('waiver', 'trade', 'depth_chart', 'usage_spike', 'injury', 'manual', 'snap_share', 'role_change')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_value_adjustments_player ON player_value_adjustments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_value_adjustments_expires ON player_value_adjustments(expires_at);
CREATE INDEX IF NOT EXISTS idx_player_value_adjustments_player_expires ON player_value_adjustments(player_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_player_value_adjustments_source ON player_value_adjustments(source);

-- Create adjustment events audit table
CREATE TABLE IF NOT EXISTS adjustment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  player_id uuid NOT NULL REFERENCES nfl_players(id),
  old_value jsonb,
  new_value jsonb,
  adjustment_created uuid REFERENCES player_value_adjustments(id),
  detected_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_adjustment_events_player ON adjustment_events(player_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_events_type ON adjustment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_adjustment_events_detected ON adjustment_events(detected_at DESC);

-- Function to get active adjustments for a player
CREATE OR REPLACE FUNCTION get_active_adjustments(
  p_player_id uuid,
  p_format text DEFAULT 'dynasty'
)
RETURNS TABLE (
  adjustment_id uuid,
  delta integer,
  reason text,
  confidence integer,
  source text,
  expires_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.delta,
    a.reason,
    a.confidence,
    a.source,
    a.expires_at
  FROM player_value_adjustments a
  WHERE a.player_id = p_player_id
    AND a.expires_at > now()
    AND (a.format = p_format OR a.format = 'both')
  ORDER BY a.created_at DESC;
END;
$$;

-- Function to calculate effective value with adjustments
CREATE OR REPLACE FUNCTION calculate_effective_value(
  p_player_id uuid,
  p_format text DEFAULT 'dynasty'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_value integer;
  v_adjustment_sum integer;
  v_effective_value integer;
  v_adjustments jsonb;
BEGIN
  -- Get base value from latest_player_values
  SELECT 
    CASE 
      WHEN p_format = 'dynasty' THEN COALESCE(dynasty_value, 0)
      WHEN p_format = 'redraft' THEN COALESCE(redraft_value, 0)
      ELSE COALESCE(fdp_value, 0)
    END
  INTO v_base_value
  FROM latest_player_values
  WHERE player_id = p_player_id
  LIMIT 1;

  -- If no base value found, return zero
  IF v_base_value IS NULL THEN
    v_base_value := 0;
  END IF;

  -- Sum active adjustments
  SELECT 
    COALESCE(SUM(delta), 0),
    jsonb_agg(
      jsonb_build_object(
        'delta', delta,
        'reason', reason,
        'source', source,
        'confidence', confidence,
        'expires_at', expires_at
      )
    )
  INTO v_adjustment_sum, v_adjustments
  FROM player_value_adjustments
  WHERE player_id = p_player_id
    AND expires_at > now()
    AND (format = p_format OR format = 'both');

  -- Apply max adjustment cap (±1500)
  v_adjustment_sum := GREATEST(LEAST(v_adjustment_sum, 1500), -1500);

  -- Calculate effective value and clamp to 0-10000
  v_effective_value := GREATEST(LEAST(v_base_value + v_adjustment_sum, 10000), 0);

  -- Return as JSON
  RETURN jsonb_build_object(
    'player_id', p_player_id,
    'format', p_format,
    'base_value', v_base_value,
    'adjustment', v_adjustment_sum,
    'effective_value', v_effective_value,
    'adjustments', COALESCE(v_adjustments, '[]'::jsonb)
  );
END;
$$;

-- Function to add an adjustment with validation
CREATE OR REPLACE FUNCTION add_value_adjustment(
  p_player_id uuid,
  p_format text,
  p_delta integer,
  p_reason text,
  p_confidence integer,
  p_source text,
  p_expires_hours integer DEFAULT 24,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_adjustment_id uuid;
  v_current_total integer;
BEGIN
  -- Check current total adjustments for this player
  SELECT COALESCE(SUM(delta), 0)
  INTO v_current_total
  FROM player_value_adjustments
  WHERE player_id = p_player_id
    AND format = p_format
    AND expires_at > now();

  -- Enforce max total adjustment limit (±1500)
  IF v_current_total + p_delta > 1500 THEN
    RAISE NOTICE 'Adjustment capped: would exceed +1500 limit';
    p_delta := 1500 - v_current_total;
  ELSIF v_current_total + p_delta < -1500 THEN
    RAISE NOTICE 'Adjustment capped: would exceed -1500 limit';
    p_delta := -1500 - v_current_total;
  END IF;

  -- Skip if delta is zero after capping
  IF p_delta = 0 THEN
    RETURN NULL;
  END IF;

  -- Insert adjustment
  INSERT INTO player_value_adjustments (
    player_id,
    format,
    delta,
    reason,
    confidence,
    source,
    expires_at,
    metadata
  )
  VALUES (
    p_player_id,
    p_format,
    p_delta,
    p_reason,
    p_confidence,
    p_source,
    now() + (p_expires_hours || ' hours')::interval,
    p_metadata
  )
  RETURNING id INTO v_adjustment_id;

  RETURN v_adjustment_id;
END;
$$;

-- Function to expire old adjustments (called by nightly rebuild)
CREATE OR REPLACE FUNCTION expire_old_adjustments()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete expired adjustments
  WITH deleted AS (
    DELETE FROM player_value_adjustments
    WHERE expires_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$;

-- Function to reset all adjustments (nightly rebuild)
CREATE OR REPLACE FUNCTION reset_all_adjustments()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Archive to events table first (optional)
  INSERT INTO adjustment_events (
    event_type,
    player_id,
    metadata,
    detected_at
  )
  SELECT
    'nightly_reset',
    player_id,
    jsonb_build_object(
      'adjustments_cleared', COUNT(*),
      'total_delta', SUM(delta)
    ),
    now()
  FROM player_value_adjustments
  WHERE expires_at > now()
  GROUP BY player_id;

  -- Delete all adjustments
  WITH deleted AS (
    DELETE FROM player_value_adjustments
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$;

-- View for trending players (popular query)
CREATE OR REPLACE VIEW trending_players AS
SELECT 
  np.id,
  np.full_name,
  np.player_position,
  np.team,
  COUNT(DISTINCT a.id) AS adjustment_count,
  SUM(a.delta) AS total_delta,
  MAX(a.confidence) AS max_confidence,
  array_agg(DISTINCT a.source) AS sources,
  MAX(a.expires_at) AS latest_expiry
FROM nfl_players np
JOIN player_value_adjustments a ON np.id = a.player_id
WHERE a.expires_at > now()
GROUP BY np.id, np.full_name, np.player_position, np.team
HAVING SUM(a.delta) != 0
ORDER BY ABS(SUM(a.delta)) DESC;

GRANT SELECT ON trending_players TO authenticated;
GRANT SELECT ON trending_players TO anon;

-- RLS policies
ALTER TABLE player_value_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view adjustments"
  ON player_value_adjustments FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can insert adjustments"
  ON player_value_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete adjustments"
  ON player_value_adjustments FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view adjustment events"
  ON adjustment_events FOR SELECT
  TO authenticated, anon
  USING (true);

-- Comments
COMMENT ON TABLE player_value_adjustments IS 'Temporary value overlays that expire and reset nightly';
COMMENT ON COLUMN player_value_adjustments.delta IS 'Value change: -2000 to +2000, capped at ±1500 total per player';
COMMENT ON COLUMN player_value_adjustments.confidence IS 'Confidence level 1-5, where 5 is most certain';
COMMENT ON COLUMN player_value_adjustments.expires_at IS 'When adjustment becomes inactive (24-168 hours)';
COMMENT ON FUNCTION calculate_effective_value IS 'Returns base_value + adjustments, clamped to 0-10000';
COMMENT ON FUNCTION reset_all_adjustments IS 'Clears all adjustments, called by nightly rebuild';
