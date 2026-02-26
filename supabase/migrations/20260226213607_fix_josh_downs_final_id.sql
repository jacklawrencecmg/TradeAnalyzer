
/*
  # Fix Josh Downs ID collision with Zay Flowers
  
  Zay Flowers keeps 10858 (correct Sleeper ID).
  Josh Downs gets a name-based unique ID to avoid further collisions.
  Josh Downs' actual Sleeper ID is 10862.
*/
UPDATE player_values_canonical
SET player_id = '10862'
WHERE player_name = 'Josh Downs'
  AND format = 'dynasty'
  AND player_id = '10858';
