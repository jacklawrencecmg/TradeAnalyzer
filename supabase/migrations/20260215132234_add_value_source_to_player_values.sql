/*
  # Add value_source field to player_values

  1. Changes
    - Add `redraft_value_source` column to track how redraft value was calculated
    - Possible values: 'adp' (from market data), 'heuristic' (from model), 'idp_tier' (IDP fallback)
  
  2. Notes
    - Dynasty values always use model, only redraft varies by source
    - This enables transparency in the UI about value origins
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_values' AND column_name = 'redraft_value_source'
  ) THEN
    ALTER TABLE player_values 
    ADD COLUMN redraft_value_source text DEFAULT 'heuristic' CHECK (
      redraft_value_source IN ('adp', 'heuristic', 'idp_tier')
    );

    CREATE INDEX IF NOT EXISTS idx_player_values_redraft_source 
    ON player_values(redraft_value_source);

    COMMENT ON COLUMN player_values.redraft_value_source IS 
      'Source of redraft value: adp (market), heuristic (model), or idp_tier (IDP fallback)';
  END IF;
END $$;
