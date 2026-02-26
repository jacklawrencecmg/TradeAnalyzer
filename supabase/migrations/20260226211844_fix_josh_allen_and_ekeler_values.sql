
/*
  # Fix Josh Allen QB and Austin Ekeler Values

  ## Summary
  The player_id '4663' belongs to Austin Ekeler (RB) in Sleeper, but was
  incorrectly used for Josh Allen QB in the 2026 baseline migration. This
  corrupted Ekeler's value to 11745 and left Josh Allen QB missing entirely.

  Josh Allen QB's real Sleeper ID is 4984.

  ## Changes
  - Restores Austin Ekeler (4663) to correct RB dynasty value (~2800, rank 18)
  - Inserts Josh Allen QB with correct Sleeper ID 4984 and value 11745
  - Fixes ktc_value_snapshots to also use 4984 for Josh Allen QB
*/

-- Fix Austin Ekeler: restore his correct calculated value using exponential curve
-- RB rank 18 → 9500 * 0.91^17 ≈ 1,847
UPDATE player_values_canonical
SET player_name   = 'Austin Ekeler',
    position      = 'RB',
    team          = 'FA',
    adjusted_value = 1847,
    base_value     = 1847,
    market_value   = 1400,
    rank_position  = 18,
    source         = 'calculated',
    updated_at     = NOW()
WHERE player_id = '4663' AND format = 'dynasty';

-- Insert Josh Allen QB with his real Sleeper ID 4984
INSERT INTO player_values_canonical
  (player_id, player_name, position, team, format, base_value, adjusted_value,
   market_value, rank_position, rank_overall, source, value_epoch_id, created_at, updated_at)
SELECT
  '4984', 'Josh Allen', 'QB', 'BUF', 'dynasty',
  11745, 11745, 8700, 2, 2,
  'fdp_2026_baseline', id, NOW(), NOW()
FROM value_epochs
WHERE status = 'active'
ORDER BY epoch_number DESC
LIMIT 1
ON CONFLICT DO NOTHING;

-- Also fix ktc_value_snapshots so Josh Allen QB has the right ID
UPDATE ktc_value_snapshots
SET player_id = '4984'
WHERE full_name = 'Josh Allen' AND position = 'QB';

-- Recompute rank_overall
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
