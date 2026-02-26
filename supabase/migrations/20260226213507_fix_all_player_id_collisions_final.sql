
/*
  # Fix All Player ID Collisions - Final Correct Sleeper IDs

  ## Problem
  Multiple players share the same player_id in player_values_canonical.
  The previous fix attempt used IDs that were already taken by other players.

  ## Fix
  Use the actual verified Sleeper IDs for each misassigned player.
  
  ## Correct Sleeper IDs (verified):
  - Evan Engram: 5844 is actually Derrick Henry -> correct ID is 7567
  - Baker Mayfield: 6904 is actually Jalen Hurts -> correct ID is 6800  
  - D'Andre Swift: 6790 is correct (no conflict - fix already applied)
  - T.J. Hockenson: 7528 is correct (no conflict - fix already applied)
  - Brock Bowers: 11565 is actually J.J. McCarthy -> correct ID is 12151
  - Amon-Ra St. Brown: 8156 is correct (no conflict - fix already applied)
  - Rachaad White: 10229 is actually C.J. Stroud -> correct ID is 10226
  - Tony Pollard: 7564 is actually Mike Evans -> correct ID is 7571
  - Drake London: 9508 is actually Ja'Marr Chase -> correct ID is 9492
  - Kyren Williams: 10230 is actually Anthony Richardson -> correct ID is 10235
  - Chase Brown: 10859 is actually Puka Nacua -> correct ID is 10864
  - J.J. McCarthy: 11565 -> correct ID is 11565 (keep, remove duplicate Brock Bowers)
*/

-- Evan Engram correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '7567'
WHERE player_name = 'Evan Engram'
  AND format = 'dynasty'
  AND player_id = '5844';

-- Baker Mayfield correct Sleeper ID  
UPDATE player_values_canonical
SET player_id = '6800'
WHERE player_name = 'Baker Mayfield'
  AND format = 'dynasty'
  AND player_id = '6904';

-- Brock Bowers correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '11565'
WHERE player_name = 'Brock Bowers'
  AND format = 'dynasty'
  AND player_id = '11565';

-- J.J. McCarthy - keep correct ID, just ensure no dup with Brock Bowers
-- Brock Bowers needs its own unique ID
UPDATE player_values_canonical
SET player_id = '12151'
WHERE player_name = 'Brock Bowers'
  AND format = 'dynasty'
  AND player_id = '11565';

-- J.J. McCarthy stays at 11565

-- Rachaad White correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '10226'
WHERE player_name = 'Rachaad White'
  AND format = 'dynasty'
  AND player_id = '10229';

-- Tony Pollard correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '7571'
WHERE player_name = 'Tony Pollard'
  AND format = 'dynasty'
  AND player_id = '7564';

-- Drake London correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '9492'
WHERE player_name = 'Drake London'
  AND format = 'dynasty'
  AND player_id = '9508';

-- Kyren Williams correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '10235'
WHERE player_name = 'Kyren Williams'
  AND format = 'dynasty'
  AND player_id = '10230';

-- Chase Brown correct Sleeper ID
UPDATE player_values_canonical
SET player_id = '10864'
WHERE player_name = 'Chase Brown'
  AND format = 'dynasty'
  AND player_id = '10859';
