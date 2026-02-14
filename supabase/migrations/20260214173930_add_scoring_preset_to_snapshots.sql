/*
  # Add Scoring Preset Support

  1. Purpose
    - Track which IDP scoring preset was used for each value snapshot
    - Enable queries filtered by scoring style (tackle_heavy, balanced, big_play)
    - Allow comparison of player values across different scoring systems
  
  2. Changes
    - Add scoring_preset column to ktc_value_snapshots
    - Add index for efficient preset-based queries
    - Update format constraints to include preset variants
  
  3. Scoring Presets
    - tackle_heavy: Rewards consistent tackle production (LB premium)
    - balanced: Standard IDP scoring (neutral weights)
    - big_play: Rewards sacks, INTs, forced fumbles (DL premium)
  
  4. New Formats
    - dynasty_sf_idp_tackle
    - dynasty_sf_idp_balanced
    - dynasty_sf_idp_bigplay
    - dynasty_1qb_idp_tackle
    - dynasty_1qb_idp_balanced
    - dynasty_1qb_idp_bigplay
*/

-- Add scoring_preset column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ktc_value_snapshots' AND column_name = 'scoring_preset'
  ) THEN
    ALTER TABLE ktc_value_snapshots ADD COLUMN scoring_preset text DEFAULT 'balanced';
  END IF;
END $$;

-- Add constraint for scoring_preset values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ktc_value_snapshots_scoring_preset_check'
  ) THEN
    ALTER TABLE ktc_value_snapshots
    ADD CONSTRAINT ktc_value_snapshots_scoring_preset_check
    CHECK (scoring_preset IN ('tackle_heavy', 'balanced', 'big_play'));
  END IF;
END $$;

-- Add index for preset-based queries
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_preset_position ON ktc_value_snapshots(scoring_preset, position, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_format_preset ON ktc_value_snapshots(format, scoring_preset, position);

-- Update format constraint to include preset variants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ktc_value_snapshots_format_check'
  ) THEN
    ALTER TABLE ktc_value_snapshots DROP CONSTRAINT ktc_value_snapshots_format_check;
  END IF;
  
  ALTER TABLE ktc_value_snapshots
  ADD CONSTRAINT ktc_value_snapshots_format_check
  CHECK (format IN (
    'dynasty_sf',
    'dynasty_1qb',
    'dynasty_2qb',
    'dynasty_sf_idp',
    'dynasty_1qb_idp',
    'dynasty_sf_idp123',
    'dynasty_sf_idp_tackle',
    'dynasty_sf_idp_balanced',
    'dynasty_sf_idp_bigplay',
    'dynasty_1qb_idp_tackle',
    'dynasty_1qb_idp_balanced',
    'dynasty_1qb_idp_bigplay',
    'redraft_sf',
    'redraft_1qb'
  ));
END $$;

-- Create function to extract preset from format
CREATE OR REPLACE FUNCTION get_scoring_preset_from_format(fmt text)
RETURNS text AS $$
BEGIN
  IF fmt LIKE '%bigplay%' OR fmt LIKE '%big_play%' THEN
    RETURN 'big_play';
  ELSIF fmt LIKE '%balanced%' THEN
    RETURN 'balanced';
  ELSIF fmt LIKE '%tackle%' THEN
    RETURN 'tackle_heavy';
  ELSIF fmt LIKE '%idp%' THEN
    RETURN 'balanced';
  ELSE
    RETURN 'balanced';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-set scoring_preset from format
CREATE OR REPLACE FUNCTION set_scoring_preset()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scoring_preset IS NULL OR NEW.scoring_preset = '' THEN
    NEW.scoring_preset := get_scoring_preset_from_format(NEW.format);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_scoring_preset_trigger ON ktc_value_snapshots;
CREATE TRIGGER set_scoring_preset_trigger
BEFORE INSERT OR UPDATE OF format ON ktc_value_snapshots
FOR EACH ROW
EXECUTE FUNCTION set_scoring_preset();

-- Backfill scoring_preset for existing IDP snapshots
UPDATE ktc_value_snapshots
SET scoring_preset = get_scoring_preset_from_format(format)
WHERE scoring_preset IS NULL 
  OR scoring_preset = '';

-- Create view for preset comparisons
CREATE OR REPLACE VIEW idp_preset_comparison AS
SELECT 
  player_id,
  full_name,
  position,
  team,
  MAX(CASE WHEN scoring_preset = 'tackle_heavy' THEN fdp_value END) as tackle_heavy_value,
  MAX(CASE WHEN scoring_preset = 'balanced' THEN fdp_value END) as balanced_value,
  MAX(CASE WHEN scoring_preset = 'big_play' THEN fdp_value END) as big_play_value,
  MAX(captured_at) as latest_update
FROM ktc_value_snapshots
WHERE position IN ('DL', 'LB', 'DB')
  AND format LIKE '%idp%'
GROUP BY player_id, full_name, position, team
HAVING COUNT(DISTINCT scoring_preset) > 1;

-- Grant permissions
GRANT SELECT ON idp_preset_comparison TO anon, authenticated;

-- Create helper view for latest values by preset
CREATE OR REPLACE VIEW latest_idp_values_by_preset AS
SELECT DISTINCT ON (player_id, scoring_preset)
  player_id,
  full_name,
  position,
  team,
  scoring_preset,
  ktc_value,
  fdp_value,
  position_rank,
  format,
  captured_at
FROM ktc_value_snapshots
WHERE position IN ('DL', 'LB', 'DB')
  AND format LIKE '%idp%'
ORDER BY player_id, scoring_preset, captured_at DESC;

-- Grant permissions
GRANT SELECT ON latest_idp_values_by_preset TO anon, authenticated;

-- Add comment explaining the preset system
COMMENT ON COLUMN ktc_value_snapshots.scoring_preset IS 
  'IDP scoring preset used for value calculation: tackle_heavy (LB premium), balanced (neutral), big_play (DL premium)';
