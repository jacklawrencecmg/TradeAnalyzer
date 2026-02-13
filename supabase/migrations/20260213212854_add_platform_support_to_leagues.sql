/*
  # Add Multi-Platform Support to Leagues

  1. Changes
    - Add `platform` column to user_leagues table (sleeper, espn, yahoo, nfl)
    - Add `platform_settings` jsonb column for platform-specific configuration
    - Add indexes for platform filtering
    - Set default platform to 'sleeper' for existing records
  
  2. Security
    - No RLS changes needed (already configured)
    - Platform settings are user-specific
  
  3. Notes
    - Supports Sleeper, ESPN, Yahoo Fantasy, and NFL.com
    - Platform settings store auth tokens, cookies, or platform-specific data
    - Backward compatible with existing Sleeper leagues
*/

-- Add platform column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_leagues' AND column_name = 'platform'
  ) THEN
    ALTER TABLE user_leagues ADD COLUMN platform text DEFAULT 'sleeper';
  END IF;
END $$;

-- Add platform_settings column for storing platform-specific data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_leagues' AND column_name = 'platform_settings'
  ) THEN
    ALTER TABLE user_leagues ADD COLUMN platform_settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add check constraint for valid platforms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_leagues_platform_check'
  ) THEN
    ALTER TABLE user_leagues 
    ADD CONSTRAINT user_leagues_platform_check 
    CHECK (platform IN ('sleeper', 'espn', 'yahoo', 'nfl'));
  END IF;
END $$;

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_user_leagues_platform ON user_leagues(platform);
CREATE INDEX IF NOT EXISTS idx_user_leagues_user_platform ON user_leagues(user_id, platform);

-- Add comment explaining platform column
COMMENT ON COLUMN user_leagues.platform IS 'Fantasy platform: sleeper, espn, yahoo, or nfl';
COMMENT ON COLUMN user_leagues.platform_settings IS 'Platform-specific settings like auth tokens, league settings, etc.';
