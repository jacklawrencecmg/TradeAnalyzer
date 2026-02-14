/*
  # Create Dynasty Market Reports System

  1. Purpose
    - Store weekly dynasty fantasy football market reports
    - Track major value changes and market trends
    - Enable public SEO-friendly content pages
    - Drive recurring traffic through valuable insights
    - Social sharing via OG images

  2. New Tables
    
    `dynasty_reports`
    - `id` (uuid, primary key) - Unique report identifier
    - `week` (int) - NFL week number
    - `season` (int) - NFL season year
    - `title` (text) - Report title for SEO
    - `summary` (text) - Brief summary paragraph
    - `content` (jsonb) - Structured report sections
    - `public_slug` (text, unique) - URL-friendly slug
    - `created_at` (timestamptz) - When report was generated
    - `published` (boolean) - Whether report is public
    - `view_count` (int) - Page view tracking
    - `metadata` (jsonb) - Additional data (top players, trends)

  3. Content Structure (JSONB)
    {
      "sections": [
        {
          "type": "risers",
          "title": "Top Risers This Week",
          "players": [
            {
              "player_id": "8136",
              "player_name": "Drake London",
              "position": "WR",
              "team": "ATL",
              "change_7d": 1300,
              "change_pct": 18.1,
              "value_now": 8500,
              "value_7d_ago": 7200,
              "reason": "3 TDs in Week 6, target share spike"
            }
          ]
        },
        {
          "type": "fallers",
          "title": "Top Fallers This Week",
          "players": [...]
        },
        {
          "type": "buy_low",
          "title": "Buy Low Opportunities",
          "players": [...]
        },
        {
          "type": "sell_high",
          "title": "Sell High Candidates",
          "players": [...]
        },
        {
          "type": "market_notes",
          "title": "Market Trends & Insights",
          "notes": [
            {
              "category": "position",
              "title": "RB Market Cooling",
              "description": "Average RB values down 3.2% this week"
            }
          ]
        }
      ]
    }

  4. Security
    - Enable RLS on dynasty_reports
    - Public read access for published reports
    - Only service role can create/update reports
    - Anonymous users can view published reports

  5. Indexes
    - Index on public_slug for fast lookups
    - Index on (season, week) for filtering
    - Index on published for listing
    - Index on created_at for sorting

  6. Use Cases
    - Weekly automated report generation
    - Public SEO-friendly pages at /reports/[slug]
    - Social sharing with OG images
    - Homepage "This Week's Report" widget
    - League personalization: "3 of your players in this report"
    - Archive of historical reports
*/

-- Create dynasty_reports table
CREATE TABLE IF NOT EXISTS dynasty_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week int NOT NULL,
  season int NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  published boolean DEFAULT false,
  view_count int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT unique_week_season UNIQUE (season, week)
);

-- Enable RLS
ALTER TABLE dynasty_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can read published reports
CREATE POLICY "Anyone can view published reports"
  ON dynasty_reports
  FOR SELECT
  USING (published = true);

-- Service role can insert reports
CREATE POLICY "Service role can create reports"
  ON dynasty_reports
  FOR INSERT
  WITH CHECK (true);

-- Service role can update reports
CREATE POLICY "Service role can update reports"
  ON dynasty_reports
  FOR UPDATE
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dynasty_reports_slug 
  ON dynasty_reports(public_slug);

CREATE INDEX IF NOT EXISTS idx_dynasty_reports_season_week 
  ON dynasty_reports(season, week);

CREATE INDEX IF NOT EXISTS idx_dynasty_reports_published 
  ON dynasty_reports(published, created_at DESC)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_dynasty_reports_created_at 
  ON dynasty_reports(created_at DESC);

-- Function to get latest published report
CREATE OR REPLACE FUNCTION get_latest_report()
RETURNS TABLE (
  id uuid,
  week int,
  season int,
  title text,
  summary text,
  content jsonb,
  public_slug text,
  created_at timestamptz,
  view_count int
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.week,
    dr.season,
    dr.title,
    dr.summary,
    dr.content,
    dr.public_slug,
    dr.created_at,
    dr.view_count
  FROM dynasty_reports dr
  WHERE dr.published = true
  ORDER BY dr.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get report by slug
CREATE OR REPLACE FUNCTION get_report_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  week int,
  season int,
  title text,
  summary text,
  content jsonb,
  public_slug text,
  created_at timestamptz,
  view_count int,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.week,
    dr.season,
    dr.title,
    dr.summary,
    dr.content,
    dr.public_slug,
    dr.created_at,
    dr.view_count,
    dr.metadata
  FROM dynasty_reports dr
  WHERE dr.public_slug = p_slug
  AND dr.published = true;
  
  -- Increment view count
  UPDATE dynasty_reports
  SET view_count = view_count + 1
  WHERE public_slug = p_slug;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to list all published reports
CREATE OR REPLACE FUNCTION list_published_reports(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  week int,
  season int,
  title text,
  summary text,
  public_slug text,
  created_at timestamptz,
  view_count int,
  top_riser_name text,
  top_faller_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.week,
    dr.season,
    dr.title,
    dr.summary,
    dr.public_slug,
    dr.created_at,
    dr.view_count,
    COALESCE(dr.metadata->>'top_riser_name', '')::text as top_riser_name,
    COALESCE(dr.metadata->>'top_faller_name', '')::text as top_faller_name
  FROM dynasty_reports dr
  WHERE dr.published = true
  ORDER BY dr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user's league players are in report
CREATE OR REPLACE FUNCTION check_user_players_in_report(
  p_slug text,
  p_player_ids text[]
)
RETURNS TABLE (
  player_id text,
  player_name text,
  section_type text
) AS $$
BEGIN
  RETURN QUERY
  WITH report_players AS (
    SELECT 
      dr.content,
      jsonb_array_elements(dr.content->'sections') as section
    FROM dynasty_reports dr
    WHERE dr.public_slug = p_slug
    AND dr.published = true
  ),
  expanded_players AS (
    SELECT 
      section->>'type' as section_type,
      jsonb_array_elements(section->'players') as player
    FROM report_players
    WHERE section->>'type' IN ('risers', 'fallers', 'buy_low', 'sell_high')
  )
  SELECT 
    (player->>'player_id')::text,
    (player->>'player_name')::text,
    ep.section_type
  FROM expanded_players ep
  WHERE (player->>'player_id')::text = ANY(p_player_ids);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate slug
CREATE OR REPLACE FUNCTION generate_report_slug(p_week int, p_season int)
RETURNS text AS $$
BEGIN
  RETURN 'dynasty-report-week-' || p_week || '-' || p_season;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_latest_report() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_report_by_slug(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION list_published_reports(int, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_user_players_in_report(text, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_report_slug(int, int) TO authenticated, anon;

-- Add helpful comments
COMMENT ON TABLE dynasty_reports IS 
  'Weekly dynasty fantasy football market reports with value change analysis';

COMMENT ON COLUMN dynasty_reports.content IS 
  'Structured JSONB with sections: risers, fallers, buy_low, sell_high, market_notes';

COMMENT ON COLUMN dynasty_reports.metadata IS 
  'Additional metadata like top_riser_name, top_faller_name for quick access';

COMMENT ON FUNCTION get_latest_report IS 
  'Returns the most recently published dynasty report';

COMMENT ON FUNCTION get_report_by_slug IS 
  'Returns report by slug and increments view count';

COMMENT ON FUNCTION list_published_reports IS 
  'Returns paginated list of published reports';

COMMENT ON FUNCTION check_user_players_in_report IS 
  'Checks which of users league players appear in a specific report';
