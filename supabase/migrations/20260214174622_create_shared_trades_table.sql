/*
  # Create Shared Trades System

  1. Purpose
    - Enable permanent shareable links for trade analysis results
    - Support social media OG previews (Discord, Twitter, Reddit)
    - Track trade shares for analytics and organic traffic
  
  2. New Tables
    - `shared_trades`
      - `id` (uuid, primary key) - Unique identifier
      - `slug` (text, unique) - Short URL-friendly identifier (6-8 chars)
      - `format` (text) - League format used for calculation
      - `side_a` (jsonb) - Team A players/picks/FAAB
      - `side_b` (jsonb) - Team B players/picks/FAAB
      - `side_a_total` (int) - Total FDP value for Team A
      - `side_b_total` (int) - Total FDP value for Team B
      - `fairness_percentage` (int) - Trade fairness % (0-100)
      - `winner` (text) - 'side_a', 'side_b', or 'even'
      - `recommendation` (text) - Trade recommendation text
      - `hide_values` (boolean) - Privacy flag to hide player values
      - `created_at` (timestamptz) - Timestamp
      - `view_count` (int) - Track how many times viewed
      - `user_id` (uuid) - Optional user who created (for tracking)
  
  3. Security
    - Enable RLS on shared_trades
    - Anyone can view shared trades (public read)
    - Only authenticated users can create shared trades
    - Creators can update their own trades
  
  4. Indexes
    - Unique index on slug for fast lookups
    - Index on created_at for recent trades
    - Index on user_id for user's trade history
*/

-- Create shared_trades table
CREATE TABLE IF NOT EXISTS shared_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  format text NOT NULL,
  side_a jsonb NOT NULL,
  side_b jsonb NOT NULL,
  side_a_total int NOT NULL,
  side_b_total int NOT NULL,
  fairness_percentage int NOT NULL,
  winner text NOT NULL CHECK (winner IN ('side_a', 'side_b', 'even')),
  recommendation text,
  hide_values boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  view_count int DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE shared_trades ENABLE ROW LEVEL SECURITY;

-- Public read policy - anyone can view shared trades
CREATE POLICY "Anyone can view shared trades"
  ON shared_trades
  FOR SELECT
  USING (true);

-- Authenticated users can create shared trades
CREATE POLICY "Authenticated users can create shared trades"
  ON shared_trades
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own trades (for privacy toggle)
CREATE POLICY "Users can update own trades"
  ON shared_trades
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Creators can delete their own trades
CREATE POLICY "Users can delete own trades"
  ON shared_trades
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_trades_slug ON shared_trades(slug);
CREATE INDEX IF NOT EXISTS idx_shared_trades_created_at ON shared_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_trades_user_id ON shared_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_trades_format ON shared_trades(format);

-- Function to generate random slug
CREATE OR REPLACE FUNCTION generate_trade_slug()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
  slug_length int := 8;
BEGIN
  FOR i IN 1..slug_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_trade_view_count(trade_slug text)
RETURNS void AS $$
BEGIN
  UPDATE shared_trades
  SET view_count = view_count + 1
  WHERE slug = trade_slug;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION generate_trade_slug() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_trade_view_count(text) TO anon, authenticated;

-- Create view for popular trades
CREATE OR REPLACE VIEW popular_trades AS
SELECT 
  id,
  slug,
  format,
  side_a_total,
  side_b_total,
  fairness_percentage,
  winner,
  created_at,
  view_count
FROM shared_trades
WHERE created_at > now() - interval '30 days'
ORDER BY view_count DESC
LIMIT 100;

-- Grant permissions on view
GRANT SELECT ON popular_trades TO anon, authenticated;

-- Add comment for documentation
COMMENT ON TABLE shared_trades IS 
  'Permanent shareable trade analysis results with social media OG preview support';

COMMENT ON COLUMN shared_trades.slug IS 
  'Short URL-friendly identifier (6-8 chars) for shareable links';

COMMENT ON COLUMN shared_trades.hide_values IS 
  'Privacy flag - when true, player values are hidden on public page';

COMMENT ON COLUMN shared_trades.view_count IS 
  'Track pageviews for analytics and trending trades';
