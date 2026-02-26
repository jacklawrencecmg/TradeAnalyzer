
/*
  # Fix Calculated Rank Positions and Values

  ## Summary
  The 'calculated' source rows had duplicate rank_position values (multiple players
  sharing rank 2, rank 3, etc.) causing fringe players to receive elite values.
  This migration assigns correct sequential rank_positions within each position
  group ordered by the existing adjusted_value, then recomputes values using the
  exponential decay curve.

  ## Changes
  - Reassigns rank_position sequentially (1, 2, 3...) within each position for
    calculated rows, ordered by current adjusted_value DESC
  - Reapplies the exponential decay curve using the corrected rank_positions
  - Recomputes rank_overall across all dynasty rows
*/

-- Step 1: Reassign sequential rank_positions for calculated rows per position
WITH reranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY position
      ORDER BY adjusted_value DESC, player_name ASC
    ) AS new_rank_pos
  FROM player_values_canonical
  WHERE format = 'dynasty' AND source = 'calculated'
)
UPDATE player_values_canonical pvc
SET rank_position = reranked.new_rank_pos
FROM reranked
WHERE pvc.id = reranked.id;

-- Step 2: Reapply exponential decay using corrected rank_positions
UPDATE player_values_canonical
SET
  adjusted_value = CASE position
    WHEN 'QB' THEN GREATEST(50,  ROUND(9500.0 * POW(0.88, rank_position - 1)))
    WHEN 'RB' THEN GREATEST(50,  ROUND(9500.0 * POW(0.91, rank_position - 1)))
    WHEN 'WR' THEN GREATEST(50,  ROUND(9500.0 * POW(0.93, rank_position - 1)))
    WHEN 'TE' THEN GREATEST(50,  ROUND(9000.0 * POW(0.89, rank_position - 1)))
    ELSE adjusted_value
  END,
  base_value = CASE position
    WHEN 'QB' THEN GREATEST(50,  ROUND(9500.0 * POW(0.88, rank_position - 1)))
    WHEN 'RB' THEN GREATEST(50,  ROUND(9500.0 * POW(0.91, rank_position - 1)))
    WHEN 'WR' THEN GREATEST(50,  ROUND(9500.0 * POW(0.93, rank_position - 1)))
    WHEN 'TE' THEN GREATEST(50,  ROUND(9000.0 * POW(0.89, rank_position - 1)))
    ELSE base_value
  END,
  updated_at = NOW()
WHERE format = 'dynasty' AND source = 'calculated';

-- Step 3: Recompute rank_overall across all dynasty rows
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY format ORDER BY adjusted_value DESC) AS new_rank
  FROM player_values_canonical
  WHERE format = 'dynasty'
)
UPDATE player_values_canonical pvc
SET rank_overall = ranked.new_rank
FROM ranked
WHERE pvc.id = ranked.id;
