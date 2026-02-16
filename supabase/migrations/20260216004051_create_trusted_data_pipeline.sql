/*
  # Trusted Data Pipeline

  1. New Tables
    - `raw_player_stats` - Unvalidated stats from external sources
    - `raw_player_status` - Unvalidated injury/roster status
    - `raw_market_ranks` - Unvalidated market rankings
    - `raw_rosters` - Unvalidated roster imports
    - `data_validation_log` - Track validation results
    - `data_source_health` - Monitor source reliability
    - `data_batch_metadata` - Batch processing metadata
    - `validated_player_stats` - Approved stats ready for FDP
    - `validated_market_ranks` - Approved rankings ready for FDP
    - `data_replay_archive` - Compressed raw payloads for replay

  2. Security
    - Enable RLS on all tables
    - Only authenticated users can read
    - Only admins can write

  3. Validation
    - All external data must be validated before use
    - FDP calculations only read from validated_* tables
    - Bad data is rejected and never reaches FDP
*/

-- =====================================================
-- Raw Ingestion Tables (Staging)
-- =====================================================

CREATE TABLE IF NOT EXISTS raw_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  week integer,
  season integer NOT NULL,
  position text,
  team text,
  fantasy_points numeric,
  snap_share numeric,
  target_share numeric,
  carry_share numeric,
  usage_rate numeric,
  raw_payload jsonb NOT NULL,
  checksum text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'validated', 'rejected', 'quarantined')),
  validation_errors jsonb,
  confidence_score numeric,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_player_stats_batch ON raw_player_stats(batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_player_stats_status ON raw_player_stats(processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_player_stats_player ON raw_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_raw_player_stats_source ON raw_player_stats(source);

-- =====================================================

CREATE TABLE IF NOT EXISTS raw_player_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text,
  team text,
  injury_status text,
  practice_status text,
  depth_chart_position integer,
  roster_status text,
  raw_payload jsonb NOT NULL,
  checksum text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'validated', 'rejected', 'quarantined')),
  validation_errors jsonb,
  confidence_score numeric,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_player_status_batch ON raw_player_status(batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_player_status_status ON raw_player_status(processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_player_status_player ON raw_player_status(player_id);

-- =====================================================

CREATE TABLE IF NOT EXISTS raw_market_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text,
  format text NOT NULL,
  rank_overall integer,
  rank_position integer,
  value numeric,
  tier text,
  raw_payload jsonb NOT NULL,
  checksum text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'validated', 'rejected', 'quarantined')),
  validation_errors jsonb,
  confidence_score numeric,
  previous_rank_overall integer,
  rank_change integer,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_market_ranks_batch ON raw_market_ranks(batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_market_ranks_status ON raw_market_ranks(processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_market_ranks_player ON raw_market_ranks(player_id);
CREATE INDEX IF NOT EXISTS idx_raw_market_ranks_format ON raw_market_ranks(format);

-- =====================================================

CREATE TABLE IF NOT EXISTS raw_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source text NOT NULL,
  league_id text NOT NULL,
  user_id text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text,
  team text,
  roster_slot text,
  raw_payload jsonb NOT NULL,
  checksum text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'validated', 'rejected', 'quarantined')),
  validation_errors jsonb,
  confidence_score numeric,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_rosters_batch ON raw_rosters(batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_rosters_status ON raw_rosters(processing_status);
CREATE INDEX IF NOT EXISTS idx_raw_rosters_league ON raw_rosters(league_id);

-- =====================================================
-- Validated Tables (Promoted Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS validated_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  week integer,
  season integer NOT NULL,
  position text NOT NULL,
  team text NOT NULL,
  fantasy_points numeric NOT NULL,
  snap_share numeric,
  target_share numeric,
  carry_share numeric,
  usage_rate numeric,
  confidence_score numeric NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, week, season, source_id)
);

CREATE INDEX IF NOT EXISTS idx_validated_player_stats_player ON validated_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_validated_player_stats_week ON validated_player_stats(week, season);

-- =====================================================

CREATE TABLE IF NOT EXISTS validated_market_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  format text NOT NULL,
  rank_overall integer NOT NULL,
  rank_position integer NOT NULL,
  value numeric,
  tier text,
  confidence_score numeric NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validated_market_ranks_player ON validated_market_ranks(player_id);
CREATE INDEX IF NOT EXISTS idx_validated_market_ranks_format ON validated_market_ranks(format);

