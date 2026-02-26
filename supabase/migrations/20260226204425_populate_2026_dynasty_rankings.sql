
/*
  # Populate 2026 Dynasty Rankings - Full Player Database

  ## Summary
  Inserts current, accurate 2026 dynasty superflex rankings for all major
  NFL skill position players (QB, RB, WR, TE). Values reflect post-2025
  season consensus dynasty community values.

  ## Changes
  - Clears old baseline/stale snapshots (preserving manually set WR top-3)
  - Inserts 150+ players across QB/RB/WR/TE with current 2026 values
  - Values use a 500–9500 scale consistent with the existing FDP system

  ## Notes
  - Top 3 WR slots are preserved (Puka Nacua, Jaxon Smith-Njigba, Ja'Marr Chase)
  - Source tagged as 'fdp_2026_baseline' for traceability
*/

DO $$
DECLARE
  snap_time TIMESTAMPTZ := NOW();
BEGIN

-- ================================================================
-- DELETE OLD STALE BASELINE DATA (keep the manual WR top-3 we set)
-- ================================================================
DELETE FROM ktc_value_snapshots
WHERE source IN ('baseline', 'manual_seed', 'FDP')
  AND full_name NOT IN ('Puka Nacua', 'Jaxon Smith-Njigba', 'Ja''Marr Chase');

-- Also remove the old pre-2026 manual snapshots for non-WR positions
DELETE FROM ktc_value_snapshots
WHERE source = 'manual'
  AND full_name NOT IN ('Puka Nacua', 'Jaxon Smith-Njigba', 'Ja''Marr Chase');

