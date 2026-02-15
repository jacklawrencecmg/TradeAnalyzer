/*
  # Create League Profiles System

  1. New Tables
    - league_profiles - stores unique league configuration profiles
    - league_profile_multipliers - stores position multipliers per profile

  2. Changes to Existing Tables
    - leagues - add league_profile_id column
    - value_snapshots - add league_profile_id column
    - latest_player_values - recreate view to include league_profile_id

  3. Security
    - Enable RLS on new tables
*/

-- =====================================================
-- 1. CREATE league_profiles TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS league_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  format_key text UNIQUE NOT NULL,
  is_dynasty boolean NOT NULL,
  is_superflex boolean NOT NULL,
  te_premium numeric NOT NULL DEFAULT 0,
  ppr numeric NOT NULL DEFAULT 1,
  ppc numeric NOT NULL DEFAULT 0,
  idp_enabled boolean NOT NULL DEFAULT false,
  idp_scoring_preset text,
  starting_slots jsonb NOT NULL,
  bench_slots int NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_profiles_format_key
  ON league_profiles(format_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_idp_scoring_preset'
  ) THEN
    ALTER TABLE league_profiles
      ADD CONSTRAINT check_idp_scoring_preset
      CHECK (
        idp_scoring_preset IS NULL
        OR idp_scoring_preset IN ('balanced', 'tackleheavy', 'bigplay')
      );
  END IF;
END $$;

-- =====================================================
-- 2. CREATE DEFAULT LEAGUE PROFILES
-- =====================================================

