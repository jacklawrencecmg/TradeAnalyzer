/*
  # Rename ktc_value to base_value

  ## Changes
  1. Rename column `ktc_value` to `base_value` in player_values table
  2. Update comments to reflect Fantasy Draft Pros branding
  
  ## Rationale
  - Rebranded from Keep Trade Cut (KTC) to Fantasy Draft Pros
  - `base_value` is more descriptive and brand-agnostic
  - Maintains backward compatibility with existing data
  
  ## Notes
  - No data loss - column is renamed in place
  - Indexes and constraints are automatically updated
  - Application code must be updated to reference new column name
*/

-- Rename the column from ktc_value to base_value
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_values' 
    AND column_name = 'ktc_value'
  ) THEN
    ALTER TABLE player_values RENAME COLUMN ktc_value TO base_value;
  END IF;
END $$;

-- Add comment to clarify what base_value represents
COMMENT ON COLUMN player_values.base_value IS 'Base player value from industry sources and Fantasy Draft Pros analysis';
