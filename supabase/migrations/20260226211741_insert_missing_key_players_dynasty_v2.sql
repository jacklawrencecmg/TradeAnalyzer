
/*
  # Insert Missing Key Players into Dynasty Values (v2)

  ## Summary
  Inserts 14 key players missing from player_values_canonical dynasty format.
  Uses INSERT with WHERE NOT EXISTS to avoid conflict errors.
*/

DO $$
DECLARE
  epoch_id uuid := 'e5334014-f2b1-4569-b7d7-5e8c3411e7ab';

  players record;
  player_data record;
BEGIN

  FOR player_data IN (
    SELECT * FROM (VALUES
      ('4663',  'Josh Allen',          'QB', 'BUF', 11745, 11745, 8700,  2),
      ('10230', 'Anthony Richardson',  'QB', 'IND',  7560,  7560, 5600, 14),
      ('11568', 'Michael Penix Jr.',   'QB', 'ATL',  6750,  6750, 5000, 17),
      ('6813',  'Saquon Barkley',      'RB', 'PHI',  6000,  6000, 4400, 11),
      ('8112',  'De''Von Achane',      'RB', 'MIA',  8100,  8100, 6000,  4),
      ('7563',  'Travis Etienne',      'RB', 'JAX',  4000,  4000, 3000, 16),
      ('6797',  'D''Andre Swift',      'RB', 'CHI',  3800,  3800, 2800, 17),
      ('6794',  'Justin Jefferson',    'WR', 'MIN',  9000,  9000, 6700,  1),
      ('11569', 'Marvin Harrison Jr.', 'WR', 'ARI',  8500,  8500, 6300, 15),
      ('11570', 'Brian Thomas Jr.',    'WR', 'JAX',  8000,  8000, 5900, 16),
      ('11571', 'Luther Burden III',   'WR', 'CHI',  5700,  5700, 4200, 25),
      ('8111',  'Diontae Johnson',     'WR', 'CAR',  3200,  3200, 2400, 40),
      ('9493',  'Sam LaPorta',         'TE', 'DET',  7920,  7920, 5900,  2),
      ('6804',  'T.J. Hockenson',      'TE', 'MIN',  4620,  4620, 3400,  8)
    ) AS t(pid, pname, pos, tm, base_val, adj_val, mkt_val, rank_pos)
  ) LOOP
    -- Update if exists, insert if not
    UPDATE player_values_canonical
    SET adjusted_value = player_data.adj_val,
        base_value     = player_data.base_val,
        market_value   = player_data.mkt_val,
        rank_position  = player_data.rank_pos,
        source         = 'fdp_2026_baseline',
        updated_at     = NOW()
    WHERE player_id = player_data.pid
      AND format = 'dynasty';

    IF NOT FOUND THEN
      INSERT INTO player_values_canonical
        (player_id, player_name, position, team, format, base_value, adjusted_value,
         market_value, rank_position, rank_overall, source, value_epoch_id, created_at, updated_at)
      VALUES
        (player_data.pid, player_data.pname, player_data.pos, player_data.tm, 'dynasty',
         player_data.base_val, player_data.adj_val, player_data.mkt_val,
         player_data.rank_pos, 999, 'fdp_2026_baseline', epoch_id, NOW(), NOW());
    END IF;
  END LOOP;

END $$;

-- Recompute rank_overall for dynasty after additions
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY format
      ORDER BY adjusted_value DESC
    ) AS new_rank
  FROM player_values_canonical
  WHERE format = 'dynasty'
)
UPDATE player_values_canonical pvc
SET rank_overall = ranked.new_rank
FROM ranked
WHERE pvc.id = ranked.id;
