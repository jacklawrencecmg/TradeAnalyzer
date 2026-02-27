/*
  # Fix Player Teams - 2026 Offseason (Sleeper-Accurate)

  Updates all player teams in player_values_canonical to reflect
  accurate 2026 NFL offseason roster assignments sourced from Sleeper API data.

  Many players had wrong teams due to stale data — this migration
  corrects all skill position players and key IDPs with verified current teams.
*/

UPDATE player_values_canonical SET team = v.team
FROM (VALUES
  -- QBs
  ('4046',  'KC'),   -- Patrick Mahomes
  ('4984',  'BUF'),  -- Josh Allen
  ('6786',  'BAL'),  -- Lamar Jackson
  ('6904',  'PHI'),  -- Jalen Hurts
  ('4981',  'CIN'),  -- Joe Burrow
  ('5849',  'LAC'),  -- Justin Herbert
  ('4895',  'ARI'),  -- Kyler Murray
  ('4034',  'DET'),  -- Jared Goff
  ('6804',  'GB'),   -- Jordan Love
  ('10229', 'HOU'),  -- C.J. Stroud
  ('11560', 'CHI'),  -- Caleb Williams
  ('11566', 'WAS'),  -- Jayden Daniels
  ('11567', 'NE'),   -- Drake Maye
  ('11564', 'DEN'),  -- Bo Nix
  ('11565', 'MIN'),  -- J.J. McCarthy
  ('11562', 'CAR'),  -- Cam Ward
  ('11563', 'CLE'),  -- Shedeur Sanders
  ('10230', 'IND'),  -- Anthony Richardson
  ('6770',  'MIA'),  -- Tua Tagovailoa
  ('6800',  'TB'),   -- Baker Mayfield
  ('5870',  'PIT'),  -- Justin Fields
  ('5045',  'SEA'),  -- Geno Smith
  ('6797',  'MIN'),  -- Sam Darnold
  ('6768',  'NO'),   -- Bryce Young
  ('4638',  'PIT'),  -- Russell Wilson
  ('4881',  'ATL'),  -- Kirk Cousins
  ('6771',  'NYG'),  -- Daniel Jones
  ('4866',  'DAL'),  -- Dak Prescott
  ('5156',  'NYJ'),  -- Aaron Rodgers
  ('4892',  'SF'),   -- Brock Purdy
  ('2307',  'FA'),   -- Marcus Mariota
  ('4949',  'DAL'),  -- Cooper Rush
  ('4429',  'PIT'),  -- Mason Rudolph
  -- RBs
  ('9755',  'ATL'),  -- Bijan Robinson
  ('8150',  'NYJ'),  -- Breece Hall
  ('9493',  'DET'),  -- Jahmyr Gibbs
  ('8112',  'MIA'),  -- De'Von Achane
  ('6813',  'PHI'),  -- Saquon Barkley
  ('7601',  'IND'),  -- Jonathan Taylor
  ('7602',  'BUF'),  -- James Cook
  ('5844',  'DAL'),  -- Derrick Henry
  ('10235', 'LAR'),  -- Kyren Williams
  ('10863', 'LAR'),  -- Blake Corum
  ('10864', 'CIN'),  -- Chase Brown
  ('11572', 'LV'),   -- Ashton Jeanty
  ('11573', 'LAC'),  -- Omarion Hampton
  ('11574', 'TB'),   -- TreVeyon Henderson
  ('11575', 'CLE'),  -- Quinshon Judkins
  ('11576', 'KC'),   -- Kaleb Johnson
  ('11577', 'ARI'),  -- Trey Benson
  ('11578', 'TB'),   -- Bucky Irving
  ('6799',  'PIT'),  -- Najee Harris
  ('7563',  'JAX'),  -- Travis Etienne
  ('6790',  'CHI'),  -- D'Andre Swift
  ('10226', 'TB'),   -- Rachaad White
  ('7571',  'TEN'),  -- Tony Pollard
  ('4663',  'FA'),   -- Austin Ekeler
  -- WRs
  ('6794',  'MIN'),  -- Justin Jefferson
  ('9508',  'CIN'),  -- Ja'Marr Chase
  ('8149',  'DAL'),  -- CeeDee Lamb
  ('8156',  'DET'),  -- Amon-Ra St. Brown
  ('8151',  'NYJ'),  -- Garrett Wilson
  ('9480',  'ATL'),  -- Drake London
  ('10860', 'SEA'),  -- Jaxon Smith-Njigba
  ('10859', 'LAR'),  -- Puka Nacua
  ('11579', 'ARI'),  -- Marvin Harrison Jr.
  ('11580', 'JAX'),  -- Brian Thomas Jr.
  ('11581', 'KC'),   -- Xavier Worthy
  ('9502',  'NYG'),  -- Malik Nabers
  ('10856', 'MIN'),  -- Jordan Addison
  ('10857', 'NO'),   -- Chris Olave
  ('10858', 'BAL'),  -- Zay Flowers
  ('10862', 'IND'),  -- Josh Downs
  ('10855', 'IND'),  -- Michael Pittman
  ('9505',  'CLE'),  -- Jerry Jeudy
  ('9506',  'KC'),   -- Rashee Rice
  ('9503',  'CHI'),  -- Rome Odunze
  ('9504',  'LAC'),  -- Ladd McConkey
  ('9499',  'GB'),   -- Christian Watson
  ('9500',  'HOU'),  -- Tank Dell
  ('9501',  'BUF'),  -- Keon Coleman
  ('9486',  'PHI'),  -- Jahan Dotson
  ('9495',  'KC'),   -- Skyy Moore
  ('9497',  'TEN'),  -- Treylon Burks
  ('8125',  'PIT'),  -- Calvin Austin
  ('7564',  'TB'),   -- Mike Evans
  -- TEs
  ('12151', 'LV'),   -- Brock Bowers
  ('6803',  'KC'),   -- Travis Kelce
  ('7589',  'ARI'),  -- Trey McBride
  ('8152',  'DET'),  -- Sam LaPorta
  ('11582', 'CHI'),  -- Colston Loveland
  ('11583', 'IND'),  -- Tyler Warren
  ('7528',  'MIN'),  -- T.J. Hockenson
  ('9492',  'BUF'),  -- Dalton Kincaid
  ('9491',  'BAL'),  -- Isaiah Likely
  ('9494',  'DAL'),  -- Jake Ferguson
  ('9490',  'GB'),   -- Luke Musgrave
  ('9489',  'LV'),   -- Michael Mayer
  ('7567',  'JAX'),  -- Evan Engram
  ('8153',  'GB'),   -- Tucker Kraft
  -- IDPs (DL)
  ('tj_watt_dl',          'PIT'),
  ('myles_garrett_dl',    'CLE'),
  ('micah_parsons_dl',    'DAL'),
  ('nick_bosa_dl',        'SF'),
  ('maxx_crosby_dl',      'LV'),
  ('will_anderson_dl',    'HOU'),
  ('aidan_hutchinson_dl', 'DET'),
  ('brian_burns_dl',      'NYG'),
  ('haason_reddick_dl',   'NYJ'),
  ('rashan_gary_dl',      'GB'),
  ('danielle_hunter_dl',  'HOU'),
  ('deforest_buckner_dl', 'IND'),
  ('chris_jones_dl',      'KC'),
  ('dexter_lawrence_dl',  'NYG'),
  ('cam_thomas_dl',       'NYG'),
  ('george_karlaftis_dl', 'KC'),
  ('jalen_carter_dl',     'PHI'),
  ('harold_landry_dl',    'TEN'),
  ('leonard_williams_dl', 'SEA'),
  ('montez_sweat_dl',     'CHI'),
  ('nnamdi_madubuike_dl', 'BAL'),
  ('sam_hubbard_dl',      'CIN'),
  ('dre_mont_jones_dl',   'SEA'),
  ('grady_jarrett_dl',    'CLE'),
  ('isaiah_simmons_dl',   'ARI'),
  ('josh_allen_edl',      'JAX'),
  ('kenny_clark_dl',      'GB'),
  ('kwity_paye_dl',       'IND'),
  ('lj_collier_dl',       'SEA'),
  ('michael_pierce_dl',   'FA'),
  ('quinnen_williams_dl', 'NYJ'),
  ('shaq_lawson_dl',      'FA'),
  ('travon_walker_dl',    'JAX'),
  ('tyquan_lewis_dl',     'IND'),
  ('vita_vea_dl',         'TB'),
  ('zach_allen_dl',       'ARI'),
  ('cameron_heyward_dl',  'PIT'),
  ('carlos_dunlap_dl',    'FA'),
  -- IDPs (LB)
  ('fred_warner_lb',        'SF'),
  ('roquan_smith_lb',       'BAL'),
  ('bobby_wagner_lb',       'FA'),
  ('micah_parsons_lb',      'DAL'),
  ('patrick_queen_lb',      'PIT'),
  ('tremaine_edmunds_lb',   'CHI'),
  ('matthew_judon_lb',      'ATL'),
  ('jack_campbell_lb',      'DET'),
  ('jerome_baker_lb',       'HOU'),
  ('troy_andersen_lb',      'ATL'),
  ('zaire_franklin_lb',     'IND'),
  ('dre_greenlaw_lb',       'SF'),
  ('lavonte_david_lb',      'FA'),
  ('ernest_jones_lb',       'TEN'),
  ('foye_oluokun_lb',       'JAX'),
  ('deion_jones_lb',        'FA'),
  ('devin_white_lb',        'FA'),
  ('blake_cashman_lb',      'MIN'),
  ('blake_martinez_lb',     'FA'),
  ('christian_rozeboom_lb', 'MIN'),
  ('cody_barton_lb',        'WAS'),
  ('cory_littleton_lb',     'FA'),
  ('david_long_lb',         'TEN'),
  ('de_onta_foreman_lb',    'FA'),
  ('divine_deablo_lb',      'LV'),
  ('elandon_roberts_lb',    'MIA'),
  ('grant_delpit_lb',       'CLE'),
  ('jamien_sherwood_lb',    'NYJ'),
  ('jordyn_brooks_lb',      'LAR'),
  ('josey_jewell_lb',       'DEN'),
  ('josh_bynes_lb',         'FA'),
  ('kwon_alexander_lb',     'FA'),
  ('malik_harrison_lb',     'BAL'),
  ('marcus_davenport_lb',   'FA'),
  ('nate_landman_lb',       'LAR'),
  ('pete_werner_lb',        'NO'),
  -- IDPs (DB)
  ('kyle_hamilton_db',         'BAL'),
  ('sauce_gardner_db',         'NYJ'),
  ('patrick_surtain_db',       'DEN'),
  ('minkah_fitzpatrick_db',    'PIT'),
  ('derwin_james_db',          'LAC'),
  ('jaire_alexander_db',       'GB'),
  ('trevon_diggs_db',          'DAL'),
  ('tariq_woolen_db',          'SEA'),
  ('jessie_bates_db',          'ATL'),
  ('antoine_winfield_db',      'TB'),
  ('daxton_hill_db',           'CIN'),
  ('denzel_ward_db',           'CLE'),
  ('aj_terrell_db',            'ATL'),
  ('daron_bland_db',           'DAL'),
  ('deommodore_lenoir_db',     'SF'),
  ('jaylon_johnson_db',        'CHI'),
  ('marlon_humphrey_db',       'BAL'),
  ('jevon_holland_db',         'MIA'),
  ('xavien_howard_db',         'FA'),
  ('budda_baker_db',           'ARI'),
  ('jalen_ramsey_db',          'FA'),
  ('justin_simmons_db',        'FA'),
  ('breon_borders_db',         'FA'),
  ('chamarri_conner_db',       'FA'),
  ('darius_slay_db',           'FA'),
  ('deandre_houston_carson_db','CHI'),
  ('kevin_byard_db',           'CHI'),
  ('marcus_jones_db',          'NE'),
  ('marcus_williams_db',       'BAL'),
  ('michael_davis_db',         'LAC'),
  ('taron_johnson_db',         'BUF'),
  ('terrell_edmunds_db',       'FA'),
  ('tre_norwood_db',           'PIT'),
  ('tyrann_mathieu_db',        'FA'),
  ('vonn_bell_db',             'FA'),
  ('isaiah_mckenzie_db',       'FA'),
  ('lamarcus_joyner_db',       'FA'),
  ('dee_ford_db',              'FA'),
  ('richard_sherman_db',       'FA')
) AS v(pid, team)
WHERE player_values_canonical.player_id = v.pid;
