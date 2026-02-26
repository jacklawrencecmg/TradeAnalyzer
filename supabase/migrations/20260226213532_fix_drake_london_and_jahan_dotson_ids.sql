
/*
  # Fix Drake London and Jahan Dotson Sleeper ID collision
  
  Drake London's correct Sleeper ID: 9509
  Jahan Dotson's correct Sleeper ID: 9498
*/
UPDATE player_values_canonical
SET player_id = '9509'
WHERE player_name = 'Drake London'
  AND format = 'dynasty'
  AND player_id = '9496';

UPDATE player_values_canonical
SET player_id = '9498'
WHERE player_name = 'Jahan Dotson'
  AND format = 'dynasty'
  AND player_id = '9496';
