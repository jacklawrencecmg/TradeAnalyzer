/*
  # Add RB Context Fields

  1. New Columns
    - `age` (integer) - Player age for dynasty valuation
    - `depth_role` (text) - Role in depth chart: feature, lead_committee, committee, handcuff, backup
    - `workload_tier` (text) - Expected workload: elite, solid, light, unknown
    - `injury_risk` (text) - Injury history assessment: low, medium, high
    - `contract_security` (text) - Contract status: high, medium, low
  
  2. Purpose
    - Enable sophisticated RB valuation adjustments
    - Track dynasty-relevant factors for running backs
    - Support FDP value calculations beyond basic multipliers
  
  3. Notes
    - All fields nullable (gradual data population)
    - Primary use for RB position, but available for all positions
    - Used by FDP calculation engine for position-specific adjustments
*/

-- Add RB context fields to player_values table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'age'
  ) THEN
    ALTER TABLE player_values ADD COLUMN age INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'depth_role'
  ) THEN
    ALTER TABLE player_values ADD COLUMN depth_role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'workload_tier'
  ) THEN
    ALTER TABLE player_values ADD COLUMN workload_tier TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'injury_risk'
  ) THEN
    ALTER TABLE player_values ADD COLUMN injury_risk TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'contract_security'
  ) THEN
    ALTER TABLE player_values ADD COLUMN contract_security TEXT;
  END IF;
END $$;

-- Add check constraints to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_depth_role_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_depth_role_check
    CHECK (depth_role IS NULL OR depth_role IN ('feature', 'lead_committee', 'committee', 'handcuff', 'backup'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_workload_tier_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_workload_tier_check
    CHECK (workload_tier IS NULL OR workload_tier IN ('elite', 'solid', 'light', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_injury_risk_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_injury_risk_check
    CHECK (injury_risk IS NULL OR injury_risk IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_contract_security_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_contract_security_check
    CHECK (contract_security IS NULL OR contract_security IN ('high', 'medium', 'low'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_age_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_age_check
    CHECK (age IS NULL OR (age >= 18 AND age <= 45));
  END IF;
END $$;

-- Add indexes for filtering RBs with context
CREATE INDEX IF NOT EXISTS idx_player_values_position_age ON player_values(position, age) WHERE position = 'RB';
CREATE INDEX IF NOT EXISTS idx_player_values_position_role ON player_values(position, depth_role) WHERE position = 'RB';