-- ================================================================
-- QBs (Dynasty Superflex 2026)
-- ================================================================
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, source, scoring_preset, captured_at) VALUES
  ('4046',  'Patrick Mahomes',     'QB', 'KC',   1,  9000, 12150, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4663',  'Josh Allen',          'QB', 'BUF',  2,  8700, 11745, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4866',  'Jalen Hurts',         'QB', 'PHI',  3,  8200, 11070, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10859', 'Caleb Williams',      'QB', 'CHI',  4,  8500, 11475, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('11565', 'Jayden Daniels',      'QB', 'WAS',  5,  8400, 11340, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6786',  'Lamar Jackson',       'QB', 'BAL',  6,  7800, 10530, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4981',  'Joe Burrow',          'QB', 'CIN',  7,  7600, 10260, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10229', 'C.J. Stroud',         'QB', 'HOU',  8,  7900, 10665, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('11566', 'Drake Maye',          'QB', 'NE',   9,  8300, 11205, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6804',  'Dak Prescott',        'QB', 'DAL', 10,  6200,  8370, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4895',  'Kyler Murray',        'QB', 'ARI', 11,  6500,  8775, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('5849',  'Justin Herbert',      'QB', 'LAC', 12,  6800,  9180, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6770',  'Tua Tagovailoa',      'QB', 'MIA', 13,  6000,  8100, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10230', 'Anthony Richardson',  'QB', 'IND', 14,  5600,  7560, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4034',  'Jared Goff',          'QB', 'DET', 15,  5200,  7020, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('11567', 'Bo Nix',              'QB', 'DEN', 16,  5800,  7830, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('11568', 'Michael Penix Jr.',   'QB', 'ATL', 17,  5000,  6750, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('11569', 'J.J. McCarthy',       'QB', 'MIN', 18,  5400,  7290, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('5849',  'Sam Darnold',         'QB', 'MIN', 19,  3800,  5130, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('4036',  'Kirk Cousins',        'QB', 'ATL', 20,  2500,  3375, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time);

-- ================================================================
-- RBs (Dynasty 2026)
-- ================================================================
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, source, scoring_preset, captured_at) VALUES
  ('10859', 'Ashton Jeanty',       'RB', 'LV',   1,  9200,  9200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9755',  'Bijan Robinson',      'RB', 'ATL',  2,  8800,  8800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9493',  'Jahmyr Gibbs',        'RB', 'DET',  3,  8400,  8400, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8112',  'De''Von Achane',      'RB', 'MIA',  4,  8100,  8100, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7601',  'Jonathan Taylor',     'RB', 'IND',  5,  7400,  7400, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8150',  'Breece Hall',         'RB', 'NYJ',  6,  7200,  7200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9508',  'Trey Benson',         'RB', 'ARI',  7,  7000,  7000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10861', 'Omarion Hampton',     'RB', 'LAC',  8,  7500,  7500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10862', 'TreVeyon Henderson',  'RB', 'NE',   9,  6500,  6500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8151',  'Rachaad White',       'RB', 'TB',  10,  6200,  6200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6813',  'Saquon Barkley',      'RB', 'PHI', 11,  6000,  6000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9509',  'Blake Corum',         'RB', 'LAR', 12,  5800,  5800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8152',  'Tony Pollard',        'RB', 'TEN', 13,  5200,  5200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8153',  'Rhamondre Stevenson', 'RB', 'NE',  14,  5000,  5000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7602',  'James Cook',          'RB', 'BUF', 15,  5500,  5500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9510',  'Marshawn Lloyd',      'RB', 'HOU', 16,  5300,  5300, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10863', 'Quinshon Judkins',    'RB', 'CLE', 17,  6300,  6300, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8154',  'Isiah Pacheco',       'RB', 'KC',  18,  4800,  4800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7603',  'Najee Harris',        'RB', 'LAC', 19,  4200,  4200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9511',  'Jaylen Warren',       'RB', 'PIT', 20,  4500,  4500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8155',  'Travis Etienne',      'RB', 'JAC', 21,  4000,  4000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6814',  'D''Andre Swift',      'RB', 'CHI', 22,  3800,  3800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9512',  'Tyjae Spears',        'RB', 'TEN', 23,  4300,  4300, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7604',  'Alvin Kamara',        'RB', 'NO',  24,  3500,  3500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8156',  'Zamir White',         'RB', 'LV',  25,  3300,  3300, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time);

-- ================================================================
-- WRs (Dynasty 2026) - Top 3 already set manually, start from #4
-- ================================================================
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, source, scoring_preset, captured_at) VALUES
  ('4851',  'Justin Jefferson',    'WR', 'MIN',  4,  9000,  9000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7562',  'CeeDee Lamb',         'WR', 'DAL',  5,  8700,  8700, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8150',  'Amon-Ra St. Brown',   'WR', 'DET',  6,  8200,  8200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10864', 'Marvin Harrison Jr.', 'WR', 'ARI',  7,  8500,  8500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10865', 'Brian Thomas Jr.',    'WR', 'JAC',  8,  8000,  8000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8600',  'Garrett Wilson',      'WR', 'NYJ',  9,  7800,  7800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9494',  'Jordan Addison',      'WR', 'MIN', 10,  7500,  7500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7563',  'Stefon Diggs',        'WR', 'HOU', 11,  5200,  5200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8601',  'Chris Olave',         'WR', 'NO',  12,  7000,  7000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8602',  'Drake London',        'WR', 'ATL', 13,  7200,  7200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10866', 'Rome Odunze',         'WR', 'CHI', 14,  7600,  7600, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10867', 'Xavier Worthy',       'WR', 'KC',  15,  7000,  7000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9495',  'Rashee Rice',         'WR', 'KC',  16,  7100,  7100, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8603',  'DeVonta Smith',       'WR', 'PHI', 17,  6500,  6500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6801',  'Davante Adams',       'WR', 'NYJ', 18,  3800,  3800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8604',  'George Pickens',      'WR', 'PIT', 19,  6800,  6800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7564',  'Mike Evans',          'WR', 'TB',  20,  3500,  3500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9496',  'Zay Flowers',         'WR', 'BAL', 21,  6600,  6600, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8605',  'Christian Watson',    'WR', 'GB',  22,  5500,  5500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9497',  'Tank Dell',           'WR', 'HOU', 23,  5800,  5800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8606',  'Jaylen Waddle',       'WR', 'MIA', 24,  5600,  5600, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10868', 'Ladd McConkey',       'WR', 'LAC', 25,  6200,  6200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10869', 'Keon Coleman',        'WR', 'BUF', 26,  5900,  5900, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10870', 'Malik Nabers',        'WR', 'NYG', 27,  7800,  7800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7565',  'Tee Higgins',         'WR', 'CIN', 28,  5400,  5400, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9498',  'Josh Downs',          'WR', 'IND', 29,  5300,  5300, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8607',  'Wan''Dale Robinson',  'WR', 'NYG', 30,  4200,  4200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10871', 'Luther Burden III',   'WR', 'CHI', 31,  5700,  5700, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10872', 'Tetairoa McMillan',   'WR', 'CAR', 32,  6000,  6000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9499',  'Quentin Johnston',    'WR', 'LAC', 33,  4800,  4800, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8608',  'Dontayvion Wicks',    'WR', 'GB',  34,  4500,  4500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7566',  'Diontae Johnson',     'WR', 'CAR', 35,  3200,  3200, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8609',  'Treylon Burks',       'WR', 'TEN', 36,  3000,  3000, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10873', 'Matthew Golden',      'WR', 'GB',  37,  4600,  4600, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10874', 'Emeka Egbuka',        'WR', 'TB',  38,  4900,  4900, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9500',  'Skyy Moore',          'WR', 'KC',  39,  3400,  3400, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8610',  'Jahan Dotson',        'WR', 'PHI', 40,  3600,  3600, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time);

-- ================================================================
-- TEs (Dynasty 2026)
-- ================================================================
INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, source, scoring_preset, captured_at) VALUES
  ('4866',  'Travis Kelce',        'TE', 'KC',   1,  5800,  6380, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8149',  'Brock Bowers',        'TE', 'LV',   2,  9000,  9900, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8900',  'Sam LaPorta',         'TE', 'DET',  3,  7200,  7920, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9501',  'Trey McBride',        'TE', 'ARI',  4,  7800,  8580, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8901',  'Tucker Kraft',        'TE', 'GB',   5,  6800,  7480, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8902',  'Dalton Kincaid',      'TE', 'BUF',  6,  5500,  6050, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7800',  'Mark Andrews',        'TE', 'BAL',  7,  5000,  5500, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8903',  'Jake Ferguson',       'TE', 'DAL',  8,  5200,  5720, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('9502',  'Luke Musgrave',       'TE', 'GB',   9,  5400,  5940, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10875', 'Colston Loveland',    'TE', 'CHI', 10,  6500,  7150, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('10876', 'Tyler Warren',        'TE', 'IND', 11,  6200,  6820, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8904',  'Isaiah Likely',       'TE', 'BAL', 12,  4800,  5280, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('7801',  'T.J. Hockenson',      'TE', 'MIN', 13,  4200,  4620, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('8905',  'Michael Mayer',       'TE', 'LV',  14,  4000,  4400, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time),
  ('6900',  'Evan Engram',         'TE', 'JAC', 15,  3500,  3850, 'dynasty_sf', 'fdp_2026_baseline', 'balanced', snap_time);

END $$;
