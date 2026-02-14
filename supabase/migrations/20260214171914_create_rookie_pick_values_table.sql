/*
  # Create Rookie Pick Values Table

  1. New Table
    - `rookie_pick_values`
      - `id` (uuid, primary key)
      - `season` (int) - Draft year (2026, 2027, etc.)
      - `pick` (text) - Pick type (early_1st, mid_1st, late_1st, early_2nd, late_2nd, 3rd)
      - `base_value` (int) - Baseline KTC-equivalent value
      - `adjusted_value` (int) - Current phase-adjusted value
      - `phase` (text) - Current NFL calendar phase
      - `manual_override` (boolean) - Whether admin has manually set the value
      - `override_value` (int) - Manual override value if set
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Purpose
    - Store dynamic rookie pick valuations
    - Adjust pick values based on NFL calendar phase
    - Track hype cycles (draft fever, post-draft correction, etc.)
    - Allow admin manual overrides
  
  3. Security
    - Enable RLS
    - Public read access (for trade calculator)
    - Authenticated write access (for admin updates)
  
  4. Notes
    - Values automatically updated based on calendar phase
    - Phase multipliers simulate market psychology
    - Integrates with trade calculator for accurate pick valuations
*/

-- Create rookie_pick_values table
CREATE TABLE IF NOT EXISTS rookie_pick_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season int NOT NULL,
  pick text NOT NULL,
  base_value int NOT NULL DEFAULT 0,
  adjusted_value int NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'season',
  manual_override boolean NOT NULL DEFAULT false,
  override_value int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_season_pick UNIQUE(season, pick)
);

-- Add constraints for valid pick types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rookie_pick_values_pick_check'
  ) THEN
    ALTER TABLE rookie_pick_values
    ADD CONSTRAINT rookie_pick_values_pick_check
    CHECK (pick IN ('early_1st', 'mid_1st', 'late_1st', 'early_2nd', 'late_2nd', '3rd'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rookie_pick_values_phase_check'
  ) THEN
    ALTER TABLE rookie_pick_values
    ADD CONSTRAINT rookie_pick_values_phase_check
    CHECK (phase IN ('playoffs', 'pre_draft_hype', 'rookie_fever', 'post_draft_correction', 'camp_battles', 'season', 'trade_deadline_push'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rookie_pick_values_season_check'
  ) THEN
    ALTER TABLE rookie_pick_values
    ADD CONSTRAINT rookie_pick_values_season_check
    CHECK (season >= 2024 AND season <= 2035);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rookie_pick_values_season ON rookie_pick_values(season);
CREATE INDEX IF NOT EXISTS idx_rookie_pick_values_pick ON rookie_pick_values(pick);
CREATE INDEX IF NOT EXISTS idx_rookie_pick_values_phase ON rookie_pick_values(phase);

-- Enable RLS
ALTER TABLE rookie_pick_values ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read pick values" ON rookie_pick_values;
DROP POLICY IF EXISTS "Authenticated users can insert pick values" ON rookie_pick_values;
DROP POLICY IF EXISTS "Authenticated users can update pick values" ON rookie_pick_values;
DROP POLICY IF EXISTS "Authenticated users can delete pick values" ON rookie_pick_values;

-- Policy: Anyone can read pick values (public access for trade calculator)
CREATE POLICY "Anyone can read pick values"
  ON rookie_pick_values
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert pick values
CREATE POLICY "Authenticated users can insert pick values"
  ON rookie_pick_values
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update pick values
CREATE POLICY "Authenticated users can update pick values"
  ON rookie_pick_values
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete pick values
CREATE POLICY "Authenticated users can delete pick values"
  ON rookie_pick_values
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_rookie_pick_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rookie_pick_values_updated_at_trigger ON rookie_pick_values;
CREATE TRIGGER update_rookie_pick_values_updated_at_trigger
BEFORE UPDATE ON rookie_pick_values
FOR EACH ROW
EXECUTE FUNCTION update_rookie_pick_values_updated_at();

-- Seed initial data for 2025-2027 seasons
INSERT INTO rookie_pick_values (season, pick, base_value, adjusted_value, phase)
VALUES
  (2025, 'early_1st', 6500, 6500, 'season'),
  (2025, 'mid_1st', 5500, 5500, 'season'),
  (2025, 'late_1st', 4800, 4800, 'season'),
  (2025, 'early_2nd', 3200, 3200, 'season'),
  (2025, 'late_2nd', 2600, 2600, 'season'),
  (2025, '3rd', 1200, 1200, 'season'),
  (2026, 'early_1st', 6500, 6500, 'season'),
  (2026, 'mid_1st', 5500, 5500, 'season'),
  (2026, 'late_1st', 4800, 4800, 'season'),
  (2026, 'early_2nd', 3200, 3200, 'season'),
  (2026, 'late_2nd', 2600, 2600, 'season'),
  (2026, '3rd', 1200, 1200, 'season'),
  (2027, 'early_1st', 6500, 6500, 'season'),
  (2027, 'mid_1st', 5500, 5500, 'season'),
  (2027, 'late_1st', 4800, 4800, 'season'),
  (2027, 'early_2nd', 3200, 3200, 'season'),
  (2027, 'late_2nd', 2600, 2600, 'season'),
  (2027, '3rd', 1200, 1200, 'season')
ON CONFLICT (season, pick) DO NOTHING;
