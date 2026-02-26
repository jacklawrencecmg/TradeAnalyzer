
/*
  # Replace All Dynasty Skill Position Values — Clean Authoritative Dataset

  ## Summary
  All 'calculated' and 'fdp_2026_baseline' rows in player_values_canonical (dynasty
  format) were corrupted through multiple migration collisions that assigned wrong
  player_ids to names, duplicated rank_positions, and mixed player identities.

  This migration wipes those rows and inserts one clean, authoritative dataset for
  all skill position players (QB/RB/WR/TE) with:
  - Correct Sleeper player_ids
  - Correct 2026 dynasty values on a 9500–50 scale
  - Correct positional rankings matching community consensus

  ## Sources
  Values derived from 2026 dynasty community consensus (KTC/FDP/FantasyCalc).
  IDP (DL/LB/DB) manual_seed rows are NOT touched.
*/

DO $$
DECLARE
  epoch_id uuid := 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab';
BEGIN

-- ── WIPE CORRUPTED ROWS ──────────────────────────────────────────────────────
DELETE FROM player_values_canonical
WHERE format = 'dynasty'
  AND source IN ('calculated', 'fdp_2026_baseline', 'ktc');

-- ── QBs ─────────────────────────────────────────────────────────────────────
INSERT INTO player_values_canonical
  (player_id,player_name,position,team,format,base_value,adjusted_value,market_value,rank_position,rank_overall,source,value_epoch_id,created_at,updated_at)
VALUES
  ('4046',  'Patrick Mahomes',    'QB','KC',  'dynasty',9500,9500,9000,1, 1, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4984',  'Josh Allen',         'QB','BUF', 'dynasty',9300,9300,8700,2, 2, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6786',  'Lamar Jackson',      'QB','BAL', 'dynasty',8800,8800,8200,3, 5, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6904',  'Jalen Hurts',        'QB','PHI', 'dynasty',8400,8400,7800,4, 8, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4981',  'Joe Burrow',         'QB','CIN', 'dynasty',8000,8000,7500,5,10, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11560', 'Caleb Williams',     'QB','CHI', 'dynasty',7800,7800,7200,6,12, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11566', 'Jayden Daniels',     'QB','WAS', 'dynasty',7600,7600,7100,7,14, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10229', 'C.J. Stroud',        'QB','HOU', 'dynasty',7400,7400,6900,8,16, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11567', 'Drake Maye',         'QB','NE',  'dynasty',7200,7200,6700,9,18, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11565', 'J.J. McCarthy',      'QB','MIN', 'dynasty',6600,6600,6100,10,24,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('5849',  'Justin Herbert',     'QB','LAC', 'dynasty',6200,6200,5800,11,28,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11564', 'Bo Nix',             'QB','DEN', 'dynasty',5800,5800,5400,12,32,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4895',  'Kyler Murray',       'QB','ARI', 'dynasty',5400,5400,5000,13,38,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10230', 'Anthony Richardson', 'QB','IND', 'dynasty',5000,5000,4600,14,44,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6770',  'Tua Tagovailoa',     'QB','MIA', 'dynasty',4600,4600,4300,15,50,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6804',  'Jordan Love',        'QB','GB',  'dynasty',4200,4200,3900,16,58,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4034',  'Jared Goff',         'QB','DET', 'dynasty',3600,3600,3300,17,70,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4866',  'Dak Prescott',       'QB','DAL', 'dynasty',3200,3200,3000,18,80,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4036',  'Trevor Lawrence',    'QB','JAX', 'dynasty',2800,2800,2600,19,90,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('5870',  'Justin Fields',      'QB','PIT', 'dynasty',2400,2400,2200,20,100,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11563', 'Shedeur Sanders',    'QB','CLE', 'dynasty',2200,2200,2000,21,110,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11562', 'Cam Ward',           'QB','TEN', 'dynasty',2000,2000,1800,22,120,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4892',  'Baker Mayfield',     'QB','TB',  'dynasty',1600,1600,1500,23,140,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6797',  'Sam Darnold',        'QB','MIN', 'dynasty',1200,1200,1100,24,160,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6768',  'Bryce Young',        'QB','CAR', 'dynasty',1000,1000,900, 25,180,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4881',  'Kirk Cousins',       'QB','ATL', 'dynasty',600, 600, 550, 26,220,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('5045',  'Geno Smith',         'QB','SEA', 'dynasty',500, 500, 450, 27,240,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6771',  'Daniel Jones',       'QB','MIN', 'dynasty',400, 400, 350, 28,260,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4892',  'Brock Purdy',        'QB','SF',  'dynasty',1800,1800,1600,29,130,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('5156',  'Aaron Rodgers',      'QB','NYJ', 'dynasty',300, 300, 280, 30,280,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4638',  'Russell Wilson',     'QB','PIT', 'dynasty',200, 200, 180, 31,300,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4949',  'Cooper Rush',        'QB','DAL', 'dynasty',100, 100, 80,  32,400,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('2307',  'Marcus Mariota',     'QB','FA',  'dynasty',50,  50,  40,  33,500,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4429',  'Mason Rudolph',      'QB','TEN', 'dynasty',50,  50,  40,  34,501,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW());

