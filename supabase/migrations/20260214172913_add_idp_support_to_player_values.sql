/*
  # Add IDP (Individual Defensive Player) Support

  1. Schema Updates
    - Add `position_group` column to player_values (OFF vs IDP)
    - Add `sub_position` column for detailed position (EDGE, DT, ILB, OLB, CB, S)
    - Update position constraints to support DL, LB, DB
    - Update format constraints for IDP formats
    - Add indexes for IDP query performance
  
  2. New Positions
    - DL (Defensive Line) - sub: EDGE, DT, NT
    - LB (Linebacker) - sub: ILB, OLB, MLB
    - DB (Defensive Back) - sub: CB, S, FS, SS
  
  3. New Formats
    - dynasty_sf_idp (Superflex with IDP)
    - dynasty_1qb_idp (1QB with IDP)
    - dynasty_sf_idp123 (Superflex with IDP scoring tiers)
  
  4. Purpose
    - Support full IDP league analysis
    - Track defensive player values alongside offense
    - Enable IDP trade evaluation
    - Separate offensive vs defensive roster strength
  
  5. Notes
    - Backward compatible with existing offensive players
    - Position_group defaults to 'OFF' for existing data
    - Sub_position is optional for basic position tracking
    - Indexes optimized for both offensive and IDP queries
*/

-- Add position_group column to player_values table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'position_group'
  ) THEN
    ALTER TABLE player_values ADD COLUMN position_group text DEFAULT 'OFF';
  END IF;
END $$;

-- Add sub_position column to player_values table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'sub_position'
  ) THEN
    ALTER TABLE player_values ADD COLUMN sub_position text;
  END IF;
END $$;

-- Add constraints for position_group
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_position_group_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_position_group_check
    CHECK (position_group IN ('OFF', 'IDP'));
  END IF;
END $$;

-- Add constraints for sub_position (optional, specific defensive roles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_values_sub_position_check'
  ) THEN
    ALTER TABLE player_values
    ADD CONSTRAINT player_values_sub_position_check
    CHECK (
      sub_position IS NULL OR
      sub_position IN ('EDGE', 'DT', 'NT', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'FS', 'SS')
    );
  END IF;
END $$;

-- Create indexes for IDP queries
CREATE INDEX IF NOT EXISTS idx_player_values_position_group ON player_values(position_group);
CREATE INDEX IF NOT EXISTS idx_player_values_sub_position ON player_values(sub_position) WHERE sub_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_values_position_team ON player_values(position, team);
CREATE INDEX IF NOT EXISTS idx_player_values_position_group_position ON player_values(position_group, position);

-- Add similar columns to player_cache for consistency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_cache' AND column_name = 'position_group'
  ) THEN
    ALTER TABLE player_cache ADD COLUMN position_group text DEFAULT 'OFF';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_cache' AND column_name = 'sub_position'
  ) THEN
    ALTER TABLE player_cache ADD COLUMN sub_position text;
  END IF;
END $$;

-- Update ktc_value_snapshots indexes for IDP performance
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_format_position_rank ON ktc_value_snapshots(format, position, position_rank);
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_player_captured ON ktc_value_snapshots(player_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ktc_snapshots_position_format_captured ON ktc_value_snapshots(position, format, captured_at DESC);

-- Backfill position_group for existing players
UPDATE player_values 
SET position_group = 'OFF' 
WHERE position IN ('QB', 'RB', 'WR', 'TE') 
  AND (position_group IS NULL OR position_group = '');

UPDATE player_cache 
SET position_group = 'OFF' 
WHERE position IN ('QB', 'RB', 'WR', 'TE') 
  AND (position_group IS NULL OR position_group = '');

-- Create helper function to determine position group from position
CREATE OR REPLACE FUNCTION get_position_group(pos text)
RETURNS text AS $$
BEGIN
  CASE pos
    WHEN 'QB' THEN RETURN 'OFF';
    WHEN 'RB' THEN RETURN 'OFF';
    WHEN 'WR' THEN RETURN 'OFF';
    WHEN 'TE' THEN RETURN 'OFF';
    WHEN 'DL' THEN RETURN 'IDP';
    WHEN 'LB' THEN RETURN 'IDP';
    WHEN 'DB' THEN RETURN 'IDP';
    ELSE RETURN 'OFF';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-set position_group on insert/update for player_values
CREATE OR REPLACE FUNCTION set_player_values_position_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position_group IS NULL OR NEW.position_group = '' THEN
    NEW.position_group := get_position_group(NEW.position);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_player_values_position_group_trigger ON player_values;
CREATE TRIGGER set_player_values_position_group_trigger
BEFORE INSERT OR UPDATE OF position ON player_values
FOR EACH ROW
EXECUTE FUNCTION set_player_values_position_group();

-- Create trigger for player_cache as well
CREATE OR REPLACE FUNCTION set_player_cache_position_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position_group IS NULL OR NEW.position_group = '' THEN
    NEW.position_group := get_position_group(NEW.position);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_player_cache_position_group_trigger ON player_cache;
CREATE TRIGGER set_player_cache_position_group_trigger
BEFORE INSERT OR UPDATE OF position ON player_cache
FOR EACH ROW
EXECUTE FUNCTION set_player_cache_position_group();

-- Create view for IDP players
CREATE OR REPLACE VIEW idp_players AS
SELECT 
  p.*,
  COALESCE(latest.ktc_value, 0) as latest_ktc_value,
  COALESCE(latest.fdp_value, 0) as latest_fdp_value,
  latest.captured_at as latest_value_date
FROM player_values p
LEFT JOIN LATERAL (
  SELECT ktc_value, fdp_value, captured_at
  FROM ktc_value_snapshots
  WHERE player_id = p.player_id
    AND format IN ('dynasty_sf_idp', 'dynasty_1qb_idp')
  ORDER BY captured_at DESC
  LIMIT 1
) latest ON true
WHERE p.position_group = 'IDP'
ORDER BY latest_fdp_value DESC NULLS LAST;

-- Create view for offensive players
CREATE OR REPLACE VIEW offensive_players AS
SELECT 
  p.*,
  COALESCE(latest.ktc_value, 0) as latest_ktc_value,
  COALESCE(latest.fdp_value, 0) as latest_fdp_value,
  latest.captured_at as latest_value_date
FROM player_values p
LEFT JOIN LATERAL (
  SELECT ktc_value, fdp_value, captured_at
  FROM ktc_value_snapshots
  WHERE player_id = p.player_id
    AND format IN ('dynasty_sf', 'dynasty_1qb')
  ORDER BY captured_at DESC
  LIMIT 1
) latest ON true
WHERE p.position_group = 'OFF'
ORDER BY latest_fdp_value DESC NULLS LAST;

-- Grant permissions on views
GRANT SELECT ON idp_players TO anon, authenticated;
GRANT SELECT ON offensive_players TO anon, authenticated;
