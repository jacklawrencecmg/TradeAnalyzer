/*
  # Atomic Swap and Validation Functions

  1. Validation Functions
     - validate_staging_coverage - Check expected player count
     - validate_staging_duplicates - Check for duplicates
     - validate_staging_tiers - Check tier distribution
     - validate_staging_sanity - Sanity checks (e.g., Justin Jefferson)

  2. Atomic Swap
     - swap_player_values_atomic - Zero-downtime swap

  3. Helper Functions
     - get_staging_stats - Statistics about staging data
*/

-- ============================================================
-- VALIDATION FUNCTIONS
-- ============================================================

-- Get staging statistics
CREATE OR REPLACE FUNCTION get_staging_stats()
RETURNS jsonb AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_rows', COUNT(*),
    'unique_players', COUNT(DISTINCT player_id),
    'unique_profiles', COUNT(DISTINCT league_profile_id),
    'formats', jsonb_object_agg(format, format_count)
  ) INTO stats
  FROM (
    SELECT 
      format,
      COUNT(*) as format_count
    FROM player_values_staging
    GROUP BY format
  ) format_stats, player_values_staging
  GROUP BY format_stats.format, format_stats.format_count;

  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Validate staging has sufficient coverage (>90% expected players)
CREATE OR REPLACE FUNCTION validate_staging_coverage()
RETURNS jsonb AS $$
DECLARE
  staging_count integer;
  expected_count integer;
  coverage_pct numeric;
  result jsonb;
