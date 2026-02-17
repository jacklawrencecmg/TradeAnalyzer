/*
  # Create Question Pages System for Long-Tail Search Capture

  1. New Tables
    - `generated_question_pages`
      - `page_id` (uuid, primary key)
      - `slug` (text, unique) - SEO-friendly URL
      - `question` (text) - Natural language question
      - `question_type` (text) - 'buy_low', 'sell_high', 'dynasty_outlook', 'trade_comparison', 'keep_or_trade', 'tier_ranking'
      - `player_id` (text) - Primary player
      - `player_id_2` (text) - Secondary player for comparisons
      - `short_answer` (text) - 2-3 sentence answer
      - `explanation_json` (jsonb) - Structured explanation sections
      - `value_data` (jsonb) - FDP values and comparison data
      - `similar_players` (text[]) - Related player IDs
      - `publish_date` (timestamptz)
      - `last_modified` (timestamptz)
      - `view_count` (integer)
      - `answer_quality_score` (numeric) - Content quality metric
      - `meta_description` (text)
      - `keywords` (text[])

    - `question_page_updates`
      - Tracks when pages need regeneration
      - `page_id` (uuid, FK)
      - `trigger_reason` (text)
      - `processed` (boolean)

  2. Security
    - Enable RLS on both tables
    - Public read access
    - Admin-only write access
*/

-- Generated Question Pages Table
CREATE TABLE IF NOT EXISTS generated_question_pages (
  page_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  question text NOT NULL,
  question_type text NOT NULL,
  player_id text NOT NULL,
  player_id_2 text,
  short_answer text NOT NULL,
  explanation_json jsonb NOT NULL,
  value_data jsonb NOT NULL,
  similar_players text[] DEFAULT '{}',
  publish_date timestamptz DEFAULT now(),
  last_modified timestamptz DEFAULT now(),
  view_count integer DEFAULT 0,
  answer_quality_score numeric DEFAULT 0.8,
  meta_description text,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Question Page Updates Tracking
CREATE TABLE IF NOT EXISTS question_page_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES generated_question_pages(page_id) ON DELETE CASCADE,
  trigger_reason text NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_pages_slug ON generated_question_pages(slug);
CREATE INDEX IF NOT EXISTS idx_question_pages_type ON generated_question_pages(question_type);
CREATE INDEX IF NOT EXISTS idx_question_pages_player ON generated_question_pages(player_id);
CREATE INDEX IF NOT EXISTS idx_question_pages_modified ON generated_question_pages(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_question_page_updates_pending ON question_page_updates(processed) WHERE processed = false;

-- Enable RLS
ALTER TABLE generated_question_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_page_updates ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view question pages"
  ON generated_question_pages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can view question page updates"
  ON question_page_updates FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write access
CREATE POLICY "Service role can manage question pages"
  ON generated_question_pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage updates"
  ON question_page_updates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_question_page_views(p_page_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE generated_question_pages
  SET view_count = view_count + 1
  WHERE page_id = p_page_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get question pages by type
CREATE OR REPLACE FUNCTION get_question_pages_by_type(
  p_question_type text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  page_id uuid,
  slug text,
  question text,
  question_type text,
  player_id text,
  short_answer text,
  publish_date timestamptz,
  view_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.page_id,
    q.slug,
    q.question,
    q.question_type,
    q.player_id,
    q.short_answer,
    q.publish_date,
    q.view_count
  FROM generated_question_pages q
  WHERE (p_question_type IS NULL OR q.question_type = p_question_type)
  ORDER BY q.last_modified DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get question pages for a player
CREATE OR REPLACE FUNCTION get_player_question_pages(p_player_id text)
RETURNS TABLE (
  page_id uuid,
  slug text,
  question text,
  question_type text,
  short_answer text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.page_id,
    q.slug,
    q.question,
    q.question_type,
    q.short_answer
  FROM generated_question_pages q
  WHERE q.player_id = p_player_id
     OR q.player_id_2 = p_player_id
  ORDER BY q.view_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to mark pages for regeneration when values change
CREATE OR REPLACE FUNCTION trigger_question_page_updates()
RETURNS void AS $$
BEGIN
  -- Mark all pages that reference recently updated players for regeneration
  INSERT INTO question_page_updates (page_id, trigger_reason)
  SELECT DISTINCT q.page_id, 'value_epoch_change'
  FROM generated_question_pages q
  WHERE q.last_modified < (now() - interval '1 day')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending updates
CREATE OR REPLACE FUNCTION get_pending_question_updates(p_limit integer DEFAULT 100)
RETURNS TABLE (
  page_id uuid,
  slug text,
  player_id text,
  trigger_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.page_id,
    q.slug,
    q.player_id,
    u.trigger_reason
  FROM question_page_updates u
  JOIN generated_question_pages q ON u.page_id = q.page_id
  WHERE u.processed = false
  ORDER BY u.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
