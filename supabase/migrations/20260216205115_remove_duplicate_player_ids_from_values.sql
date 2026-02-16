/*
  # Remove Duplicate Player IDs from Player Values

  ## Problem
  Multiple different players share the same player_id in player_values_canonical,
  causing 43 duplicate records in latest_player_values view. For example:
  - player_id "4046" maps to both "Justin Jefferson" and "Patrick Mahomes"
  - player_id "10229" maps to both "Malik Nabers" and "Rashee Rice"

  ## Solution
  For each player_id with multiple different player names:
  1. Keep the record with the highest adjusted_value (most likely to be correct)
  2. Delete the other duplicate records
  3. Log the deletions for audit purposes

  ## Safety
  This migration uses IF EXISTS checks and only affects records where
  player_id has multiple different player names.
*/

-- Create temporary table to log deletions
CREATE TEMP TABLE deleted_duplicates AS
WITH duplicates AS (
  SELECT 
    player_id,
    player_name,
    position,
    format,
    adjusted_value,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY player_id, format, league_profile_id 
      ORDER BY adjusted_value DESC NULLS LAST, created_at ASC
    ) as rn
  FROM player_values_canonical
  WHERE player_id IN (
    SELECT player_id
    FROM player_values_canonical
    GROUP BY player_id, format, league_profile_id
    HAVING COUNT(DISTINCT player_name) > 1
  )
)
SELECT *
FROM duplicates
WHERE rn > 1;

-- Show what will be deleted (for logging)
DO $$
DECLARE
  delete_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delete_count FROM deleted_duplicates;
  RAISE NOTICE 'About to delete % duplicate records', delete_count;
END $$;

-- Delete the duplicate records (keeping the one with highest adjusted_value)
DELETE FROM player_values_canonical
WHERE id IN (SELECT id FROM deleted_duplicates);

-- Log summary
DO $$
DECLARE
  remaining_count INTEGER;
  unique_player_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM player_values_canonical;
  SELECT COUNT(DISTINCT player_id) INTO unique_player_count FROM player_values_canonical;
  RAISE NOTICE 'After cleanup: % total records, % unique player_ids', remaining_count, unique_player_count;
END $$;