INSERT INTO league_profiles (name, format_key, is_dynasty, is_superflex, te_premium, ppr, ppc, idp_enabled, idp_scoring_preset, starting_slots, bench_slots)
VALUES
  ('Dynasty Superflex', 'dynasty_sf', true, true, 0, 1, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":1,"SF":1}'::jsonb, 20),
  ('Dynasty 1QB', 'dynasty_1qb', true, false, 0, 1, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":2}'::jsonb, 20),
  ('Dynasty SF TEP', 'dynasty_sf_tep', true, true, 0.5, 1, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":1,"SF":1}'::jsonb, 20),
  ('Dynasty SF IDP Balanced', 'dynasty_sf_idp_balanced', true, true, 0, 1, 0, true, 'balanced', '{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"SF":1,"DL":2,"LB":2,"DB":2}'::jsonb, 20),
  ('Dynasty SF IDP Tackle Heavy', 'dynasty_sf_idp_tackleheavy', true, true, 0, 1, 0, true, 'tackleheavy', '{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"SF":1,"DL":2,"LB":3,"DB":2}'::jsonb, 20),
  ('Dynasty SF IDP Big Play', 'dynasty_sf_idp_bigplay', true, true, 0, 1, 0, true, 'bigplay', '{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"SF":1,"DL":3,"LB":2,"DB":1}'::jsonb, 20),
  ('Redraft Superflex PPR', 'redraft_sf_ppr', false, true, 0, 1, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":1,"SF":1}'::jsonb, 7),
  ('Redraft 1QB PPR', 'redraft_1qb_ppr', false, false, 0, 1, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":2}'::jsonb, 7),
  ('Redraft 1QB Standard', 'redraft_1qb_standard', false, false, 0, 0, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":2}'::jsonb, 7),
  ('Redraft 1QB Half PPR', 'redraft_1qb_halfppr', false, false, 0, 0.5, 0, false, NULL, '{"QB":1,"RB":2,"WR":3,"TE":1,"FLEX":2}'::jsonb, 7)
ON CONFLICT (format_key) DO NOTHING;

-- =====================================================
-- 3. ADD league_profile_id TO leagues TABLE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leagues' AND column_name = 'league_profile_id'
  ) THEN
    ALTER TABLE leagues
      ADD COLUMN league_profile_id uuid REFERENCES league_profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leagues_league_profile_id
  ON leagues(league_profile_id);

-- =====================================================
-- 4. ADD league_profile_id TO value_snapshots TABLE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_snapshots' AND column_name = 'league_profile_id'
  ) THEN
    ALTER TABLE value_snapshots
      ADD COLUMN league_profile_id uuid REFERENCES league_profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_value_snapshots_league_profile
  ON value_snapshots(league_profile_id, format, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_value_snapshots_player_league
  ON value_snapshots(player_id, league_profile_id, format, captured_at DESC);

-- =====================================================
-- 5. RECREATE latest_player_values VIEW
-- =====================================================

DROP VIEW IF EXISTS latest_player_values;

CREATE VIEW latest_player_values AS
  SELECT DISTINCT ON (vs.player_id, vs.league_profile_id, vs.format)
    vs.id AS snapshot_id,
    vs.player_id,
    vs.league_profile_id,
    vs.source,
    vs.format,
    vs.position,
    vs.position_rank,
    vs.market_value,
    vs.fdp_value,
    vs.dynasty_value,
    vs.redraft_value,
    vs.value_epoch,
    vs.notes,
    vs.captured_at,
    np.full_name,
    np.search_name,
    np.player_position,
    np.team,
    np.status,
    np.birthdate,
    np.years_exp,
    EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, np.birthdate::timestamp with time zone))::integer AS age,
    false AS is_stale
  FROM value_snapshots vs
  JOIN nfl_players np ON vs.player_id = np.id
  ORDER BY vs.player_id, vs.league_profile_id, vs.format, vs.captured_at DESC;

-- =====================================================
-- 6. ENABLE RLS
-- =====================================================

ALTER TABLE league_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view league profiles"
  ON league_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert league profiles"
  ON league_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update league profiles"
  ON league_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 7. CREATE HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_default_league_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM league_profiles WHERE format_key = 'dynasty_sf' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION generate_format_key(
  p_is_dynasty boolean,
  p_is_superflex boolean,
  p_te_premium numeric,
  p_ppr numeric,
  p_idp_enabled boolean,
  p_idp_preset text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_is_dynasty THEN
    v_key := 'dynasty';
  ELSE
    v_key := 'redraft';
  END IF;

  IF p_is_superflex THEN
    v_key := v_key || '_sf';
  ELSE
    v_key := v_key || '_1qb';
  END IF;

  IF p_ppr = 0 THEN
    v_key := v_key || '_standard';
  ELSIF p_ppr = 0.5 THEN
    v_key := v_key || '_halfppr';
  ELSIF p_ppr = 1 THEN
    v_key := v_key || '_ppr';
  ELSE
    v_key := v_key || '_ppr' || REPLACE(p_ppr::text, '.', '_');
  END IF;

  IF p_te_premium > 0 THEN
    v_key := v_key || '_tep';
  END IF;

  IF p_idp_enabled AND p_idp_preset IS NOT NULL THEN
    v_key := v_key || '_idp_' || p_idp_preset;
  END IF;

  RETURN v_key;
END;
$$;

-- =====================================================
-- 8. CREATE VALUE MULTIPLIERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS league_profile_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_profile_id uuid NOT NULL REFERENCES league_profiles(id) ON DELETE CASCADE,
  position text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1.0,
  reason text,
  created_at timestamptz DEFAULT now(),

  UNIQUE(league_profile_id, position)
);

CREATE INDEX IF NOT EXISTS idx_league_profile_multipliers_profile
  ON league_profile_multipliers(league_profile_id);

ALTER TABLE league_profile_multipliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view multipliers"
  ON league_profile_multipliers FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 9. POPULATE DEFAULT MULTIPLIERS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION populate_profile_multipliers(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile
  FROM league_profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_profile_id;
  END IF;

  DELETE FROM league_profile_multipliers WHERE league_profile_id = p_profile_id;

  INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
  VALUES (
    p_profile_id,
    'QB',
    CASE WHEN v_profile.is_superflex THEN 1.25 ELSE 1.0 END,
    CASE WHEN v_profile.is_superflex THEN 'Superflex scarcity boost' ELSE 'Standard 1QB' END
  );

  INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
  VALUES (p_profile_id, 'RB', 1.05, 'Position scarcity');

  INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
  VALUES (p_profile_id, 'WR', 1.0, 'Baseline position');

  INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
  VALUES (
    p_profile_id,
    'TE',
    1.0 + LEAST(v_profile.te_premium * 0.30, 0.25),
    CASE WHEN v_profile.te_premium > 0
      THEN 'TE premium boost (' || v_profile.te_premium || ' PPR)'
      ELSE 'Standard TE'
    END
  );

  IF v_profile.idp_enabled THEN
    CASE v_profile.idp_scoring_preset
      WHEN 'tackleheavy' THEN
        INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
        VALUES
          (p_profile_id, 'LB', 1.10, 'IDP: Tackle-heavy scoring favors LBs'),
          (p_profile_id, 'DB', 0.95, 'IDP: Tackle-heavy scoring'),
          (p_profile_id, 'DL', 1.00, 'IDP: Tackle-heavy scoring');

      WHEN 'bigplay' THEN
        INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
        VALUES
          (p_profile_id, 'LB', 0.95, 'IDP: Big play scoring'),
          (p_profile_id, 'DB', 0.90, 'IDP: Big play scoring'),
          (p_profile_id, 'DL', 1.15, 'IDP: Big play scoring favors DL');

      ELSE
        INSERT INTO league_profile_multipliers (league_profile_id, position, multiplier, reason)
        VALUES
          (p_profile_id, 'LB', 1.00, 'IDP: Balanced scoring'),
          (p_profile_id, 'DB', 1.00, 'IDP: Balanced scoring'),
          (p_profile_id, 'DL', 1.00, 'IDP: Balanced scoring');
    END CASE;
  END IF;
END;
$$;

DO $$
DECLARE
  v_profile RECORD;
BEGIN
  FOR v_profile IN SELECT id FROM league_profiles LOOP
    PERFORM populate_profile_multipliers(v_profile.id);
  END LOOP;
END $$;