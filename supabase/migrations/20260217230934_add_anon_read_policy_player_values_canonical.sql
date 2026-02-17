/*
  # Allow anonymous users to read player values canonical

  ## Summary
  The dynasty rankings page (and other public-facing pages) query `latest_player_values`
  which is a view over `player_values_canonical`. The existing SELECT policy only grants
  access to `authenticated` users, so unauthenticated/guest visitors see empty tables.

  ## Changes
  - Add a SELECT policy granting `anon` role read access to `player_values_canonical`

  ## Security
  - Read-only, no PII involved — player values are public data
*/

CREATE POLICY "Anon can read player values"
  ON player_values_canonical
  FOR SELECT
  TO anon
  USING (true);
