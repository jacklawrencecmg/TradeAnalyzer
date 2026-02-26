
/*
  # Fix Dynasty Values by Name Match

  ## Summary
  The 'ktc' source rows have correct dynasty values but wrong player_ids (seeded
  with colliding IDs). The 'calculated' rows have correct Sleeper player_ids but
  wrong rank order and values. This migration copies the ktc adjusted_value and
  rank_position onto the calculated rows by matching player_name + position,
  then deletes the now-redundant ktc rows.

  ## Changes
  - Updates 'calculated' rows to use the correct value and rank from 'ktc' rows
    matched by player_name + position
  - Deletes the 'ktc' rows that had wrong player_ids (they are now redundant)
  - Players only in 'calculated' (no ktc match) keep their exponential curve values
*/

-- Step 1: Copy ktc values onto calculated rows matched by name+position
UPDATE player_values_canonical AS calc
SET
  adjusted_value = ktc.adjusted_value,
  base_value     = ktc.base_value,
  rank_position  = ktc.rank_position,
  updated_at     = NOW()
FROM player_values_canonical AS ktc
WHERE calc.format        = 'dynasty'
  AND calc.source        = 'calculated'
  AND ktc.format         = 'dynasty'
  AND ktc.source         = 'ktc'
  AND lower(trim(calc.player_name)) = lower(trim(ktc.player_name))
  AND calc.position      = ktc.position;

-- Step 2: Remove the ktc rows (wrong IDs, now superseded)
DELETE FROM player_values_canonical
WHERE format = 'dynasty'
  AND source = 'ktc';

-- Step 3: Recompute rank_overall for all dynasty rows
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
