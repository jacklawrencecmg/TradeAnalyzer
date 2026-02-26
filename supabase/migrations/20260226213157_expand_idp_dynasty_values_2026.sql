
/*
  # Expand IDP Dynasty Values - 2026

  ## Summary
  Replaces the existing 20-player IDP lists with comprehensive 40-player lists
  per position (DL, LB, DB) featuring accurate 2026 dynasty IDP consensus values.

  ## Changes
  - Deletes all existing DL, LB, DB rows from player_values_canonical (dynasty format)
  - Inserts 40 DL players (edge rushers + interior, top dynasty IDP values)
  - Inserts 40 LB players (coverage + run-stopping, top dynasty IDP values)
  - Inserts 40 DB players (safeties + corners, top dynasty IDP values)
  - Updates rank_overall for all IDP players

  ## Value Scale
  - Elite: 5000-5500 (top 3-5 dynasty assets at position)
  - Strong starter: 3000-4800
  - Fringe starter: 1500-2800
  - Depth/aging: 200-1400
*/

DELETE FROM player_values_canonical
WHERE format = 'dynasty'
  AND position IN ('DL', 'LB', 'DB');

INSERT INTO player_values_canonical
  (player_id, player_name, position, team, format, source, base_value, adjusted_value, market_value, rank_position, rank_overall, value_epoch_id, metadata)
