/*
  # Add unique constraint on player_identity.search_name

  Needed so the upsert in sync-headshots-by-name can use onConflict: 'search_name'.
  Also ensure canonical_name column exists for storing the display name.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_identity' AND column_name = 'canonical_name'
  ) THEN
    ALTER TABLE player_identity ADD COLUMN canonical_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_identity_search_name_key'
  ) THEN
    ALTER TABLE player_identity ADD CONSTRAINT player_identity_search_name_key UNIQUE (search_name);
  END IF;
END $$;
