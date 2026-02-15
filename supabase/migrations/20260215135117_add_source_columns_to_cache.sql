/*
  # Add Source Tracking Columns

  1. Changes
    - Add dynasty_source column to track dynasty value source
    - Add redraft_source column to track redraft value source
    - Keep existing value_source for backward compatibility
  
  2. Purpose
    - Track where dynasty values come from (e.g., "fantasypros_dynasty_rank_curve")
    - Track where redraft values come from (e.g., "fantasypros_redraft_rank_curve" or "fallback")
    - Enable debugging and quality control
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fantasypros_top1000_cache' AND column_name = 'dynasty_source'
  ) THEN
    ALTER TABLE fantasypros_top1000_cache ADD COLUMN dynasty_source text DEFAULT 'fantasypros_dynasty_rank_curve';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fantasypros_top1000_cache' AND column_name = 'redraft_source'
  ) THEN
    ALTER TABLE fantasypros_top1000_cache ADD COLUMN redraft_source text DEFAULT 'fallback';
  END IF;
END $$;

COMMENT ON COLUMN fantasypros_top1000_cache.dynasty_source IS 'Source of dynasty value (e.g., fantasypros_dynasty_rank_curve)';
COMMENT ON COLUMN fantasypros_top1000_cache.redraft_source IS 'Source of redraft value (e.g., fantasypros_redraft_rank_curve or fallback)';
