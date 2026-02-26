
/*
  # Fix Drake London Sleeper ID collision
  Drake London shares 9492 with Dalton Kincaid.
  Drake London's correct Sleeper ID is 9496.
*/
UPDATE player_values_canonical
SET player_id = '9496'
WHERE player_name = 'Drake London'
  AND format = 'dynasty'
  AND player_id = '9492';
