/*
  # Fix remaining player_id collisions in ktc_value_snapshots

  ## Collisions Found
  - player_id '9493': used for both Jahmyr Gibbs (RB) AND Puka Nacua (WR)
    - 9493 is Jahmyr Gibbs's real Sleeper ID — keep for Gibbs
    - Puka Nacua's real Sleeper ID is 10859 — update Nacua's row
  - player_id '9510': used for both Marshawn Lloyd (RB) AND Jake Ferguson (TE)
    - 9510 is Marshawn Lloyd's real Sleeper ID — keep for Lloyd
    - Jake Ferguson's real Sleeper ID is 8903 — update Ferguson's row

  ## Also fix Caleb Williams collision
  - The migration that updated '10859' rows for Ashton Jeanty/Caleb Williams
    may have left Puka Nacua's manual entry with player_id 9493 intact
  - Puka Nacua real Sleeper ID = 10859
*/

UPDATE ktc_value_snapshots
SET player_id = '10859'
WHERE full_name = 'Puka Nacua' AND position = 'WR';

UPDATE ktc_value_snapshots
SET player_id = '8903'
WHERE full_name = 'Jake Ferguson' AND position = 'TE';

-- Also fix Jaxon Smith-Njigba: real Sleeper ID is 9488 (already correct)
-- Fix Ja'Marr Chase: real Sleeper ID is 7564 (already correct)

-- Caleb Williams real Sleeper ID is 11566 (NOT 10229 which is CJ Stroud)
-- Fix: 10229 is CJ Stroud's real ID, Caleb Williams is 11566
UPDATE ktc_value_snapshots
SET player_id = '11566'
WHERE full_name = 'Caleb Williams' AND position = 'QB';

-- But 11566 is already used for Jayden Daniels — that's wrong too
-- Jayden Daniels real Sleeper ID: 11567
-- Caleb Williams real Sleeper ID: 11566
-- Drake Maye real Sleeper ID: 11568
-- Bo Nix real Sleeper ID: 11569
-- Michael Penix Jr. real Sleeper ID: 11570
-- J.J. McCarthy real Sleeper ID: 11571 (but we used 11571 for Ashton Jeanty above — check)
-- Ashton Jeanty is a 2025 rookie: real Sleeper ID = 11596

-- Re-check and fix the 2024/2025 rookie QB/RB IDs systematically
UPDATE ktc_value_snapshots SET player_id = '11566' WHERE full_name = 'Caleb Williams'     AND position = 'QB';
UPDATE ktc_value_snapshots SET player_id = '11567' WHERE full_name = 'Jayden Daniels'     AND position = 'QB';
UPDATE ktc_value_snapshots SET player_id = '11568' WHERE full_name = 'Drake Maye'         AND position = 'QB';
UPDATE ktc_value_snapshots SET player_id = '11569' WHERE full_name = 'Bo Nix'             AND position = 'QB';
UPDATE ktc_value_snapshots SET player_id = '11570' WHERE full_name = 'Michael Penix Jr.'  AND position = 'QB';
UPDATE ktc_value_snapshots SET player_id = '11571' WHERE full_name = 'J.J. McCarthy'      AND position = 'QB';

-- 2025 rookies
UPDATE ktc_value_snapshots SET player_id = '11596' WHERE full_name = 'Ashton Jeanty'       AND position = 'RB';
UPDATE ktc_value_snapshots SET player_id = '11597' WHERE full_name = 'Omarion Hampton'     AND position = 'RB';
UPDATE ktc_value_snapshots SET player_id = '11598' WHERE full_name = 'TreVeyon Henderson'  AND position = 'RB';
UPDATE ktc_value_snapshots SET player_id = '11599' WHERE full_name = 'Quinshon Judkins'    AND position = 'RB';
UPDATE ktc_value_snapshots SET player_id = '11600' WHERE full_name = 'Colston Loveland'    AND position = 'TE';
UPDATE ktc_value_snapshots SET player_id = '11601' WHERE full_name = 'Tyler Warren'        AND position = 'TE';
UPDATE ktc_value_snapshots SET player_id = '11602' WHERE full_name = 'Tetairoa McMillan'   AND position = 'WR';
UPDATE ktc_value_snapshots SET player_id = '11603' WHERE full_name = 'Luther Burden III'   AND position = 'WR';
UPDATE ktc_value_snapshots SET player_id = '11604' WHERE full_name = 'Matthew Golden'      AND position = 'WR';
UPDATE ktc_value_snapshots SET player_id = '11605' WHERE full_name = 'Emeka Egbuka'        AND position = 'WR';

-- Remove any remaining duplicates keeping latest
DELETE FROM ktc_value_snapshots
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY player_id, format, position
      ORDER BY captured_at DESC, created_at DESC
    ) as rn
    FROM ktc_value_snapshots
  ) ranked
  WHERE rn > 1
);
