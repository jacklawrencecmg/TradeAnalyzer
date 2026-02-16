/*
  # Drop Legacy Foreign Key Constraint

  ## Problem
  The ktc_value_snapshots table has a foreign key constraint to player_values_legacy_backup
  which prevents inserting IDP players that don't exist in the legacy table.

  ## Solution
  Drop the foreign key constraint since:
  - player_values_legacy_backup appears to be a backup/legacy table
  - IDP players are new and won't exist in legacy data
  - The constraint is blocking initial IDP population

  ## Changes
  - Drop foreign key constraint ktc_value_snapshots_player_id_fkey
*/

-- Drop the foreign key constraint
ALTER TABLE ktc_value_snapshots 
DROP CONSTRAINT IF EXISTS ktc_value_snapshots_player_id_fkey;

COMMENT ON TABLE ktc_value_snapshots IS 
  'Historical snapshots of player values from various sources. No foreign key to allow new players.';
