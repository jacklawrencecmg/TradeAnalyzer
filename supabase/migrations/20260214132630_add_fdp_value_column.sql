/*
  # Add FDP Value Column to KTC Snapshots

  1. Changes
    - Add `fdp_value` column to `ktc_value_snapshots` table
    - This stores FantasyDraftPros adjusted values based on format multipliers
    - Default to 0 for existing records
    - Create index for efficient queries

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add fdp_value column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ktc_value_snapshots' AND column_name = 'fdp_value'
  ) THEN
    ALTER TABLE ktc_value_snapshots ADD COLUMN fdp_value integer DEFAULT 0;
  END IF;
END $$;

-- Create index for fdp_value queries
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_fdp_value ON ktc_value_snapshots(fdp_value);

-- Create composite index for format + position queries
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_format_position ON ktc_value_snapshots(format, position);
