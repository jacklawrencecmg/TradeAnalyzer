/*
  # Create Team History & Transaction Tracking System

  ## Overview
  Tracks player team changes over time to prevent historical data corruption when players change teams via trades, free agency, or practice squad moves.

  ## 1. New Tables

  ### `player_team_history`
  Tracks every team a player has been on with date ranges.
  - `id` (uuid, primary key)
  - `player_id` (uuid, references nfl_players) - The player
  - `team` (text) - Team abbreviation (e.g., "KC", "SF")
  - `from_date` (timestamptz) - When this team assignment started
  - `to_date` (timestamptz, nullable) - When it ended (null = current)
  - `is_current` (boolean) - Whether this is the active team assignment
  - `source` (text) - Where the data came from (sleeper/manual/league_import)
  - `created_at` (timestamptz) - When this record was created

  ### `player_transactions`
  League-level transaction log for player movements.
  - `id` (uuid, primary key)
  - `player_id` (uuid, references nfl_players) - The player
  - `transaction_type` (text) - Type: signed/released/traded/practice_squad/activated/injured_reserve
  - `team_from` (text, nullable) - Previous team
  - `team_to` (text, nullable) - New team
  - `transaction_date` (timestamptz) - When the transaction occurred
  - `source` (text) - Data source
  - `metadata` (jsonb) - Additional context
  - `created_at` (timestamptz) - When this record was created

  ## 2. Security
  - Enable RLS on both tables
  - Public read access (for displaying history)
  - Authenticated write access (for syncs and admin tools)

  ## 3. Indexes
  - Fast lookups by player_id and current status
  - Fast queries for team rosters at any point in time

  ## 4. Helper Functions
  - `get_player_team_at_date()` - Returns team at specific timestamp
  - `record_team_change()` - Helper to properly close old record and create new one

  ## Important Notes
  - Only ONE row per player can have is_current = true
  - Never delete history rows - append only system
  - Team changes automatically trigger transaction log entries
*/

-- =====================================================
-- 1. Create player_team_history table
-- =====================================================

CREATE TABLE IF NOT EXISTS player_team_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  team text NOT NULL,
  from_date timestamptz NOT NULL DEFAULT now(),
  to_date timestamptz,
  is_current boolean DEFAULT true,
  source text NOT NULL DEFAULT 'sleeper',
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_player_team_history_player_id 
  ON player_team_history(player_id);

CREATE INDEX IF NOT EXISTS idx_player_team_history_player_current 
  ON player_team_history(player_id, is_current) 
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_player_team_history_team_current 
  ON player_team_history(team, is_current) 
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_player_team_history_dates 
  ON player_team_history(player_id, from_date, to_date);

-- Enable RLS
ALTER TABLE player_team_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, authenticated write
CREATE POLICY "Anyone can view team history"
  ON player_team_history
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert team history"
  ON player_team_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update team history"
  ON player_team_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. Create player_transactions table
-- =====================================================

CREATE TABLE IF NOT EXISTS player_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  team_from text,
  team_to text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'sleeper',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  -- Constraint to ensure valid transaction types
  CONSTRAINT valid_transaction_type CHECK (
    transaction_type IN (
      'signed',
      'released',
      'traded',
      'practice_squad',
      'activated',
      'injured_reserve',
      'team_changed',
      'waived',
      'claimed'
    )
  )
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_player_transactions_player_id 
  ON player_transactions(player_id);