BEGIN
  -- Count unique players in staging
  SELECT COUNT(DISTINCT player_id) INTO staging_count
  FROM player_values_staging
  WHERE format = 'dynasty' AND league_profile_id IS NULL;

  -- Expected count (active NFL players)
  SELECT COUNT(*) INTO expected_count
  FROM nfl_players
  WHERE status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR', 'Free Agent');

  -- Calculate coverage
  coverage_pct := (staging_count::numeric / NULLIF(expected_count, 0)) * 100;

  result := jsonb_build_object(
    'valid', coverage_pct >= 90,
    'staging_count', staging_count,
    'expected_count', expected_count,
    'coverage_pct', ROUND(coverage_pct, 2),
    'message', CASE
      WHEN coverage_pct >= 90 THEN 'Coverage sufficient'
      ELSE 'Coverage insufficient: ' || ROUND(coverage_pct, 2) || '%'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Validate no duplicates in staging
CREATE OR REPLACE FUNCTION validate_staging_duplicates()
RETURNS jsonb AS $$
DECLARE
  duplicate_count integer;
  result jsonb;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT player_id, league_profile_id, format, value_epoch_id, COUNT(*) as cnt
    FROM player_values_staging
    GROUP BY player_id, league_profile_id, format, value_epoch_id
    HAVING COUNT(*) > 1
  ) duplicates;

  result := jsonb_build_object(
    'valid', duplicate_count = 0,
    'duplicate_count', duplicate_count,
    'message', CASE
      WHEN duplicate_count = 0 THEN 'No duplicates found'
      ELSE 'Found ' || duplicate_count || ' duplicate combinations'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Validate tier distribution looks reasonable
CREATE OR REPLACE FUNCTION validate_staging_tiers()
RETURNS jsonb AS $$
DECLARE
  elite_count integer;
  high_count integer;
  total_count integer;
  elite_pct numeric;
  result jsonb;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM player_values_staging
  WHERE format = 'dynasty' AND league_profile_id IS NULL;

  SELECT COUNT(*) INTO elite_count
  FROM player_values_staging
  WHERE format = 'dynasty' AND league_profile_id IS NULL AND tier = 'elite';

  SELECT COUNT(*) INTO high_count
  FROM player_values_staging
  WHERE format = 'dynasty' AND league_profile_id IS NULL AND tier = 'high';

  elite_pct := (elite_count::numeric / NULLIF(total_count, 0)) * 100;

  result := jsonb_build_object(
    'valid', elite_pct BETWEEN 3 AND 10,
    'total_count', total_count,
    'elite_count', elite_count,
    'high_count', high_count,
    'elite_pct', ROUND(elite_pct, 2),
    'message', CASE
      WHEN elite_pct BETWEEN 3 AND 10 THEN 'Tier distribution looks reasonable'
      ELSE 'Tier distribution unusual: ' || ROUND(elite_pct, 2) || '% elite'
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Sanity check: Top players are where expected
CREATE OR REPLACE FUNCTION validate_staging_sanity()
RETURNS jsonb AS $$
DECLARE
  jj_rank integer;
  mahomes_rank integer;
  cmc_rank integer;
  issues text[];
  result jsonb;
BEGIN
  issues := ARRAY[]::text[];

  -- Check Justin Jefferson (should be top-5 WR)
  SELECT rank_position INTO jj_rank
  FROM player_values_staging
  WHERE format = 'dynasty'
    AND league_profile_id IS NULL
    AND position = 'WR'
    AND (player_name ILIKE '%jefferson%' OR player_id ILIKE '%jefferson%')
  ORDER BY rank_position
  LIMIT 1;

  IF jj_rank IS NULL OR jj_rank > 5 THEN
    issues := array_append(issues, 'Justin Jefferson not top-5 WR (rank: ' || COALESCE(jj_rank::text, 'NULL') || ')');
  END IF;

  -- Check Patrick Mahomes (should be top-3 QB in dynasty SF)
  SELECT rank_position INTO mahomes_rank
  FROM player_values_staging
  WHERE format = 'dynasty'
    AND league_profile_id IS NULL
    AND position = 'QB'
    AND (player_name ILIKE '%mahomes%' OR player_id ILIKE '%mahomes%')
  ORDER BY rank_position
  LIMIT 1;

  IF mahomes_rank IS NULL OR mahomes_rank > 3 THEN
    issues := array_append(issues, 'Patrick Mahomes not top-3 QB (rank: ' || COALESCE(mahomes_rank::text, 'NULL') || ')');
  END IF;

  result := jsonb_build_object(
    'valid', array_length(issues, 1) IS NULL,
    'issues', issues,
    'message', CASE
      WHEN array_length(issues, 1) IS NULL THEN 'Sanity checks passed'
      ELSE 'Sanity check failures: ' || array_length(issues, 1)
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Run all validations
CREATE OR REPLACE FUNCTION validate_staging_all()
RETURNS jsonb AS $$
DECLARE
  coverage jsonb;
  duplicates jsonb;
  tiers jsonb;
  sanity jsonb;
  all_valid boolean;
  result jsonb;
BEGIN
  coverage := validate_staging_coverage();
  duplicates := validate_staging_duplicates();
  tiers := validate_staging_tiers();
  sanity := validate_staging_sanity();

  all_valid := (coverage->>'valid')::boolean
    AND (duplicates->>'valid')::boolean
    AND (tiers->>'valid')::boolean
    AND (sanity->>'valid')::boolean;

  result := jsonb_build_object(
    'valid', all_valid,
    'coverage', coverage,
    'duplicates', duplicates,
    'tiers', tiers,
    'sanity', sanity,
    'timestamp', now()
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ATOMIC SWAP FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION swap_player_values_atomic()
RETURNS jsonb AS $$
DECLARE
  staging_count integer;
  validation_result jsonb;
  swap_start timestamptz;
  swap_end timestamptz;
  result jsonb;
BEGIN
  swap_start := clock_timestamp();

  -- Check if staging has data
  SELECT COUNT(*) INTO staging_count FROM player_values_staging;
  
  IF staging_count = 0 THEN
    RAISE EXCEPTION 'Staging table is empty, cannot swap';
  END IF;

  -- Run validations
  validation_result := validate_staging_all();
  
  IF NOT (validation_result->>'valid')::boolean THEN
    RAISE EXCEPTION 'Staging validation failed: %', validation_result;
  END IF;

  -- Perform atomic swap
  BEGIN
    -- Drop old backup if exists
    DROP TABLE IF EXISTS player_values_canonical_old;
    
    -- Rename current canonical to old (backup)
    ALTER TABLE player_values_canonical RENAME TO player_values_canonical_old;
    
    -- Rename staging to canonical
    ALTER TABLE player_values_staging RENAME TO player_values_canonical;
    
    -- Create new empty staging table
    CREATE TABLE player_values_staging (LIKE player_values_canonical INCLUDING ALL);
    
    -- Re-apply RLS on new canonical
    ALTER TABLE player_values_canonical ENABLE ROW LEVEL SECURITY;
    ALTER TABLE player_values_staging ENABLE ROW LEVEL SECURITY;
    
    -- Re-create policies on new canonical
    DROP POLICY IF EXISTS "Anyone can read player values" ON player_values_canonical;
    CREATE POLICY "Anyone can read player values"
      ON player_values_canonical FOR SELECT TO authenticated USING (true);
    
    DROP POLICY IF EXISTS "Service role can manage player values" ON player_values_canonical;
    CREATE POLICY "Service role can manage player values"
      ON player_values_canonical FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Service role can manage staging" ON player_values_staging;
    CREATE POLICY "Service role can manage staging"
      ON player_values_staging FOR ALL USING (true) WITH CHECK (true);
    
    -- Re-create indexes on new canonical
    CREATE INDEX IF NOT EXISTS idx_pv_player_id ON player_values_canonical(player_id);
    CREATE INDEX IF NOT EXISTS idx_pv_epoch ON player_values_canonical(value_epoch_id);
    CREATE INDEX IF NOT EXISTS idx_pv_profile_format ON player_values_canonical(league_profile_id, format);
    CREATE INDEX IF NOT EXISTS idx_pv_lookup ON player_values_canonical(player_id, league_profile_id, format, value_epoch_id);
    CREATE INDEX IF NOT EXISTS idx_pv_by_value ON player_values_canonical(format, league_profile_id, adjusted_value DESC);
    
    -- Drop old table
    DROP TABLE IF EXISTS player_values_canonical_old;
    
    swap_end := clock_timestamp();
    
    result := jsonb_build_object(
      'success', true,
      'rows_swapped', staging_count,
      'swap_duration_ms', EXTRACT(MILLISECONDS FROM (swap_end - swap_start)),
      'validation', validation_result,
      'timestamp', swap_end
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Attempt rollback if possible
    RAISE EXCEPTION 'Atomic swap failed: %. Rolling back.', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION validate_staging_coverage() IS 'Validates staging has >90% expected player coverage';
COMMENT ON FUNCTION validate_staging_duplicates() IS 'Checks for duplicate player/profile/format/epoch combinations';
COMMENT ON FUNCTION validate_staging_tiers() IS 'Validates tier distribution (3-10% elite)';
COMMENT ON FUNCTION validate_staging_sanity() IS 'Sanity checks top players are ranked correctly';
COMMENT ON FUNCTION validate_staging_all() IS 'Runs all validation checks';
COMMENT ON FUNCTION swap_player_values_atomic() IS 'Atomically swaps staging to canonical with validation';
COMMENT ON FUNCTION get_staging_stats() IS 'Returns statistics about staging table contents';
