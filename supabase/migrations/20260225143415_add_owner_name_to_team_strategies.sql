/*
  # Add owner_name to team_strategies

  Adds owner_name column to team_strategies table so cached results
  can return the team owner display name without extra lookups.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_strategies' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE team_strategies ADD COLUMN owner_name text;
  END IF;
END $$;
