/*
  # Core Performance Indexes

  Critical indexes for rankings, trade calc, and player lookups.
  Target: <200ms response times under load.
*/

-- VALUE_SNAPSHOTS (most critical for rankings)
CREATE INDEX IF NOT EXISTS idx_snapshots_latest
  ON value_snapshots(player_id, league_profile_id, format, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_pos_rank
  ON value_snapshots(league_profile_id, format, position_rank, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_epoch
  ON value_snapshots(value_epoch, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_fdp
  ON value_snapshots(fdp_value DESC, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_player_format
  ON value_snapshots(player_id, format, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_captured
  ON value_snapshots(captured_at DESC);

-- NFL_PLAYERS (joins & lookups)
CREATE INDEX IF NOT EXISTS idx_nfl_players_search_name
  ON nfl_players(search_name);

CREATE INDEX IF NOT EXISTS idx_nfl_players_full_name_lower
  ON nfl_players(LOWER(full_name));

CREATE INDEX IF NOT EXISTS idx_nfl_players_external_id
  ON nfl_players(external_id);

CREATE INDEX IF NOT EXISTS idx_nfl_players_position
  ON nfl_players(player_position);

CREATE INDEX IF NOT EXISTS idx_nfl_players_team
  ON nfl_players(team);

CREATE INDEX IF NOT EXISTS idx_nfl_players_status
  ON nfl_players(status);

-- PLAYER_VALUES (legacy table)
CREATE INDEX IF NOT EXISTS idx_player_values_player_id
  ON player_values(player_id);

CREATE INDEX IF NOT EXISTS idx_player_values_dynasty
  ON player_values(dynasty_value DESC);

CREATE INDEX IF NOT EXISTS idx_player_values_redraft
  ON player_values(redraft_value DESC);

CREATE INDEX IF NOT EXISTS idx_player_values_epoch
  ON player_values(value_epoch);

-- PLAYER_VALUES_VERSIONED (history)
CREATE INDEX IF NOT EXISTS idx_values_versioned_timeseries
  ON player_values_versioned(player_id, format, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_values_versioned_epoch
  ON player_values_versioned(epoch, format);

-- Update statistics
ANALYZE value_snapshots;
ANALYZE nfl_players;
ANALYZE player_values;
ANALYZE player_values_versioned;
