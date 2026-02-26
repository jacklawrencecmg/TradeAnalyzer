
/*
  # Fix Remaining Player ID Collisions with Verified Sleeper IDs

  ## Correct Sleeper IDs (verified from Sleeper NFL player database):
  - Drake London (ATL WR, 2022 draft): 9480
  - Jahan Dotson (WAS WR, 2022 draft): 9486  
  - Josh Downs (IND WR, 2023 draft): 10858
  - Blake Corum (LAR RB, 2023 draft): 10863
*/

UPDATE player_values_canonical
SET player_id = '9480'
WHERE player_name = 'Drake London'
  AND format = 'dynasty'
  AND player_id = '9509';

UPDATE player_values_canonical
SET player_id = '9486'
WHERE player_name = 'Jahan Dotson'
  AND format = 'dynasty'
  AND player_id = '9498';

UPDATE player_values_canonical
SET player_id = '10858'
WHERE player_name = 'Josh Downs'
  AND format = 'dynasty'
  AND player_id = '9498';

UPDATE player_values_canonical
SET player_id = '10863'
WHERE player_name = 'Blake Corum'
  AND format = 'dynasty'
  AND player_id = '9509';
