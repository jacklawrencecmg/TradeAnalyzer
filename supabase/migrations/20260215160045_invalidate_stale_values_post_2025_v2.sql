/*
  # Invalidate Stale Pre-2025 Values

  ## Summary
  Hard invalidation of all player values captured before 2025-02-01.
  These values reflect preseason data and do not account for 2025 season performance.

  ## Changes
  1. Add value_epoch column to value_snapshots
  2. Create archive table for stale values
  3. Archive and delete stale values
  4. Clear top_1000_current entries using old data
  5. Create runtime guard functions
  6. Update latest_player_values view

  ## Notes
  - Preserves historical data in archive for analysis
  - Forces rebuild of all current values
  - Prevents regression to preseason priors
*/

-- Add value_epoch column to value_snapshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_snapshots' AND column_name = 'value_epoch'
  ) THEN
    ALTER TABLE value_snapshots ADD COLUMN value_epoch text DEFAULT 'PRE_2025';
  END IF;
END $$;

-- Create archive table for historical values
CREATE TABLE IF NOT EXISTS value_snapshots_archive (
  id uuid PRIMARY KEY,
  player_id uuid,
  source text,
  format text,
  position text,
  position_rank integer,
  market_value integer,
  fdp_value integer,
  dynasty_value integer,
  redraft_value integer,
  value_epoch text,
  notes text,
  captured_at timestamptz,
  created_at timestamptz,
  archived_at timestamptz DEFAULT now(),
  archive_reason text
);

CREATE INDEX IF NOT EXISTS idx_value_snapshots_archive_player ON value_snapshots_archive(player_id);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_archive_captured ON value_snapshots_archive(captured_at);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_archive_reason ON value_snapshots_archive(archive_reason);

-- Archive all stale values (before 2025-02-01)
INSERT INTO value_snapshots_archive (
  id, player_id, source, format, position, position_rank,
  market_value, fdp_value, dynasty_value, redraft_value,
  value_epoch, notes, captured_at, created_at,
  archived_at, archive_reason
)
SELECT
  id, player_id, source, format, position, position_rank,
  market_value, fdp_value, dynasty_value, redraft_value,
  COALESCE(value_epoch, 'PRE_2025'), notes, captured_at, created_at,
  now(), 'SEASON_CONTEXT_INVALIDATION_POST_2025'
FROM value_snapshots
WHERE captured_at < '2025-02-01'::timestamptz
ON CONFLICT (id) DO NOTHING;

-- Delete stale values from active table
DELETE FROM value_snapshots
WHERE captured_at < '2025-02-01'::timestamptz;

-- Clear top_1000_current entries that may contain stale data
DELETE FROM top_1000_current
WHERE as_of_date < '2025-02-01'::date;

-- Create function to check if value is stale
CREATE OR REPLACE FUNCTION is_stale_value(captured_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN captured_at < '2025-02-01'::timestamptz;
END;
$$;

-- Create function to validate value epoch
CREATE OR REPLACE FUNCTION is_valid_epoch(epoch text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Only POST_2025 and later epochs are valid
  RETURN epoch IN ('POST_2025', 'POST_2026', 'POST_2027', 'POST_2028', 'POST_2029', 'POST_2030');
END;
$$;

-- Add constraint to prevent inserting stale values (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'value_snapshots_no_stale_values'
  ) THEN
    ALTER TABLE value_snapshots
    ADD CONSTRAINT value_snapshots_no_stale_values
    CHECK (captured_at >= '2025-02-01'::timestamptz);
  END IF;
END $$;

-- Create index on value_epoch for fast filtering
CREATE INDEX IF NOT EXISTS idx_value_snapshots_epoch ON value_snapshots(value_epoch);

-- Update latest_player_values view to include epoch validation
DROP VIEW IF EXISTS latest_player_values CASCADE;

CREATE OR REPLACE VIEW latest_player_values AS
SELECT DISTINCT ON (vs.player_id, vs.format)
  vs.id AS snapshot_id,
  vs.player_id,
  vs.source,
  vs.format,
  vs.position,
  vs.position_rank,
  vs.market_value,
  vs.fdp_value,
  vs.dynasty_value,
  vs.redraft_value,
  vs.value_epoch,
  vs.notes,
  vs.captured_at,
  np.full_name,
  np.search_name,
  np.player_position,
  np.team,
  np.status,
  np.birthdate,
  np.years_exp,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, np.birthdate))::integer AS age,
  false AS is_stale  -- All values in this view are guaranteed fresh (constraint enforced)
FROM value_snapshots vs
JOIN nfl_players np ON vs.player_id = np.id
ORDER BY vs.player_id, vs.format, vs.captured_at DESC;

GRANT SELECT ON latest_player_values TO authenticated;
GRANT SELECT ON latest_player_values TO anon;

-- Add metadata to sync_status about invalidation
INSERT INTO sync_status (
  sync_type,
  status,
  started_at,
  completed_at,
  duration_ms,
  records_processed,
  metadata
)
SELECT
  'invalidate_stale_values',
  'success',
  now(),
  now(),
  0,
  COUNT(*),
  jsonb_build_object(
    'value_epoch', 'POST_2025',
    'invalidate_before', '2025-02-01',
    'archived_count', COUNT(*)
  )
FROM value_snapshots_archive
WHERE archive_reason = 'SEASON_CONTEXT_INVALIDATION_POST_2025';

-- Add helpful comments
COMMENT ON COLUMN value_snapshots.value_epoch IS 'Value generation epoch - POST_2025 reflects 2025 season performance';
COMMENT ON FUNCTION is_stale_value IS 'Returns true if captured_at is before 2025-02-01 cutoff';
COMMENT ON TABLE value_snapshots_archive IS 'Historical archive of invalidated player values';
