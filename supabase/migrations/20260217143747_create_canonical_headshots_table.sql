/*
  # Create Canonical Player Headshots Table

  1. New Tables
    - `player_headshots`
      - `player_id` (uuid, pk, fk to player_identity)
      - `headshot_url` (text, not null) - Canonical headshot URL
      - `source` (text, not null) - sleeper|espn|gsis|manual|fallback
      - `confidence` (int, not null, default 80) - Confidence score 0-100
      - `is_override` (boolean, not null, default false) - Manual override flag
      - `verified_at` (timestamptz, nullable) - Last verification timestamp
      - `updated_at` (timestamptz, default now())
      - `created_at` (timestamptz, default now())

  2. Purpose
    - Single source of truth for all player headshots
    - Manual overrides always win (is_override=true)
    - Tracks source and confidence for debugging
    - Prevents duplicate/incorrect headshots

  3. Security
    - Enable RLS
    - Public read access (headshots are public)
    - Admin-only write access

  4. Indexes
    - Primary key on player_id
    - Index on is_override for fast filtering
    - Index on source for analytics
*/

-- Create the table
CREATE TABLE IF NOT EXISTS player_headshots (
  player_id uuid PRIMARY KEY REFERENCES player_identity(player_id) ON DELETE CASCADE,
  headshot_url text NOT NULL,
  source text NOT NULL CHECK (source IN ('sleeper', 'espn', 'gsis', 'manual', 'fallback')),
  confidence int NOT NULL DEFAULT 80 CHECK (confidence >= 0 AND confidence <= 100),
  is_override boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE player_headshots ENABLE ROW LEVEL SECURITY;

-- Public read access (headshots are public data)
CREATE POLICY "Anyone can read player headshots"
  ON player_headshots
  FOR SELECT
  USING (true);

-- Admin-only write access
CREATE POLICY "Only admins can insert headshots"
  ON player_headshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_subscriptions
      WHERE user_id = auth.uid()
      AND tier = 'admin'
    )
  );

CREATE POLICY "Only admins can update headshots"
  ON player_headshots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions
      WHERE user_id = auth.uid()
      AND tier = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_subscriptions
      WHERE user_id = auth.uid()
      AND tier = 'admin'
    )
  );

CREATE POLICY "Only admins can delete headshots"
  ON player_headshots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions
      WHERE user_id = auth.uid()
      AND tier = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_headshots_is_override 
  ON player_headshots(is_override) WHERE is_override = true;

CREATE INDEX IF NOT EXISTS idx_player_headshots_source 
  ON player_headshots(source);

CREATE INDEX IF NOT EXISTS idx_player_headshots_confidence 
  ON player_headshots(confidence) WHERE confidence < 50;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_player_headshot_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_player_headshot_timestamp_trigger ON player_headshots;
CREATE TRIGGER update_player_headshot_timestamp_trigger
  BEFORE UPDATE ON player_headshots
  FOR EACH ROW
  EXECUTE FUNCTION update_player_headshot_timestamp();

-- Helper function to get canonical headshot (with override priority)
CREATE OR REPLACE FUNCTION get_canonical_headshot(p_player_id uuid)
RETURNS text AS $$
DECLARE
  v_headshot_url text;
BEGIN
  -- First try: Manual override
  SELECT headshot_url INTO v_headshot_url
  FROM player_headshots
  WHERE player_id = p_player_id
    AND is_override = true
  LIMIT 1;
  
  IF v_headshot_url IS NOT NULL THEN
    RETURN v_headshot_url;
  END IF;
  
  -- Second try: Highest confidence headshot
  SELECT headshot_url INTO v_headshot_url
  FROM player_headshots
  WHERE player_id = p_player_id
  ORDER BY confidence DESC, updated_at DESC
  LIMIT 1;
  
  IF v_headshot_url IS NOT NULL THEN
    RETURN v_headshot_url;
  END IF;
  
  -- Third try: player_identity table
  SELECT headshot_url INTO v_headshot_url
  FROM player_identity
  WHERE player_id = p_player_id;
  
  IF v_headshot_url IS NOT NULL THEN
    RETURN v_headshot_url;
  END IF;
  
  -- Final fallback: default silhouette
  RETURN 'https://sleepercdn.com/images/v2/icons/player_default.webp';
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a view that shows potential duplicate headshots
CREATE OR REPLACE VIEW player_headshot_duplicates AS
SELECT 
  headshot_url,
  COUNT(*) as player_count,
  array_agg(player_id) as player_ids,
  array_agg(source) as sources,
  MIN(confidence) as min_confidence
FROM player_headshots
WHERE source != 'fallback'
GROUP BY headshot_url
HAVING COUNT(*) > 1;

-- Grant permissions
GRANT SELECT ON player_headshot_duplicates TO anon, authenticated;
