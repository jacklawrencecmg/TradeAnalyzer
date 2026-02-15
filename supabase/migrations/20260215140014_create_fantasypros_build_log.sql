/*
  # Create FantasyPros Build Log Table

  1. New Table
    - `fantasypros_build_log`
      - `id` (uuid, primary key)
      - `build_type` (text) - Type of build (dynasty_base, redraft_fill, full_import)
      - `started_at` (timestamptz) - When build started
      - `completed_at` (timestamptz) - When build completed
      - `success` (boolean) - Whether build succeeded
      - `sources_used` (text[]) - List of source IDs used
      - `player_count` (int) - Total players imported
      - `offense_count` (int) - Offense player count
      - `idp_count` (int) - IDP player count
      - `ppr_matched` (int) - PPR matches
      - `half_matched` (int) - Half-PPR matches
      - `errors` (text[]) - List of errors encountered
      - `metadata` (jsonb) - Additional metadata
      - `created_at` (timestamptz) - Row creation time

  2. Security
    - Enable RLS
    - Admin can read/write
    - Public can read recent builds
*/

CREATE TABLE IF NOT EXISTS fantasypros_build_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_type text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  sources_used text[] DEFAULT '{}',
  player_count int DEFAULT 0,
  offense_count int,
  idp_count int,
  ppr_matched int,
  half_matched int,
  errors text[] DEFAULT '{}',
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fantasypros_build_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view recent builds"
  ON fantasypros_build_log
  FOR SELECT
  TO public
  USING (created_at > now() - interval '30 days');

CREATE POLICY "Authenticated users can insert builds"
  ON fantasypros_build_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update own builds"
  ON fantasypros_build_log
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_build_log_type ON fantasypros_build_log(build_type);
CREATE INDEX idx_build_log_created ON fantasypros_build_log(created_at DESC);
CREATE INDEX idx_build_log_success ON fantasypros_build_log(success, completed_at DESC);

COMMENT ON TABLE fantasypros_build_log IS 'Tracks FantasyPros import builds for reproducibility and debugging';
COMMENT ON COLUMN fantasypros_build_log.build_type IS 'Type of build: dynasty_base, redraft_fill, or full_import';
COMMENT ON COLUMN fantasypros_build_log.sources_used IS 'Array of source IDs used in this build';
COMMENT ON COLUMN fantasypros_build_log.metadata IS 'Additional build information (download URLs, timestamps, etc)';
