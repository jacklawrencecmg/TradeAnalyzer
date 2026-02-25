/*
  # Fix get_watchlist_with_players RPC

  The function referenced non-existent columns on player_values:
  - `pv.full_name` → correct column is `pv.player_name`
  - `pv.fdp_value` → correct column is `pv.adjusted_value`

  Drop and recreate with correct column names.
*/

DROP FUNCTION IF EXISTS get_watchlist_with_players(text);

CREATE FUNCTION get_watchlist_with_players(p_session_id text)
RETURNS TABLE (
  player_id text,
  added_at timestamptz,
  notes text,
  player_name text,
  player_position text,
  team text,
  value_now numeric,
  change_7d numeric,
  change_30d numeric,
  trend_tag text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wp.player_id,
    wp.added_at,
    wp.notes,
    pv.player_name as player_name,
    pv.position as player_position,
    pv.team,
    pv.adjusted_value as value_now,
    COALESCE(
      (SELECT pv.adjusted_value - s.fdp_value
       FROM ktc_value_snapshots s
       WHERE s.player_id = wp.player_id
       AND s.snapshot_date >= now() - interval '7 days'
       ORDER BY s.snapshot_date ASC LIMIT 1),
      0
    ) as change_7d,
    COALESCE(
      (SELECT pv.adjusted_value - s.fdp_value
       FROM ktc_value_snapshots s
       WHERE s.player_id = wp.player_id
       AND s.snapshot_date >= now() - interval '30 days'
       ORDER BY s.snapshot_date ASC LIMIT 1),
      0
    ) as change_30d,
    COALESCE(
      (SELECT pmt.tag
       FROM player_market_trends pmt
       WHERE pmt.player_id = wp.player_id
       ORDER BY pmt.computed_at DESC LIMIT 1),
      'stable'
    ) as trend_tag
  FROM watchlist_players wp
  INNER JOIN user_watchlists uw ON uw.id = wp.watchlist_id
  LEFT JOIN player_values pv ON pv.player_id = wp.player_id
  WHERE uw.session_id = p_session_id
  ORDER BY wp.added_at DESC;
END;
$$;
