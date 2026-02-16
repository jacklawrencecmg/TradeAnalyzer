/*
  # FDP Canonical Value Protection System

  1. Purpose
    - Create public view for player values
    - Force all queries through controlled interface
    - Prevent value calculation drift

  2. New Views
    - vw_public_player_values - Public-facing view
*/

CREATE OR REPLACE VIEW vw_public_player_values AS
SELECT 
  player_id,
  player_name,
  position,
  team,
  base_value,
  adjusted_value,
  market_value,
  tier,
  rank_overall,
  rank_position,
  value_epoch_id,
  updated_at,
  source
FROM latest_player_values;

GRANT SELECT ON vw_public_player_values TO anon, authenticated;

COMMENT ON VIEW vw_public_player_values IS 
  'Public view for FDP canonical player values';
