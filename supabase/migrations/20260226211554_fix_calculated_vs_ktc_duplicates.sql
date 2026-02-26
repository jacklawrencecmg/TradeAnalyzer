
/*
  # Fix Calculated vs KTC Duplicate Rows

  ## Summary
  Players that have both a 'ktc' and a 'calculated' row in player_values_canonical
  (dynasty format) were having the wrong row served by latest_player_values. The
  'calculated' rows were recently updated making them newer, so they win the
  DISTINCT ON even though ktc has correct values.

  ## Changes
  - Deletes all 'calculated' rows for players that already have a 'ktc' row
    in the same format+position, eliminating the conflict
  - The 'ktc' rows (Mahomes, Allen, Lamar, Burrow etc.) will now be the only
    rows for those players and will serve correct values
  - 'calculated' rows for players NOT covered by 'ktc' are preserved
*/

DELETE FROM player_values_canonical pvc_calc
WHERE pvc_calc.source = 'calculated'
  AND pvc_calc.format = 'dynasty'
  AND EXISTS (
    SELECT 1
    FROM player_values_canonical pvc_ktc
    WHERE pvc_ktc.player_id = pvc_calc.player_id
      AND pvc_ktc.format = 'dynasty'
      AND pvc_ktc.source = 'ktc'
  );
