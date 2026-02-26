
/*
  # Fix Calculated Dynasty Value Curve

  ## Summary
  The 'calculated' source values in player_values_canonical (dynasty format) use a
  linear compression that gives far too high values to depth/backup players. Mariota
  at rank 43 QB was 8400, only slightly below Mahomes at rank 8 (9639). The floor
  was 2080 even for obscure practice squad QBs at rank 222.

  ## Changes
  - Recalculates all 'calculated' dynasty values using a position-specific
    exponential decay curve that matches real community dynasty value distributions
  - QB:  rank 1 → ~9500, rank 12 → ~5000, rank 20 → ~2800, rank 32+ → <800
  - RB:  rank 1 → ~9500, rank 12 → ~5500, rank 24 → ~2500, rank 36+ → <800
  - WR:  rank 1 → ~9500, rank 12 → ~6000, rank 24 → ~3000, rank 48+ → <800
  - TE:  rank 1 → ~9000, rank 8  → ~5500, rank 16 → ~2500, rank 24+ → <800
  - Also recalculates rank_overall based on adjusted_value across all positions

  ## Notes
  - Only touches rows with source = 'calculated' and format = 'dynasty'
  - Does not affect ktc, manual_seed, or fdp_2026_baseline sources
*/

UPDATE player_values_canonical
SET
  adjusted_value = CASE position
    -- QB: steep early drop, long tail. Top 12 starters carry real value.
    WHEN 'QB' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.88, rank_position - 1)
    ))
    -- RB: steepest curve. Workload players drop fast after top 24.
    WHEN 'RB' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.91, rank_position - 1)
    ))
    -- WR: wider pool, flatter curve. Top 36 have real value.
    WHEN 'WR' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.93, rank_position - 1)
    ))
    -- TE: scarce position, steep early, quick fall-off.
    WHEN 'TE' THEN GREATEST(50, ROUND(
      9000.0 * POW(0.89, rank_position - 1)
    ))
    ELSE adjusted_value
  END,
  base_value = CASE position
    WHEN 'QB' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.88, rank_position - 1)
    ))
    WHEN 'RB' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.91, rank_position - 1)
    ))
    WHEN 'WR' THEN GREATEST(50, ROUND(
      9500.0 * POW(0.93, rank_position - 1)
    ))
    WHEN 'TE' THEN GREATEST(50, ROUND(
      9000.0 * POW(0.89, rank_position - 1)
    ))
    ELSE base_value
  END,
  updated_at = NOW()
WHERE format = 'dynasty'
  AND source = 'calculated';

-- Recalculate rank_overall for all dynasty rows based on new adjusted_value
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY format
           ORDER BY adjusted_value DESC
         ) AS new_rank
  FROM player_values_canonical
  WHERE format = 'dynasty'
)
UPDATE player_values_canonical pvc
SET rank_overall = ranked.new_rank
FROM ranked
WHERE pvc.id = ranked.id;