CREATE INDEX IF NOT EXISTS idx_player_transactions_type 
  ON player_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_player_transactions_date 
  ON player_transactions(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_transactions_team_from 
  ON player_transactions(team_from) 
  WHERE team_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_transactions_team_to 
  ON player_transactions(team_to) 
  WHERE team_to IS NOT NULL;

-- Enable RLS
ALTER TABLE player_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, authenticated write
CREATE POLICY "Anyone can view transactions"
  ON player_transactions
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert transactions"
  ON player_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 3. Helper Function: Get player team at specific date
-- =====================================================

CREATE OR REPLACE FUNCTION get_player_team_at_date(
  p_player_id uuid,
  p_date timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_team text;
BEGIN
  -- Find the team record that was active at the given date
  SELECT team INTO v_team
  FROM player_team_history
  WHERE player_id = p_player_id
    AND from_date <= p_date
    AND (to_date IS NULL OR to_date >= p_date)
  ORDER BY from_date DESC
  LIMIT 1;
  
  -- If no history found, fall back to current team from nfl_players
  IF v_team IS NULL THEN
    SELECT team INTO v_team
    FROM nfl_players
    WHERE id = p_player_id;
  END IF;
  
  RETURN v_team;
END;
$$;

-- =====================================================
-- 4. Helper Function: Record team change
-- =====================================================

CREATE OR REPLACE FUNCTION record_team_change(
  p_player_id uuid,
  p_new_team text,
  p_source text DEFAULT 'sleeper',
  p_change_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_team text;
  v_rows_closed integer := 0;
  v_history_id uuid;
  v_transaction_id uuid;
  v_result jsonb;
BEGIN
  -- Get the current team from history
  SELECT team INTO v_old_team
  FROM player_team_history
  WHERE player_id = p_player_id
    AND is_current = true
  LIMIT 1;
  
  -- If no change, do nothing
  IF v_old_team = p_new_team THEN
    RETURN jsonb_build_object(
      'changed', false,
      'reason', 'same_team',
      'team', p_new_team
    );
  END IF;
  
  -- Close existing current record(s)
  UPDATE player_team_history
  SET 
    to_date = p_change_date,
    is_current = false
  WHERE player_id = p_player_id
    AND is_current = true;
  
  GET DIAGNOSTICS v_rows_closed = ROW_COUNT;
  
  -- Insert new team history record
  INSERT INTO player_team_history (
    player_id,
    team,
    from_date,
    to_date,
    is_current,
    source
  )
  VALUES (
    p_player_id,
    p_new_team,
    p_change_date,
    NULL,
    true,
    p_source
  )
  RETURNING id INTO v_history_id;
  
  -- Create transaction record
  INSERT INTO player_transactions (
    player_id,
    transaction_type,
    team_from,
    team_to,
    transaction_date,
    source,
    metadata
  )
  VALUES (
    p_player_id,
    'team_changed',
    v_old_team,
    p_new_team,
    p_change_date,
    p_source,
    jsonb_build_object(
      'old_team', v_old_team,
      'new_team', p_new_team,
      'history_id', v_history_id
    )
  )
  RETURNING id INTO v_transaction_id;
  
  -- Build result
  v_result := jsonb_build_object(
    'changed', true,
    'old_team', v_old_team,
    'new_team', p_new_team,
    'rows_closed', v_rows_closed,
    'history_id', v_history_id,
    'transaction_id', v_transaction_id
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 5. Helper Function: Initialize team history for existing players
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_team_history_for_player(
  p_player_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_team text;
  v_existing_count integer;
BEGIN
  -- Check if history already exists
  SELECT COUNT(*) INTO v_existing_count
  FROM player_team_history
  WHERE player_id = p_player_id;
  
  IF v_existing_count > 0 THEN
    RETURN false; -- Already initialized
  END IF;
  
  -- Get current team from nfl_players
  SELECT team INTO v_current_team
  FROM nfl_players
  WHERE id = p_player_id;
  
  IF v_current_team IS NULL OR v_current_team = '' THEN
    RETURN false; -- No team to initialize
  END IF;
  
  -- Create initial history record
  INSERT INTO player_team_history (
    player_id,
    team,
    from_date,
    to_date,
    is_current,
    source
  )
  VALUES (
    p_player_id,
    v_current_team,
    now(),
    NULL,
    true,
    'initialization'
  );
  
  RETURN true;
END;
$$;

-- =====================================================
-- 6. Create view for current team assignments
-- =====================================================

CREATE OR REPLACE VIEW current_player_teams AS
SELECT 
  pth.player_id,
  np.full_name,
  np.player_position,
  pth.team,
  pth.from_date,
  pth.source,
  np.status
FROM player_team_history pth
INNER JOIN nfl_players np ON np.id = pth.player_id
WHERE pth.is_current = true;

-- =====================================================
-- 7. Create view for recent transactions
-- =====================================================

CREATE OR REPLACE VIEW recent_player_transactions AS
SELECT 
  pt.id,
  pt.player_id,
  np.full_name,
  np.player_position,
  pt.transaction_type,
  pt.team_from,
  pt.team_to,
  pt.transaction_date,
  pt.source,
  pt.metadata
FROM player_transactions pt
INNER JOIN nfl_players np ON np.id = pt.player_id
ORDER BY pt.transaction_date DESC;