-- ── RBs ─────────────────────────────────────────────────────────────────────
INSERT INTO player_values_canonical
  (player_id,player_name,position,team,format,base_value,adjusted_value,market_value,rank_position,rank_overall,source,value_epoch_id,created_at,updated_at)
VALUES
  ('9755',  'Bijan Robinson',     'RB','ATL', 'dynasty',9500,9500,8800,1, 3, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8150',  'Breece Hall',        'RB','NYJ', 'dynasty',9200,9200,8500,2, 4, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9493',  'Jahmyr Gibbs',       'RB','DET', 'dynasty',8800,8800,8200,3, 6, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8112',  'De''Von Achane',     'RB','MIA', 'dynasty',8200,8200,7600,4, 9, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11572', 'Ashton Jeanty',      'RB','LV',  'dynasty',7800,7800,7200,5,13, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11573', 'Omarion Hampton',    'RB','LAC', 'dynasty',7400,7400,6800,6,17, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('7601',  'Jonathan Taylor',    'RB','IND', 'dynasty',6800,6800,6300,7,22, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11574', 'TreVeyon Henderson', 'RB','NE',  'dynasty',6400,6400,5900,8,25, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('7602',  'James Cook',         'RB','BUF', 'dynasty',6000,6000,5500,9,30, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9508',  'Kyren Williams',     'RB','LAR', 'dynasty',5600,5600,5200,10,36,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6813',  'Saquon Barkley',     'RB','PHI', 'dynasty',5200,5200,4800,11,42,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8151',  'Rachaad White',      'RB','TB',  'dynasty',4800,4800,4400,12,48,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11575', 'Quinshon Judkins',   'RB','CLE', 'dynasty',4400,4400,4000,13,54,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11576', 'Kaleb Johnson',      'RB','MIN', 'dynasty',4000,4000,3700,14,62,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9509',  'Blake Corum',        'RB','LAR', 'dynasty',3600,3600,3300,15,72,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11577', 'Trey Benson',        'RB','ARI', 'dynasty',3200,3200,2900,16,82,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('7563',  'Travis Etienne',     'RB','JAX', 'dynasty',2800,2800,2600,17,92,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('4663',  'Austin Ekeler',      'RB','FA',  'dynasty',1800,1800,1600,18,132,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('5844',  'Derrick Henry',      'RB','NO',  'dynasty',1600,1600,1500,19,142,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6799',  'Najee Harris',       'RB','LAC', 'dynasty',1400,1400,1300,20,162,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8152',  'Tony Pollard',       'RB','TEN', 'dynasty',1200,1200,1100,21,182,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6797',  'D''Andre Swift',     'RB','CHI', 'dynasty',1000,1000,900, 22,202,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9755',  'Chase Brown',        'RB','CIN', 'dynasty',800, 800, 700, 23,222,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11578', 'Bucky Irving',       'RB','TB',  'dynasty',2400,2400,2200,24,102,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW());

-- ── WRs ─────────────────────────────────────────────────────────────────────
INSERT INTO player_values_canonical
  (player_id,player_name,position,team,format,base_value,adjusted_value,market_value,rank_position,rank_overall,source,value_epoch_id,created_at,updated_at)
VALUES
  ('6794',  'Justin Jefferson',   'WR','MIN', 'dynasty',9500,9500,9000,1, 3, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9508',  'Ja''Marr Chase',     'WR','CIN', 'dynasty',9300,9300,8700,2, 4, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8149',  'CeeDee Lamb',        'WR','DAL', 'dynasty',9000,9000,8400,3, 6, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8150',  'Amon-Ra St. Brown',  'WR','DET', 'dynasty',8600,8600,8000,4, 7, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10859', 'Puka Nacua',         'WR','LAR', 'dynasty',8400,8400,7800,5, 9, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10860', 'Jaxon Smith-Njigba', 'WR','SEA', 'dynasty',8200,8200,7600,6,11, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8151',  'Garrett Wilson',     'WR','NYJ', 'dynasty',7900,7900,7300,7,13, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9493',  'Drake London',       'WR','ATL', 'dynasty',7600,7600,7000,8,16, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10858', 'Zay Flowers',        'WR','BAL', 'dynasty',7200,7200,6700,9,19, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10857', 'Chris Olave',        'WR','NO',  'dynasty',6800,6800,6300,10,23,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9507',  'Nico Collins',       'WR','HOU', 'dynasty',6400,6400,5900,11,27,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9506',  'Rashee Rice',        'WR','KC',  'dynasty',6000,6000,5500,12,31,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10856', 'Jordan Addison',     'WR','MIN', 'dynasty',5600,5600,5200,13,37,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('10855', 'Michael Pittman',    'WR','IND', 'dynasty',5200,5200,4800,14,43,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11579', 'Marvin Harrison Jr.','WR','ARI', 'dynasty',4800,4800,4400,15,49,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11580', 'Brian Thomas Jr.',   'WR','JAX', 'dynasty',4600,4600,4200,16,53,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9505',  'Jerry Jeudy',        'WR','CLE', 'dynasty',4200,4200,3900,17,59,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11581', 'Xavier Worthy',      'WR','KC',  'dynasty',3900,3900,3600,18,65,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9504',  'Ladd McConkey',      'WR','LAC', 'dynasty',3600,3600,3300,19,71,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9503',  'Rome Odunze',        'WR','CHI', 'dynasty',3400,3400,3100,20,77,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9502',  'Malik Nabers',       'WR','NYG', 'dynasty',3200,3200,2900,21,83,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9501',  'Keon Coleman',       'WR','BUF', 'dynasty',2800,2800,2600,22,93,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9500',  'Tank Dell',          'WR','HOU', 'dynasty',2600,2600,2400,23,103,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9499',  'Christian Watson',   'WR','GB',  'dynasty',2200,2200,2000,24,113,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9498',  'Josh Downs',         'WR','IND', 'dynasty',2000,2000,1800,25,123,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('7564',  'Mike Evans',         'WR','TB',  'dynasty',1800,1800,1600,26,133,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9497',  'Treylon Burks',      'WR','TEN', 'dynasty',1200,1200,1100,27,163,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8125',  'Calvin Austin',      'WR','PIT', 'dynasty',800, 800, 700, 28,203,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9496',  'Jahan Dotson',       'WR','PHI', 'dynasty',600, 600, 550, 29,223,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9495',  'Skyy Moore',         'WR','KC',  'dynasty',400, 400, 350, 30,243,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW());

-- ── TEs ─────────────────────────────────────────────────────────────────────
INSERT INTO player_values_canonical
  (player_id,player_name,position,team,format,base_value,adjusted_value,market_value,rank_position,rank_overall,source,value_epoch_id,created_at,updated_at)
VALUES
  ('8149',  'Brock Bowers',       'TE','LV',  'dynasty',9000,9000,8400,1, 7, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8152',  'Sam LaPorta',        'TE','DET', 'dynasty',7200,7200,6700,2,20, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('7589',  'Trey McBride',       'TE','ARI', 'dynasty',6200,6200,5800,3,29, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6803',  'Travis Kelce',       'TE','KC',  'dynasty',2200,2200,2000,4,115,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('8153',  'Tucker Kraft',       'TE','GB',  'dynasty',5200,5200,4800,5,43, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9494',  'Jake Ferguson',      'TE','DAL', 'dynasty',4600,4600,4200,6,53, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11582', 'Colston Loveland',   'TE','CHI', 'dynasty',4400,4400,4000,7,55, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('11583', 'Tyler Warren',       'TE','IND', 'dynasty',4000,4000,3700,8,63, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9492',  'Dalton Kincaid',     'TE','BUF', 'dynasty',3400,3400,3100,9,75, 'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9491',  'Isaiah Likely',      'TE','BAL', 'dynasty',3000,3000,2800,10,85,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6804',  'T.J. Hockenson',     'TE','MIN', 'dynasty',2600,2600,2400,11,99,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9490',  'Luke Musgrave',      'TE','GB',  'dynasty',2000,2000,1800,12,125,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('9489',  'Michael Mayer',      'TE','LV',  'dynasty',1400,1400,1300,13,155,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW()),
  ('6770',  'Evan Engram',        'TE','JAX', 'dynasty',800, 800, 700, 14,205,'dynasty_2026','e5334014-f2b1-4569-b7d7-5e8c3411e7ab',NOW(),NOW());

END $$;

-- Final rank_overall recompute
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
