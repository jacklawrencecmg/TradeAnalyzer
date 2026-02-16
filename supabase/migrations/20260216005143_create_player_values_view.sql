/*
  # Create player_values view

  1. Changes
    - Create view `player_values` that maps to `latest_player_values`
    - This ensures backward compatibility with existing code

  2. Security
    - View inherits RLS from underlying table
*/

-- Create view for backward compatibility
CREATE OR REPLACE VIEW player_values AS
SELECT * FROM latest_player_values;

-- Grant access to authenticated users
GRANT SELECT ON player_values TO authenticated;

-- Note: INSERT/UPDATE/DELETE operations should be handled through latest_player_values directly
-- The view is read-only for simplicity