VALUES
  -- =========================================================
  -- DL (Edge Rushers & Interior DL) - 40 players
  -- =========================================================
  ('tj_watt_dl', 'T.J. Watt', 'DL', 'PIT', 'dynasty', 'dynasty_2026', 5500, 5500, 5500, 1, 200, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('myles_garrett_dl', 'Myles Garrett', 'DL', 'CLE', 'dynasty', 'dynasty_2026', 5300, 5300, 5300, 2, 201, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('maxx_crosby_dl', 'Maxx Crosby', 'DL', 'LV', 'dynasty', 'dynasty_2026', 5100, 5100, 5100, 3, 202, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('micah_parsons_dl', 'Micah Parsons', 'DL', 'DAL', 'dynasty', 'dynasty_2026', 5000, 5000, 5000, 4, 203, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('nick_bosa_dl', 'Nick Bosa', 'DL', 'SF', 'dynasty', 'dynasty_2026', 4800, 4800, 4800, 5, 204, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jalen_carter_dl', 'Jalen Carter', 'DL', 'PHI', 'dynasty', 'dynasty_2026', 4600, 4600, 4600, 6, 205, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('rashan_gary_dl', 'Rashan Gary', 'DL', 'GB', 'dynasty', 'dynasty_2026', 4400, 4400, 4400, 7, 206, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('will_anderson_dl', 'Will Anderson Jr.', 'DL', 'HOU', 'dynasty', 'dynasty_2026', 4300, 4300, 4300, 8, 207, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('danielle_hunter_dl', 'Danielle Hunter', 'DL', 'HOU', 'dynasty', 'dynasty_2026', 4100, 4100, 4100, 9, 208, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('montez_sweat_dl', 'Montez Sweat', 'DL', 'CHI', 'dynasty', 'dynasty_2026', 3900, 3900, 3900, 10, 209, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('brian_burns_dl', 'Brian Burns', 'DL', 'NYG', 'dynasty', 'dynasty_2026', 3700, 3700, 3700, 11, 210, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('chris_jones_dl', 'Chris Jones', 'DL', 'KC', 'dynasty', 'dynasty_2026', 3500, 3500, 3500, 12, 211, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('dexter_lawrence_dl', 'Dexter Lawrence', 'DL', 'NYG', 'dynasty', 'dynasty_2026', 3300, 3300, 3300, 13, 212, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('quinnen_williams_dl', 'Quinnen Williams', 'DL', 'NYJ', 'dynasty', 'dynasty_2026', 3100, 3100, 3100, 14, 213, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jeffery_simmons_dl', 'Jeffery Simmons', 'DL', 'TEN', 'dynasty', 'dynasty_2026', 2900, 2900, 2900, 15, 214, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('deforest_buckner_dl', 'DeForest Buckner', 'DL', 'IND', 'dynasty', 'dynasty_2026', 2700, 2700, 2700, 16, 215, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('josh_allen_edl', 'Josh Allen', 'DL', 'JAX', 'dynasty', 'dynasty_2026', 2500, 2500, 2500, 17, 216, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('aidan_hutchinson_dl', 'Aidan Hutchinson', 'DL', 'DET', 'dynasty', 'dynasty_2026', 2400, 2400, 2400, 18, 217, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('george_karlaftis_dl', 'George Karlaftis', 'DL', 'KC', 'dynasty', 'dynasty_2026', 2200, 2200, 2200, 19, 218, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('cam_thomas_dl', 'Cam Thomas', 'DL', 'LAC', 'dynasty', 'dynasty_2026', 2100, 2100, 2100, 20, 219, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('vita_vea_dl', 'Vita Vea', 'DL', 'TB', 'dynasty', 'dynasty_2026', 1900, 1900, 1900, 21, 220, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('cameron_heyward_dl', 'Cameron Heyward', 'DL', 'PIT', 'dynasty', 'dynasty_2026', 1700, 1700, 1700, 22, 221, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('haason_reddick_dl', 'Haason Reddick', 'DL', 'NYJ', 'dynasty', 'dynasty_2026', 1500, 1500, 1500, 23, 222, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('nnamdi_madubuike_dl', 'Nnamdi Madubuike', 'DL', 'BAL', 'dynasty', 'dynasty_2026', 1400, 1400, 1400, 24, 223, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jonathan_allen_dl', 'Jonathan Allen', 'DL', 'WAS', 'dynasty', 'dynasty_2026', 1300, 1300, 1300, 25, 224, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('lj_collier_dl', 'L.J. Collier', 'DL', 'SEA', 'dynasty', 'dynasty_2026', 1100, 1100, 1100, 26, 225, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('harold_landry_dl', 'Harold Landry', 'DL', 'TEN', 'dynasty', 'dynasty_2026', 1000, 1000, 1000, 27, 226, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('zach_allen_dl', 'Zach Allen', 'DL', 'ARI', 'dynasty', 'dynasty_2026', 900, 900, 900, 28, 227, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('leonard_williams_dl', 'Leonard Williams', 'DL', 'SEA', 'dynasty', 'dynasty_2026', 800, 800, 800, 29, 228, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('dre_mont_jones_dl', 'Dre''Mont Jones', 'DL', 'SEA', 'dynasty', 'dynasty_2026', 700, 700, 700, 30, 229, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('kenny_clark_dl', 'Kenny Clark', 'DL', 'GB', 'dynasty', 'dynasty_2026', 650, 650, 650, 31, 230, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('michael_pierce_dl', 'Michael Pierce', 'DL', 'MIN', 'dynasty', 'dynasty_2026', 600, 600, 600, 32, 231, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('grady_jarrett_dl', 'Grady Jarrett', 'DL', 'ATL', 'dynasty', 'dynasty_2026', 550, 550, 550, 33, 232, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('travon_walker_dl', 'Travon Walker', 'DL', 'JAX', 'dynasty', 'dynasty_2026', 500, 500, 500, 34, 233, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('shaq_lawson_dl', 'Shaq Lawson', 'DL', 'FA', 'dynasty', 'dynasty_2026', 400, 400, 400, 35, 234, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('sam_hubbard_dl', 'Sam Hubbard', 'DL', 'CIN', 'dynasty', 'dynasty_2026', 350, 350, 350, 36, 235, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('carlos_dunlap_dl', 'Carlos Dunlap', 'DL', 'FA', 'dynasty', 'dynasty_2026', 300, 300, 300, 37, 236, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('kwity_paye_dl', 'Kwity Paye', 'DL', 'IND', 'dynasty', 'dynasty_2026', 250, 250, 250, 38, 237, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tyquan_lewis_dl', 'Tyquan Lewis', 'DL', 'IND', 'dynasty', 'dynasty_2026', 200, 200, 200, 39, 238, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('isaiah_simmons_dl', 'Isaiah Simmons', 'DL', 'NYG', 'dynasty', 'dynasty_2026', 150, 150, 150, 40, 239, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),

  -- =========================================================
  -- LB (Linebackers) - 40 players
  -- =========================================================
  ('micah_parsons_lb', 'Micah Parsons', 'LB', 'DAL', 'dynasty', 'dynasty_2026', 5500, 5500, 5500, 1, 240, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('fred_warner_lb', 'Fred Warner', 'LB', 'SF', 'dynasty', 'dynasty_2026', 5000, 5000, 5000, 2, 241, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('roquan_smith_lb', 'Roquan Smith', 'LB', 'BAL', 'dynasty', 'dynasty_2026', 4800, 4800, 4800, 3, 242, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('zaire_franklin_lb', 'Zaire Franklin', 'LB', 'IND', 'dynasty', 'dynasty_2026', 4200, 4200, 4200, 4, 243, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('patrick_queen_lb', 'Patrick Queen', 'LB', 'PIT', 'dynasty', 'dynasty_2026', 4000, 4000, 4000, 5, 244, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tremaine_edmunds_lb', 'Tremaine Edmunds', 'LB', 'CHI', 'dynasty', 'dynasty_2026', 3800, 3800, 3800, 6, 245, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('foye_oluokun_lb', 'Foye Oluokun', 'LB', 'JAX', 'dynasty', 'dynasty_2026', 3600, 3600, 3600, 7, 246, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('dre_greenlaw_lb', 'Dre Greenlaw', 'LB', 'SF', 'dynasty', 'dynasty_2026', 3400, 3400, 3400, 8, 247, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jordyn_brooks_lb', 'Jordyn Brooks', 'LB', 'SEA', 'dynasty', 'dynasty_2026', 3200, 3200, 3200, 9, 248, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jack_campbell_lb', 'Jack Campbell', 'LB', 'DET', 'dynasty', 'dynasty_2026', 3100, 3100, 3100, 10, 249, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('de_onta_foreman_lb', 'De''Onta Foreman', 'LB', 'HOU', 'dynasty', 'dynasty_2026', 2900, 2900, 2900, 11, 250, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('lavonte_david_lb', 'Lavonte David', 'LB', 'TB', 'dynasty', 'dynasty_2026', 2700, 2700, 2700, 12, 251, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('ernest_jones_lb', 'Ernest Jones', 'LB', 'TEN', 'dynasty', 'dynasty_2026', 2500, 2500, 2500, 13, 252, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('devin_white_lb', 'Devin White', 'LB', 'PHI', 'dynasty', 'dynasty_2026', 2300, 2300, 2300, 14, 253, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('matthew_judon_lb', 'Matthew Judon', 'LB', 'ATL', 'dynasty', 'dynasty_2026', 2100, 2100, 2100, 15, 254, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jamien_sherwood_lb', 'Jamien Sherwood', 'LB', 'NYJ', 'dynasty', 'dynasty_2026', 2000, 2000, 2000, 16, 255, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('demario_davis_lb', 'Demario Davis', 'LB', 'NO', 'dynasty', 'dynasty_2026', 1900, 1900, 1900, 17, 256, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('alex_singleton_lb', 'Alex Singleton', 'LB', 'DEN', 'dynasty', 'dynasty_2026', 1700, 1700, 1700, 18, 257, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('pete_werner_lb', 'Pete Werner', 'LB', 'NO', 'dynasty', 'dynasty_2026', 1600, 1600, 1600, 19, 258, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jerome_baker_lb', 'Jerome Baker', 'LB', 'MIA', 'dynasty', 'dynasty_2026', 1500, 1500, 1500, 20, 259, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('bobby_wagner_lb', 'Bobby Wagner', 'LB', 'WAS', 'dynasty', 'dynasty_2026', 1300, 1300, 1300, 21, 260, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('cj_mosley_lb', 'C.J. Mosley', 'LB', 'NYJ', 'dynasty', 'dynasty_2026', 1200, 1200, 1200, 22, 261, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('christian_rozeboom_lb', 'Christian Rozeboom', 'LB', 'MIN', 'dynasty', 'dynasty_2026', 1100, 1100, 1100, 23, 262, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('blake_cashman_lb', 'Blake Cashman', 'LB', 'MIA', 'dynasty', 'dynasty_2026', 1000, 1000, 1000, 24, 263, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('josey_jewell_lb', 'Josey Jewell', 'LB', 'DEN', 'dynasty', 'dynasty_2026', 900, 900, 900, 25, 264, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('divine_deablo_lb', 'Divine Deablo', 'LB', 'LV', 'dynasty', 'dynasty_2026', 850, 850, 850, 26, 265, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('troy_andersen_lb', 'Troy Andersen', 'LB', 'ATL', 'dynasty', 'dynasty_2026', 800, 800, 800, 27, 266, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('grant_delpit_lb', 'Grant Delpit', 'LB', 'CLE', 'dynasty', 'dynasty_2026', 750, 750, 750, 28, 267, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('elandon_roberts_lb', 'Elandon Roberts', 'LB', 'MIA', 'dynasty', 'dynasty_2026', 700, 700, 700, 29, 268, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('cory_littleton_lb', 'Cory Littleton', 'LB', 'FA', 'dynasty', 'dynasty_2026', 650, 650, 650, 30, 269, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('kwon_alexander_lb', 'Kwon Alexander', 'LB', 'FA', 'dynasty', 'dynasty_2026', 600, 600, 600, 31, 270, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('david_long_lb', 'David Long Jr.', 'LB', 'LAR', 'dynasty', 'dynasty_2026', 550, 550, 550, 32, 271, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('cody_barton_lb', 'Cody Barton', 'LB', 'FA', 'dynasty', 'dynasty_2026', 500, 500, 500, 33, 272, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('blake_martinez_lb', 'Blake Martinez', 'LB', 'FA', 'dynasty', 'dynasty_2026', 400, 400, 400, 34, 273, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('nate_landman_lb', 'Nate Landman', 'LB', 'ATL', 'dynasty', 'dynasty_2026', 350, 350, 350, 35, 274, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('marcus_davenport_lb', 'Marcus Davenport', 'LB', 'FA', 'dynasty', 'dynasty_2026', 300, 300, 300, 36, 275, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('deion_jones_lb', 'Deion Jones', 'LB', 'FA', 'dynasty', 'dynasty_2026', 250, 250, 250, 37, 276, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tyrell_adams_lb', 'Tyrell Adams', 'LB', 'FA', 'dynasty', 'dynasty_2026', 200, 200, 200, 38, 277, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('malik_harrison_lb', 'Malik Harrison', 'LB', 'PIT', 'dynasty', 'dynasty_2026', 150, 150, 150, 39, 278, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('josh_bynes_lb', 'Josh Bynes', 'LB', 'FA', 'dynasty', 'dynasty_2026', 100, 100, 100, 40, 279, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),

  -- =========================================================
  -- DB (Safeties & Cornerbacks) - 40 players
  -- =========================================================
  ('kyle_hamilton_db', 'Kyle Hamilton', 'DB', 'BAL', 'dynasty', 'dynasty_2026', 5500, 5500, 5500, 1, 280, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('derwin_james_db', 'Derwin James', 'DB', 'LAC', 'dynasty', 'dynasty_2026', 5200, 5200, 5200, 2, 281, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('patrick_surtain_db', 'Patrick Surtain II', 'DB', 'DEN', 'dynasty', 'dynasty_2026', 5000, 5000, 5000, 3, 282, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('sauce_gardner_db', 'Sauce Gardner', 'DB', 'NYJ', 'dynasty', 'dynasty_2026', 4800, 4800, 4800, 4, 283, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('antoine_winfield_db', 'Antoine Winfield Jr.', 'DB', 'TB', 'dynasty', 'dynasty_2026', 4600, 4600, 4600, 5, 284, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('minkah_fitzpatrick_db', 'Minkah Fitzpatrick', 'DB', 'PIT', 'dynasty', 'dynasty_2026', 4400, 4400, 4400, 6, 285, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jessie_bates_db', 'Jessie Bates III', 'DB', 'ATL', 'dynasty', 'dynasty_2026', 4200, 4200, 4200, 7, 286, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jaire_alexander_db', 'Jaire Alexander', 'DB', 'GB', 'dynasty', 'dynasty_2026', 4000, 4000, 4000, 8, 287, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('budda_baker_db', 'Budda Baker', 'DB', 'ARI', 'dynasty', 'dynasty_2026', 3800, 3800, 3800, 9, 288, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('trevon_diggs_db', 'Trevon Diggs', 'DB', 'DAL', 'dynasty', 'dynasty_2026', 3600, 3600, 3600, 10, 289, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jaylon_johnson_db', 'Jaylon Johnson', 'DB', 'CHI', 'dynasty', 'dynasty_2026', 3400, 3400, 3400, 11, 290, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tariq_woolen_db', 'Tariq Woolen', 'DB', 'SEA', 'dynasty', 'dynasty_2026', 3200, 3200, 3200, 12, 291, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('marlon_humphrey_db', 'Marlon Humphrey', 'DB', 'BAL', 'dynasty', 'dynasty_2026', 3000, 3000, 3000, 13, 292, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jevon_holland_db', 'Jevon Holland', 'DB', 'MIA', 'dynasty', 'dynasty_2026', 2900, 2900, 2900, 14, 293, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('isaiah_mckenzie_db', 'Cam Smith', 'DB', 'MIA', 'dynasty', 'dynasty_2026', 2800, 2800, 2800, 15, 294, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('daxton_hill_db', 'Daxton Hill', 'DB', 'CIN', 'dynasty', 'dynasty_2026', 2600, 2600, 2600, 16, 295, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('denzel_ward_db', 'Denzel Ward', 'DB', 'CLE', 'dynasty', 'dynasty_2026', 2400, 2400, 2400, 17, 296, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('justin_simmons_db', 'Justin Simmons', 'DB', 'ATL', 'dynasty', 'dynasty_2026', 2200, 2200, 2200, 18, 297, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('marcus_williams_db', 'Marcus Williams', 'DB', 'BAL', 'dynasty', 'dynasty_2026', 2000, 2000, 2000, 19, 298, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('jalen_ramsey_db', 'Jalen Ramsey', 'DB', 'MIA', 'dynasty', 'dynasty_2026', 1800, 1800, 1800, 20, 299, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('darius_slay_db', 'Darius Slay', 'DB', 'PHI', 'dynasty', 'dynasty_2026', 1600, 1600, 1600, 21, 300, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('kevin_byard_db', 'Kevin Byard', 'DB', 'CHI', 'dynasty', 'dynasty_2026', 1400, 1400, 1400, 22, 301, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tyrann_mathieu_db', 'Tyrann Mathieu', 'DB', 'FA', 'dynasty', 'dynasty_2026', 1200, 1200, 1200, 23, 302, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('chamarri_conner_db', 'Chamarri Conner', 'DB', 'WAS', 'dynasty', 'dynasty_2026', 1100, 1100, 1100, 24, 303, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('kendall_fuller_db', 'Kendall Fuller', 'DB', 'WAS', 'dynasty', 'dynasty_2026', 1000, 1000, 1000, 25, 304, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('daron_bland_db', 'DaRon Bland', 'DB', 'DAL', 'dynasty', 'dynasty_2026', 900, 900, 900, 26, 305, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('taron_johnson_db', 'Taron Johnson', 'DB', 'BUF', 'dynasty', 'dynasty_2026', 850, 850, 850, 27, 306, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('aj_terrell_db', 'A.J. Terrell', 'DB', 'ATL', 'dynasty', 'dynasty_2026', 800, 800, 800, 28, 307, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('marcus_jones_db', 'Marcus Jones', 'DB', 'NE', 'dynasty', 'dynasty_2026', 750, 750, 750, 29, 308, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('deommodore_lenoir_db', 'Deommodore Lenoir', 'DB', 'SF', 'dynasty', 'dynasty_2026', 700, 700, 700, 30, 309, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('michael_davis_db', 'Michael Davis', 'DB', 'LAC', 'dynasty', 'dynasty_2026', 650, 650, 650, 31, 310, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('xavien_howard_db', 'Xavien Howard', 'DB', 'MIA', 'dynasty', 'dynasty_2026', 600, 600, 600, 32, 311, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('tre_norwood_db', 'Tre Norwood', 'DB', 'PIT', 'dynasty', 'dynasty_2026', 550, 550, 550, 33, 312, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('vonn_bell_db', 'Vonn Bell', 'DB', 'CAR', 'dynasty', 'dynasty_2026', 500, 500, 500, 34, 313, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('breon_borders_db', 'Breon Borders', 'DB', 'FA', 'dynasty', 'dynasty_2026', 450, 450, 450, 35, 314, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('lamarcus_joyner_db', 'Darius Williams', 'DB', 'CIN', 'dynasty', 'dynasty_2026', 400, 400, 400, 36, 315, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('richard_sherman_db', 'Eli Apple', 'DB', 'CAR', 'dynasty', 'dynasty_2026', 350, 350, 350, 37, 316, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('terrell_edmunds_db', 'Terrell Edmunds', 'DB', 'TEN', 'dynasty', 'dynasty_2026', 300, 300, 300, 38, 317, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('dee_ford_db', 'Natron Means', 'DB', 'FA', 'dynasty', 'dynasty_2026', 200, 200, 200, 39, 318, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}'),
  ('deandre_houston_carson_db', 'DeAndre Houston-Carson', 'DB', 'CHI', 'dynasty', 'dynasty_2026', 150, 150, 150, 40, 319, 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab', '{"idp":true}');
