/*
  # FantasyPros Top 1000 Cache Table
  
  1. New Table
    - `fantasypros_top1000_cache` - Cached rankings from FantasyPros import
  
  2. Purpose
    - Store imported FantasyPros rankings for quick CSV export
    - Enable offline access to rankings data
    - Track import history
  
  3. Security
    - Enable RLS
    - Public read access
    - Authenticated users can write
    - Service role for bulk operations
*/

CREATE TABLE IF NOT EXISTS fantasypros_top1000_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_overall integer NOT NULL,
  player_name text NOT NULL,
  team text,
  pos text NOT NULL,
  subpos text,
  value_dynasty integer NOT NULL CHECK (value_dynasty >= 0 AND value_dynasty <= 10000),
  value_redraft integer NOT NULL CHECK (value_redraft >= 0 AND value_redraft <= 10000),
  value_source text NOT NULL DEFAULT 'fantasypros_rank_curve',
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  bye_week integer CHECK (bye_week >= 1 AND bye_week <= 18),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fp_cache_rank ON fantasypros_top1000_cache(rank_overall);
CREATE INDEX IF NOT EXISTS idx_fp_cache_player ON fantasypros_top1000_cache(player_name);
CREATE INDEX IF NOT EXISTS idx_fp_cache_pos ON fantasypros_top1000_cache(pos);
CREATE INDEX IF NOT EXISTS idx_fp_cache_date ON fantasypros_top1000_cache(as_of_date DESC);

ALTER TABLE fantasypros_top1000_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read FantasyPros cache"
  ON fantasypros_top1000_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can write FantasyPros cache"
  ON fantasypros_top1000_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage FantasyPros cache"
  ON fantasypros_top1000_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE fantasypros_top1000_cache IS 'Cached Top 1000 rankings imported from FantasyPros';