-- =====================================================
-- Validation & Monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS data_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  table_name text NOT NULL,
  rule_name text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  affected_rows integer NOT NULL DEFAULT 0,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_validation_log_batch ON data_validation_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_log_severity ON data_validation_log(severity);
CREATE INDEX IF NOT EXISTS idx_data_validation_log_created ON data_validation_log(created_at DESC);

-- =====================================================

CREATE TABLE IF NOT EXISTS data_source_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  table_name text NOT NULL,
  total_batches integer NOT NULL DEFAULT 0,
  successful_batches integer NOT NULL DEFAULT 0,
  failed_batches integer NOT NULL DEFAULT 0,
  quarantined_batches integer NOT NULL DEFAULT 0,
  avg_confidence_score numeric,
  last_successful_import timestamptz,
  last_failed_import timestamptz,
  reliability_score numeric,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'offline')),
  alert_sent boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, table_name)
);

CREATE INDEX IF NOT EXISTS idx_data_source_health_source ON data_source_health(source);
CREATE INDEX IF NOT EXISTS idx_data_source_health_status ON data_source_health(status);

-- =====================================================

CREATE TABLE IF NOT EXISTS data_batch_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL UNIQUE,
  source text NOT NULL,
  table_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  validated_rows integer NOT NULL DEFAULT 0,
  rejected_rows integer NOT NULL DEFAULT 0,
  quarantined_rows integer NOT NULL DEFAULT 0,
  confidence_score numeric,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'quarantined')),
  validation_errors jsonb,
  cross_source_check_status text,
  promoted_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_batch_metadata_batch ON data_batch_metadata(batch_id);
CREATE INDEX IF NOT EXISTS idx_data_batch_metadata_source ON data_batch_metadata(source);
CREATE INDEX IF NOT EXISTS idx_data_batch_metadata_status ON data_batch_metadata(processing_status);
CREATE INDEX IF NOT EXISTS idx_data_batch_metadata_created ON data_batch_metadata(created_at DESC);

-- =====================================================

CREATE TABLE IF NOT EXISTS data_replay_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  source text NOT NULL,
  table_name text NOT NULL,
  compressed_payload bytea NOT NULL,
  row_count integer NOT NULL,
  original_size_bytes bigint NOT NULL,
  compressed_size_bytes bigint NOT NULL,
  checksum text NOT NULL,
  can_replay boolean NOT NULL DEFAULT true,
  replay_count integer NOT NULL DEFAULT 0,
  last_replayed_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_replay_archive_batch ON data_replay_archive(batch_id);
CREATE INDEX IF NOT EXISTS idx_data_replay_archive_source ON data_replay_archive(source);
CREATE INDEX IF NOT EXISTS idx_data_replay_archive_archived ON data_replay_archive(archived_at DESC);

-- =====================================================

CREATE TABLE IF NOT EXISTS data_quality_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid,
  alert_type text NOT NULL CHECK (alert_type IN ('team_change_spike', 'value_shift_spike', 'position_spike', 'data_outage', 'low_confidence', 'cross_source_conflict')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source text,
  affected_table text,
  affected_count integer,
  threshold_value numeric,
  actual_value numeric,
  message text NOT NULL,
  details jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_quality_alerts_type ON data_quality_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_data_quality_alerts_severity ON data_quality_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_data_quality_alerts_acknowledged ON data_quality_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_data_quality_alerts_created ON data_quality_alerts(created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE raw_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_player_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_market_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE validated_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE validated_market_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_validation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_batch_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_replay_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_alerts ENABLE ROW LEVEL SECURITY;

-- Raw tables: authenticated read only
CREATE POLICY "Authenticated users can read raw_player_stats"
  ON raw_player_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read raw_player_status"
  ON raw_player_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read raw_market_ranks"
  ON raw_market_ranks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read raw_rosters"
  ON raw_rosters FOR SELECT
  TO authenticated
  USING (true);

-- Validated tables: authenticated read only
CREATE POLICY "Authenticated users can read validated_player_stats"
  ON validated_player_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read validated_market_ranks"
  ON validated_market_ranks FOR SELECT
  TO authenticated
  USING (true);

-- Monitoring tables: authenticated read only
CREATE POLICY "Authenticated users can read data_validation_log"
  ON data_validation_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read data_source_health"
  ON data_source_health FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read data_batch_metadata"
  ON data_batch_metadata FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read data_replay_archive"
  ON data_replay_archive FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read data_quality_alerts"
  ON data_quality_alerts FOR SELECT
  TO authenticated
  USING (true);