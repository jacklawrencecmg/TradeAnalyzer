
/*
  # Fix Player ID Collisions - Assign Correct Sleeper IDs

  ## Problem
  Multiple players in player_values_canonical share the same numeric player_id,
  causing power rankings to return wrong values (Map lookup overwrites one player
  with another's value). This makes power rankings completely inaccurate.

  ## Fix
  Assign the correct Sleeper numeric IDs to each incorrectly-IDed player.
  The wrongly-assigned player in each collision pair gets their real Sleeper ID.

  ## Collisions Fixed (11 total)
  - 4892: Brock Purdy (correct) vs Baker Mayfield (wrong -> 6904)
  - 6770: Tua Tagovailoa (correct) vs Evan Engram (wrong -> 5844)
  - 6797: Sam Darnold (correct) vs D'Andre Swift (wrong -> 6790)
  - 6804: Jordan Love (correct) vs T.J. Hockenson (wrong -> 7528)
  - 8149: CeeDee Lamb (correct) vs Brock Bowers (wrong -> 11565)
  - 8150: Breece Hall (correct) vs Amon-Ra St. Brown (wrong -> 8151 -> reassigned)
  - 8151: Garrett Wilson (correct) vs Rachaad White (wrong -> 10229)
  - 8152: Sam LaPorta (correct) vs Tony Pollard (wrong -> 7564)
  - 9493: Jahmyr Gibbs (correct) vs Drake London (wrong -> 9508 -> reassigned)
  - 9508: Ja'Marr Chase (correct) vs Kyren Williams (wrong -> 10230)
  - 9755: Bijan Robinson (correct) vs Chase Brown (wrong -> 10859)
*/

UPDATE player_values_canonical
SET player_id = '6904'
WHERE player_name = 'Baker Mayfield'
  AND format = 'dynasty'
  AND player_id = '4892';

UPDATE player_values_canonical
SET player_id = '5844'
WHERE player_name = 'Evan Engram'
  AND format = 'dynasty'
  AND player_id = '6770';

UPDATE player_values_canonical
SET player_id = '6790'
WHERE player_name = 'D''Andre Swift'
  AND format = 'dynasty'
  AND player_id = '6797';

UPDATE player_values_canonical
SET player_id = '7528'
WHERE player_name = 'T.J. Hockenson'
  AND format = 'dynasty'
  AND player_id = '6804';

UPDATE player_values_canonical
SET player_id = '11565'
WHERE player_name = 'Brock Bowers'
  AND format = 'dynasty'
  AND player_id = '8149';

UPDATE player_values_canonical
SET player_id = '8156'
WHERE player_name = 'Amon-Ra St. Brown'
  AND format = 'dynasty'
  AND player_id = '8150';

UPDATE player_values_canonical
SET player_id = '10229'
WHERE player_name = 'Rachaad White'
  AND format = 'dynasty'
  AND player_id = '8151';

UPDATE player_values_canonical
SET player_id = '7564'
WHERE player_name = 'Tony Pollard'
  AND format = 'dynasty'
  AND player_id = '8152';

UPDATE player_values_canonical
SET player_id = '9508'
WHERE player_name = 'Drake London'
  AND format = 'dynasty'
  AND player_id = '9493';

UPDATE player_values_canonical
SET player_id = '10230'
WHERE player_name = 'Kyren Williams'
  AND format = 'dynasty'
  AND player_id = '9508'
  AND position = 'RB';

UPDATE player_values_canonical
SET player_id = '10859'
WHERE player_name = 'Chase Brown'
  AND format = 'dynasty'
  AND player_id = '9755';
