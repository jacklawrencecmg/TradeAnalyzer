/*
  # Add explicit low values for backup/fringe QBs

  ## Problem
  Backup QBs like Trey Lance, Joe Milton, Sam Howell, etc. have no entry in
  ktc_value_snapshots, so they fall through to the position-based fallback
  which assigns a QB base value of 3500 (or 6300 with superflex multiplier).
  This is far too high for backup QBs.

  ## Fix
  Insert explicit very-low dynasty values for known backup/fringe QBs.
  These values (50-300) correctly reflect their negligible dynasty worth.
*/

DO $$
DECLARE
  snap_time TIMESTAMPTZ := NOW();
BEGIN

INSERT INTO ktc_value_snapshots (player_id, full_name, position, team, position_rank, ktc_value, fdp_value, format, source, scoring_preset, captured_at)
VALUES
  ('5849b', 'Trey Lance',                    'QB', 'FA',  99,   50,    50, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('6001',  'Joe Milton III',                'QB', 'NE',  99,   50,    50, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7052',  'Sam Howell',                    'QB', 'FA',  99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('6093',  'Tyler Huntley',                 'QB', 'BAL', 99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7571',  'Jake Browning',                 'QB', 'CIN', 99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('6030',  'Easton Stick',                  'QB', 'LAC', 99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('5915',  'Cooper Rush',                   'QB', 'DAL', 99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('6003',  'Taylor Heinicke',               'QB', 'FA',  99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('5006',  'Jarrett Stidham',               'QB', 'FA',  99,   50,    50, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('4890',  'Mitch Trubisky',                'QB', 'PIT', 99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7555',  'Tyson Bagent',                  'QB', 'CHI', 99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7041',  'Joshua Dobbs',                  'QB', 'FA',  99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7560',  'Clayton Tune',                  'QB', 'HOU', 99,   75,    75, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('6133',  'Davis Mills',                   'QB', 'FA',  99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7053',  'Aidan O''Connell',              'QB', 'LV',  99,  150,   150, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7054',  'Jaren Hall',                    'QB', 'FA',  99,   50,    50, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7055',  'Stetson Bennett',               'QB', 'LAR', 99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7056',  'Dorian Thompson-Robinson',      'QB', 'CLE', 99,  100,   100, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time),
  ('7057',  'Malik Willis',                  'QB', 'TEN', 99,  150,   150, 'dynasty_sf', 'backup_qb_floor', 'balanced', snap_time)
ON CONFLICT DO NOTHING;

END $$;
