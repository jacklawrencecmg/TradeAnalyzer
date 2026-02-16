/*
  # Fix Latest Player Values View Permissions

  1. Changes
    - Grant SELECT permission on latest_player_values view to anon and authenticated roles
    - This enables the player search functionality to work properly

  2. Security
    - View is read-only
    - Data is already filtered through the underlying table RLS policies
*/

-- Grant SELECT permissions on latest_player_values view
GRANT SELECT ON latest_player_values TO anon, authenticated;

-- Also ensure player_values view has correct permissions
GRANT SELECT ON player_values TO anon, authenticated;

COMMENT ON VIEW latest_player_values IS 
  'Canonical view of latest player values - accessible to all authenticated users';
