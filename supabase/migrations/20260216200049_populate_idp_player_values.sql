/*
  # Populate IDP Player Values

  ## Overview
  Seeds the database with top IDP (Individual Defensive Player) values for DL, LB, and DB positions.
  
  ## Data Populated
  - Top 20 Linebackers (LB)
  - Top 20 Defensive Linemen (DL)  
  - Top 20 Defensive Backs (DB)

  ## Values
  - Base values (ktc_value) are manually set based on market consensus
  - FDP values are calculated as base_value * 1.1 (10% premium for IDP)
  - All values are for dynasty_sf format with balanced scoring preset
  - Source is marked as 'manual_seed' for initial population

  ## Security
  - No RLS changes needed
  - Migration runs with elevated privileges to bypass INSERT restrictions
*/

-- Populate Linebackers (LB)
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, scoring_preset, source, captured_at) VALUES
  ('micah_parsons_lb', 'Micah Parsons', 'LB', 'DAL', 1, 5200, 5720, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('fred_warner_lb', 'Fred Warner', 'LB', 'SF', 2, 4800, 5280, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('roquan_smith_lb', 'Roquan Smith', 'LB', 'BAL', 3, 4500, 4950, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('bobby_wagner_lb', 'Bobby Wagner', 'LB', 'WAS', 4, 3200, 3520, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('cj_mosley_lb', 'C.J. Mosley', 'LB', 'NYJ', 5, 3100, 3410, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('foye_oluokun_lb', 'Foye Oluokun', 'LB', 'JAX', 6, 3000, 3300, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('zaire_franklin_lb', 'Zaire Franklin', 'LB', 'IND', 7, 2900, 3190, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('patrick_queen_lb', 'Patrick Queen', 'LB', 'PIT', 8, 2800, 3080, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('tremaine_edmunds_lb', 'Tremaine Edmunds', 'LB', 'CHI', 9, 2700, 2970, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('cole_holcomb_lb', 'Cole Holcomb', 'LB', 'PIT', 10, 2600, 2860, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jordyn_brooks_lb', 'Jordyn Brooks', 'LB', 'MIA', 11, 2500, 2750, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('lavonte_david_lb', 'Lavonte David', 'LB', 'TB', 12, 2400, 2640, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('dre_greenlaw_lb', 'Dre Greenlaw', 'LB', 'SF', 13, 2300, 2530, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('devin_white_lb', 'Devin White', 'LB', 'PHI', 14, 2200, 2420, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('ernest_jones_lb', 'Ernest Jones', 'LB', 'TEN', 15, 2100, 2310, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('demario_davis_lb', 'Demario Davis', 'LB', 'NO', 16, 2000, 2200, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('alex_singleton_lb', 'Alex Singleton', 'LB', 'DEN', 17, 1900, 2090, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('foyesade_oluokun_lb', 'Foyesade Oluokun', 'LB', 'JAX', 18, 1850, 2035, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('cody_barton_lb', 'Cody Barton', 'LB', 'DEN', 19, 1800, 1980, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jerome_baker_lb', 'Jerome Baker', 'LB', 'SEA', 20, 1750, 1925, 'dynasty_sf', 'balanced', 'manual_seed', NOW());

-- Populate Defensive Line (DL)
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, scoring_preset, source, captured_at) VALUES
  ('tj_watt_dl', 'T.J. Watt', 'DL', 'PIT', 1, 4800, 5280, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('myles_garrett_dl', 'Myles Garrett', 'DL', 'CLE', 2, 4500, 4950, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('nick_bosa_dl', 'Nick Bosa', 'DL', 'SF', 3, 4200, 4620, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('maxx_crosby_dl', 'Maxx Crosby', 'DL', 'LV', 4, 4000, 4400, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('danielle_hunter_dl', 'Danielle Hunter', 'DL', 'HOU', 5, 3800, 4180, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('josh_allen_dl', 'Josh Allen', 'DL', 'JAX', 6, 3600, 3960, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('rashan_gary_dl', 'Rashan Gary', 'DL', 'GB', 7, 3400, 3740, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('brian_burns_dl', 'Brian Burns', 'DL', 'NYG', 8, 3300, 3630, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('montez_sweat_dl', 'Montez Sweat', 'DL', 'CHI', 9, 3200, 3520, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('josh_hinesallen_dl', 'Josh Hines-Allen', 'DL', 'JAX', 10, 3100, 3410, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('chris_jones_dl', 'Chris Jones', 'DL', 'KC', 11, 3000, 3300, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('dexter_lawrence_dl', 'Dexter Lawrence', 'DL', 'NYG', 12, 2900, 3190, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('quinnen_williams_dl', 'Quinnen Williams', 'DL', 'NYJ', 13, 2800, 3080, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jeffery_simmons_dl', 'Jeffery Simmons', 'DL', 'TEN', 14, 2700, 2970, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jalen_carter_dl', 'Jalen Carter', 'DL', 'PHI', 15, 2600, 2860, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('deforest_buckner_dl', 'DeForest Buckner', 'DL', 'IND', 16, 2500, 2750, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('vita_vea_dl', 'Vita Vea', 'DL', 'TB', 17, 2400, 2640, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('zach_allen_dl', 'Zach Allen', 'DL', 'DEN', 18, 2300, 2530, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('haason_reddick_dl', 'Haason Reddick', 'DL', 'NYJ', 19, 2200, 2420, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('cameron_heyward_dl', 'Cameron Heyward', 'DL', 'PIT', 20, 2100, 2310, 'dynasty_sf', 'balanced', 'manual_seed', NOW());

-- Populate Defensive Backs (DB)
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, scoring_preset, source, captured_at) VALUES
  ('derwin_james_db', 'Derwin James', 'DB', 'LAC', 1, 4200, 4620, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('antoine_winfield_jr_db', 'Antoine Winfield Jr.', 'DB', 'TB', 2, 4000, 4400, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('kyle_hamilton_db', 'Kyle Hamilton', 'DB', 'BAL', 3, 3800, 4180, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jessie_bates_iii_db', 'Jessie Bates III', 'DB', 'ATL', 4, 3600, 3960, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('minkah_fitzpatrick_db', 'Minkah Fitzpatrick', 'DB', 'PIT', 5, 3400, 3740, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('budda_baker_db', 'Budda Baker', 'DB', 'ARI', 6, 3200, 3520, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('justin_simmons_db', 'Justin Simmons', 'DB', 'ATL', 7, 3000, 3300, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('kevin_byard_db', 'Kevin Byard', 'DB', 'CHI', 8, 2900, 3190, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jalen_ramsey_db', 'Jalen Ramsey', 'DB', 'MIA', 9, 2800, 3080, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('patrick_surtain_ii_db', 'Patrick Surtain II', 'DB', 'DEN', 10, 2700, 2970, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('sauce_gardner_db', 'Sauce Gardner', 'DB', 'NYJ', 11, 2600, 2860, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jaire_alexander_db', 'Jaire Alexander', 'DB', 'GB', 12, 2500, 2750, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('trevon_diggs_db', 'Trevon Diggs', 'DB', 'DAL', 13, 2400, 2640, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('marlon_humphrey_db', 'Marlon Humphrey', 'DB', 'BAL', 14, 2300, 2530, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('darius_slay_db', 'Darius Slay', 'DB', 'PHI', 15, 2200, 2420, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('jaylon_johnson_db', 'Jaylon Johnson', 'DB', 'CHI', 16, 2100, 2310, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('denzel_ward_db', 'Denzel Ward', 'DB', 'CLE', 17, 2000, 2200, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('tariq_woolen_db', 'Tariq Woolen', 'DB', 'SEA', 18, 1900, 2090, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('taron_johnson_db', 'Taron Johnson', 'DB', 'BUF', 19, 1800, 1980, 'dynasty_sf', 'balanced', 'manual_seed', NOW()),
  ('daron_bland_db', 'DaRon Bland', 'DB', 'DAL', 20, 1750, 1925, 'dynasty_sf', 'balanced', 'manual_seed', NOW());
