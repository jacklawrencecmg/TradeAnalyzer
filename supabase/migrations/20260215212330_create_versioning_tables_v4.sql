/*
  # Data Versioning & Backup Tables

  Creates new versioning and backup infrastructure.
  Uses new table names to avoid conflicts.
*/

-- 1. Player Values Versioning (epoch-based)
CREATE TABLE IF NOT EXISTS player_values_versioned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  league_profile_id uuid,
  format text NOT NULL,
  value int NOT NULL,
  pos_rank int,
  overall_rank int,
  tier int,
  epoch text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_values_versioned_player ON player_values_versioned(player_id);
CREATE INDEX IF NOT EXISTS idx_values_versioned_epoch ON player_values_versioned(epoch);
CREATE INDEX IF NOT EXISTS idx_values_versioned_created ON player_values_versioned(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_values_versioned_format ON player_values_versioned(format);

-- 2. System Snapshots
CREATE TABLE IF NOT EXISTS system_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type text NOT NULL,
  epoch text NOT NULL,
  payload jsonb NOT NULL,
  stats jsonb DEFAULT '{}',
  compression_type text DEFAULT 'none',
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CONSTRAINT valid_snapshot_type CHECK (snapshot_type IN ('values', 'players', 'leagues', 'full', 'migration'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_type ON system_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_epoch ON system_snapshots(epoch);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON system_snapshots(created_at DESC);

-- 3. Schema Migrations Log
CREATE TABLE IF NOT EXISTS schema_migrations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text UNIQUE NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  success boolean,
  error_message text,
  rollback_sql text NOT NULL,
  applied_sql text,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON schema_migrations_log(migration_name);
CREATE INDEX IF NOT EXISTS idx_migrations_started ON schema_migrations_log(started_at DESC);

-- 4. Data Integrity Checksums
CREATE TABLE IF NOT EXISTS data_integrity_checksums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checksum_type text NOT NULL,
  hash_value text NOT NULL,
  epoch text NOT NULL,
  row_count int,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_checksum_type CHECK (checksum_type IN ('player_values', 'full_rebuild', 'migration', 'backup'))
);

CREATE INDEX IF NOT EXISTS idx_checksums_type ON data_integrity_checksums(checksum_type);
CREATE INDEX IF NOT EXISTS idx_checksums_epoch ON data_integrity_checksums(epoch);
CREATE INDEX IF NOT EXISTS idx_checksums_created ON data_integrity_checksums(created_at DESC);

-- 5. Backup Metadata
CREATE TABLE IF NOT EXISTS backup_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL,
  storage_location text NOT NULL,
  storage_provider text DEFAULT 's3',
  size_bytes bigint,
  row_count int,
  checksum text,
  epoch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  restored_at timestamptz,
  metadata jsonb DEFAULT '{}',
  CONSTRAINT valid_backup_type CHECK (backup_type IN ('daily', 'weekly', 'monthly', 'manual', 'pre_deploy'))
);

CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_metadata(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_created ON backup_metadata(created_at DESC);

-- 6. Rollback History
CREATE TABLE IF NOT EXISTS rollback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollback_type text NOT NULL,
  target_epoch text NOT NULL,
  snapshot_id uuid,
  initiated_by uuid,
  reason text NOT NULL,
  rows_affected int,
  duration_ms int,
  success boolean NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_rollback_type CHECK (rollback_type IN ('snapshot', 'migration', 'emergency', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_rollback_type ON rollback_history(rollback_type);
CREATE INDEX IF NOT EXISTS idx_rollback_created ON rollback_history(created_at DESC);

-- RLS Policies

ALTER TABLE player_values_versioned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view versioned values" ON player_values_versioned FOR SELECT USING (true);
CREATE POLICY "Service role can manage versioned values" ON player_values_versioned FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE system_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage snapshots" ON system_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE schema_migrations_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view migrations" ON schema_migrations_log FOR SELECT USING (true);
CREATE POLICY "Service role can manage migrations" ON schema_migrations_log FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE data_integrity_checksums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view checksums" ON data_integrity_checksums FOR SELECT USING (true);
CREATE POLICY "Service role can manage checksums" ON data_integrity_checksums FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage backups" ON backup_metadata FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE rollback_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rollback history" ON rollback_history FOR SELECT USING (true);
CREATE POLICY "Service role can manage rollback history" ON rollback_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper Functions

CREATE OR REPLACE FUNCTION generate_epoch()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(now(), 'YYYY-MM-DD-HH24-MI-SS');
$$;

CREATE OR REPLACE FUNCTION has_incomplete_migrations()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM schema_migrations_log
    WHERE success IS NULL OR success = false
  );
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshots_deleted int;
  v_backups_deleted int;
BEGIN
  DELETE FROM system_snapshots
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_snapshots_deleted = ROW_COUNT;
  
  DELETE FROM backup_metadata
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_backups_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'snapshots_deleted', v_snapshots_deleted,
    'backups_deleted', v_backups_deleted,
    'cleaned_at', now()
  );
END;
$$;
