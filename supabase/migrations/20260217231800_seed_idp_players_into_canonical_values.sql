/*
  # Seed IDP Players into player_values_canonical

  ## Summary
  The Top 1000 and Dynasty Rankings pages support IDP (Individual Defensive Players)
  but no IDP data existed in player_values_canonical / latest_player_values.
  This migration inserts the top 60 IDP players (DL, LB, DB) under the active epoch.

  ## Changes
  - Inserts top 20 LB, 20 DL, and 20 DB players
  - format = 'dynasty', tier values match the check constraint (elite/high/mid/low/depth/unranked)
  - Uses WHERE NOT EXISTS to be idempotent

  ## Security
  - No RLS changes needed; existing anon + authenticated SELECT policies apply to all positions
*/

DO $$
DECLARE
  active_epoch_id uuid;
BEGIN
  SELECT id INTO active_epoch_id
  FROM value_epochs
  WHERE status = 'active'
  ORDER BY epoch_number DESC
  LIMIT 1;

  IF active_epoch_id IS NULL THEN
    RAISE EXCEPTION 'No active epoch found';
  END IF;

  INSERT INTO player_values_canonical
    (player_id, player_name, position, team, base_value, adjusted_value, market_value,
     rank_overall, rank_position, tier, value_epoch_id, source, confidence_score, format)
  SELECT v.player_id, v.player_name, v.position, v.team,
         v.base_value::numeric, v.adjusted_value::numeric, v.market_value::numeric,
         v.rank_overall::integer, v.rank_position::integer, v.tier, active_epoch_id,
         'manual_seed', v.confidence_score::numeric, 'dynasty'
  FROM (VALUES
    -- LB
    ('micah_parsons_lb',       'Micah Parsons',        'LB', 'DAL', 5200, 5200, 5100, 0, 1,  'elite', 0.90),
    ('fred_warner_lb',         'Fred Warner',          'LB', 'SF',  4800, 4800, 4700, 0, 2,  'elite', 0.88),
    ('roquan_smith_lb',        'Roquan Smith',         'LB', 'BAL', 4500, 4500, 4400, 0, 3,  'elite', 0.87),
    ('zaire_franklin_lb',      'Zaire Franklin',       'LB', 'IND', 3800, 3800, 3700, 0, 4,  'high',  0.84),
    ('patrick_queen_lb',       'Patrick Queen',        'LB', 'PIT', 3600, 3600, 3500, 0, 5,  'high',  0.83),
    ('tremaine_edmunds_lb',    'Tremaine Edmunds',     'LB', 'CHI', 3400, 3400, 3300, 0, 6,  'high',  0.82),
    ('foye_oluokun_lb',        'Foye Oluokun',         'LB', 'JAX', 3200, 3200, 3100, 0, 7,  'high',  0.81),
    ('jordyn_brooks_lb',       'Jordyn Brooks',        'LB', 'MIA', 3000, 3000, 2900, 0, 8,  'high',  0.80),
    ('dre_greenlaw_lb',        'Dre Greenlaw',         'LB', 'SF',  2800, 2800, 2700, 0, 9,  'mid',   0.78),
    ('lavonte_david_lb',       'Lavonte David',        'LB', 'TB',  2600, 2600, 2500, 0, 10, 'mid',   0.76),
    ('devin_white_lb',         'Devin White',          'LB', 'PHI', 2400, 2400, 2300, 0, 11, 'mid',   0.75),
    ('ernest_jones_lb',        'Ernest Jones',         'LB', 'TEN', 2200, 2200, 2100, 0, 12, 'mid',   0.74),
    ('demario_davis_lb',       'Demario Davis',        'LB', 'NO',  2000, 2000, 1900, 0, 13, 'mid',   0.72),
    ('alex_singleton_lb',      'Alex Singleton',       'LB', 'DEN', 1800, 1800, 1700, 0, 14, 'low',   0.70),
    ('jerome_baker_lb',        'Jerome Baker',         'LB', 'SEA', 1600, 1600, 1500, 0, 15, 'low',   0.68),
    ('bobby_wagner_lb',        'Bobby Wagner',         'LB', 'WAS', 1500, 1500, 1400, 0, 16, 'low',   0.65),
    ('cj_mosley_lb',           'C.J. Mosley',          'LB', 'NYJ', 1400, 1400, 1300, 0, 17, 'low',   0.63),
    ('cody_barton_lb',         'Cody Barton',          'LB', 'DEN', 1200, 1200, 1100, 0, 18, 'low',   0.60),
    ('kwon_alexander_lb',      'Kwon Alexander',       'LB', 'NO',  1000, 1000,  900, 0, 19, 'depth', 0.55),
    ('blake_martinez_lb',      'Blake Martinez',       'LB', 'FA',   800,  800,  700, 0, 20, 'depth', 0.50),
    -- DL
    ('tj_watt_dl',             'T.J. Watt',            'DL', 'PIT', 5000, 5000, 4900, 0, 1,  'elite', 0.92),
    ('myles_garrett_dl',       'Myles Garrett',        'DL', 'CLE', 4800, 4800, 4700, 0, 2,  'elite', 0.91),
    ('nick_bosa_dl',           'Nick Bosa',            'DL', 'SF',  4600, 4600, 4500, 0, 3,  'elite', 0.90),
    ('maxx_crosby_dl',         'Maxx Crosby',          'DL', 'LV',  4400, 4400, 4300, 0, 4,  'elite', 0.89),
    ('danielle_hunter_dl',     'Danielle Hunter',      'DL', 'HOU', 4200, 4200, 4100, 0, 5,  'elite', 0.88),
    ('rashan_gary_dl',         'Rashan Gary',          'DL', 'GB',  4000, 4000, 3900, 0, 6,  'high',  0.86),
    ('jalen_carter_dl',        'Jalen Carter',         'DL', 'PHI', 3800, 3800, 3700, 0, 7,  'high',  0.85),
    ('montez_sweat_dl',        'Montez Sweat',         'DL', 'CHI', 3600, 3600, 3500, 0, 8,  'high',  0.84),
    ('brian_burns_dl',         'Brian Burns',          'DL', 'NYG', 3400, 3400, 3300, 0, 9,  'high',  0.83),
    ('chris_jones_dl',         'Chris Jones',          'DL', 'KC',  3200, 3200, 3100, 0, 10, 'high',  0.82),
    ('dexter_lawrence_dl',     'Dexter Lawrence',      'DL', 'NYG', 3000, 3000, 2900, 0, 11, 'high',  0.80),
    ('quinnen_williams_dl',    'Quinnen Williams',     'DL', 'NYJ', 2800, 2800, 2700, 0, 12, 'mid',   0.78),
    ('jeffery_simmons_dl',     'Jeffery Simmons',      'DL', 'TEN', 2600, 2600, 2500, 0, 13, 'mid',   0.76),
    ('deforest_buckner_dl',    'DeForest Buckner',     'DL', 'IND', 2400, 2400, 2300, 0, 14, 'mid',   0.74),
    ('vita_vea_dl',            'Vita Vea',             'DL', 'TB',  2200, 2200, 2100, 0, 15, 'mid',   0.72),
    ('josh_allen_edl',         'Josh Allen',           'DL', 'JAX', 2000, 2000, 1900, 0, 16, 'mid',   0.70),
    ('haason_reddick_dl',      'Haason Reddick',       'DL', 'NYJ', 1800, 1800, 1700, 0, 17, 'low',   0.68),
    ('cameron_heyward_dl',     'Cameron Heyward',      'DL', 'PIT', 1600, 1600, 1500, 0, 18, 'low',   0.65),
    ('zach_allen_dl',          'Zach Allen',           'DL', 'DEN', 1400, 1400, 1300, 0, 19, 'low',   0.62),
    ('michael_pierce_dl',      'Michael Pierce',       'DL', 'MIN', 1200, 1200, 1100, 0, 20, 'low',   0.58),
    -- DB
    ('derwin_james_db',        'Derwin James',         'DB', 'LAC', 5000, 5000, 4900, 0, 1,  'elite', 0.91),
    ('kyle_hamilton_db',       'Kyle Hamilton',        'DB', 'BAL', 4800, 4800, 4700, 0, 2,  'elite', 0.90),
    ('antoine_winfield_db',    'Antoine Winfield Jr.', 'DB', 'TB',  4600, 4600, 4500, 0, 3,  'elite', 0.89),
    ('patrick_surtain_db',     'Patrick Surtain II',   'DB', 'DEN', 4400, 4400, 4300, 0, 4,  'elite', 0.88),
    ('sauce_gardner_db',       'Sauce Gardner',        'DB', 'NYJ', 4200, 4200, 4100, 0, 5,  'elite', 0.87),
    ('jessie_bates_db',        'Jessie Bates III',     'DB', 'ATL', 4000, 4000, 3900, 0, 6,  'high',  0.85),
    ('minkah_fitzpatrick_db',  'Minkah Fitzpatrick',   'DB', 'PIT', 3800, 3800, 3700, 0, 7,  'high',  0.84),
    ('jaire_alexander_db',     'Jaire Alexander',      'DB', 'GB',  3600, 3600, 3500, 0, 8,  'high',  0.83),
    ('budda_baker_db',         'Budda Baker',          'DB', 'ARI', 3400, 3400, 3300, 0, 9,  'high',  0.82),
    ('trevon_diggs_db',        'Trevon Diggs',         'DB', 'DAL', 3200, 3200, 3100, 0, 10, 'high',  0.80),
    ('marlon_humphrey_db',     'Marlon Humphrey',      'DB', 'BAL', 3000, 3000, 2900, 0, 11, 'high',  0.78),
    ('justin_simmons_db',      'Justin Simmons',       'DB', 'ATL', 2800, 2800, 2700, 0, 12, 'mid',   0.76),
    ('kevin_byard_db',         'Kevin Byard',          'DB', 'CHI', 2600, 2600, 2500, 0, 13, 'mid',   0.74),
    ('jalen_ramsey_db',        'Jalen Ramsey',         'DB', 'MIA', 2400, 2400, 2300, 0, 14, 'mid',   0.72),
    ('darius_slay_db',         'Darius Slay',          'DB', 'PHI', 2200, 2200, 2100, 0, 15, 'mid',   0.70),
    ('jaylon_johnson_db',      'Jaylon Johnson',       'DB', 'CHI', 2000, 2000, 1900, 0, 16, 'mid',   0.68),
    ('tariq_woolen_db',        'Tariq Woolen',         'DB', 'SEA', 1800, 1800, 1700, 0, 17, 'low',   0.66),
    ('denzel_ward_db',         'Denzel Ward',          'DB', 'CLE', 1600, 1600, 1500, 0, 18, 'low',   0.64),
    ('daron_bland_db',         'DaRon Bland',          'DB', 'DAL', 1400, 1400, 1300, 0, 19, 'low',   0.62),
    ('taron_johnson_db',       'Taron Johnson',        'DB', 'BUF', 1200, 1200, 1100, 0, 20, 'low',   0.60)
  ) AS v(player_id, player_name, position, team, base_value, adjusted_value, market_value,
         rank_overall, rank_position, tier, confidence_score)
  WHERE NOT EXISTS (
    SELECT 1 FROM player_values_canonical pvc
    WHERE pvc.player_id = v.player_id
      AND pvc.value_epoch_id = active_epoch_id
      AND pvc.format = 'dynasty'
      AND pvc.league_profile_id IS NULL
  );

END $$;
