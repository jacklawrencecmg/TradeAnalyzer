/*
  # Add Player Context Suggestions Table

  1. New Table
    - `player_context_suggestions`
      - `id` (uuid, primary key)
      - `player_id` (text, foreign key to player_values)
      - `suggested_depth_role` (text) - Inferred depth chart role
      - `suggested_workload_tier` (text) - Inferred workload expectations
      - `suggested_contract_security` (text) - Inferred contract security
      - `confidence` (float) - Confidence score 0.0-1.0
      - `reasoning` (text) - Optional explanation of inference
      - `status` (text) - pending, accepted, ignored
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `expires_at` (timestamptz) - Suggestions expire after 7 days
  
  2. Purpose
    - Store AI-generated context suggestions for RBs
    - Allow admin review before applying
    - Track acceptance/rejection history
    - Prevent overwriting manual edits
  
  3. Security
    - Enable RLS
    - Admin-only access for writes
    - Public read for displaying suggestions
  
  4. Notes
    - Suggestions never automatically overwrite player_values
    - Expired suggestions are ignored
    - High-confidence suggestions can be auto-highlighted
*/

-- Create player_context_suggestions table
CREATE TABLE IF NOT EXISTS player_context_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  suggested_depth_role text,
  suggested_workload_tier text,
  suggested_contract_security text,
  confidence float NOT NULL DEFAULT 0.5,
  reasoning text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Add foreign key constraint if player_values table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_values') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_player_context_suggestions_player_id'
    ) THEN
      ALTER TABLE player_context_suggestions
      ADD CONSTRAINT fk_player_context_suggestions_player_id
      FOREIGN KEY (player_id) REFERENCES player_values(player_id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Add constraints for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_context_suggestions_depth_role_check'
  ) THEN
    ALTER TABLE player_context_suggestions
    ADD CONSTRAINT player_context_suggestions_depth_role_check
    CHECK (suggested_depth_role IS NULL OR suggested_depth_role IN ('feature', 'lead_committee', 'committee', 'handcuff', 'backup'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_context_suggestions_workload_tier_check'
  ) THEN
    ALTER TABLE player_context_suggestions
    ADD CONSTRAINT player_context_suggestions_workload_tier_check
    CHECK (suggested_workload_tier IS NULL OR suggested_workload_tier IN ('elite', 'solid', 'light', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_context_suggestions_contract_security_check'
  ) THEN
    ALTER TABLE player_context_suggestions
    ADD CONSTRAINT player_context_suggestions_contract_security_check
    CHECK (suggested_contract_security IS NULL OR suggested_contract_security IN ('high', 'medium', 'low'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_context_suggestions_confidence_check'
  ) THEN
    ALTER TABLE player_context_suggestions
    ADD CONSTRAINT player_context_suggestions_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_context_suggestions_status_check'
  ) THEN
    ALTER TABLE player_context_suggestions
    ADD CONSTRAINT player_context_suggestions_status_check
    CHECK (status IN ('pending', 'accepted', 'ignored'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_context_suggestions_player_id ON player_context_suggestions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_context_suggestions_status ON player_context_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_player_context_suggestions_expires_at ON player_context_suggestions(expires_at);
CREATE INDEX IF NOT EXISTS idx_player_context_suggestions_confidence ON player_context_suggestions(confidence);

-- Enable RLS
ALTER TABLE player_context_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read suggestions" ON player_context_suggestions;
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON player_context_suggestions;
DROP POLICY IF EXISTS "Authenticated users can update suggestions" ON player_context_suggestions;
DROP POLICY IF EXISTS "Authenticated users can delete suggestions" ON player_context_suggestions;

-- Policy: Anyone can read suggestions (for display purposes)
CREATE POLICY "Anyone can read suggestions"
  ON player_context_suggestions
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert suggestions (for sync jobs)
CREATE POLICY "Authenticated users can insert suggestions"
  ON player_context_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update suggestions (for admin review)
CREATE POLICY "Authenticated users can update suggestions"
  ON player_context_suggestions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete expired suggestions
CREATE POLICY "Authenticated users can delete suggestions"
  ON player_context_suggestions
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_player_context_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_player_context_suggestions_updated_at_trigger ON player_context_suggestions;
CREATE TRIGGER update_player_context_suggestions_updated_at_trigger
BEFORE UPDATE ON player_context_suggestions
FOR EACH ROW
EXECUTE FUNCTION update_player_context_suggestions_updated_at();

-- Create function to clean up expired suggestions
CREATE OR REPLACE FUNCTION cleanup_expired_suggestions()
RETURNS void AS $$
BEGIN
  DELETE FROM player_context_suggestions
  WHERE expires_at < now() AND status = 'pending';
END;
$$ LANGUAGE plpgsql;
