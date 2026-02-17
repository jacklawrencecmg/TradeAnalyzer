/*
  # Create Generated Articles System for Google Discover & Reddit Traffic

  1. New Tables
    - `generated_articles`
      - `article_id` (uuid, primary key)
      - `slug` (text, unique)
      - `headline` (text)
      - `subheadline` (text)
      - `article_type` (text) - 'riser', 'faller', 'buy_low', 'sell_high', 'weekly_recap', 'market_inefficiency'
      - `content_json` (jsonb) - structured content data
      - `player_ids` (text[]) - array of featured players
      - `publish_date` (timestamptz)
      - `last_modified` (timestamptz)
      - `view_count` (integer)
      - `share_count` (integer)
      - `featured` (boolean)
      - `meta_description` (text)
      - `keywords` (text[])
      - `share_image_url` (text)

    - `article_player_mentions`
      - Links articles to players for tracking
      - `article_id` (uuid, FK)
      - `player_id` (text)
      - `mention_context` (text)

  2. Security
    - Enable RLS on both tables
    - Public read access for articles
    - Admin-only write access
*/

-- Generated Articles Table
CREATE TABLE IF NOT EXISTS generated_articles (
  article_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  headline text NOT NULL,
  subheadline text,
  article_type text NOT NULL,
  content_json jsonb NOT NULL,
  player_ids text[] DEFAULT '{}',
  publish_date timestamptz DEFAULT now(),
  last_modified timestamptz DEFAULT now(),
  view_count integer DEFAULT 0,
  share_count integer DEFAULT 0,
  featured boolean DEFAULT false,
  meta_description text,
  keywords text[] DEFAULT '{}',
  share_image_url text,
  created_at timestamptz DEFAULT now()
);

-- Article Player Mentions (for tracking and internal linking)
CREATE TABLE IF NOT EXISTS article_player_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES generated_articles(article_id) ON DELETE CASCADE,
  player_id text NOT NULL,
  mention_context text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_slug ON generated_articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_type ON generated_articles(article_type);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON generated_articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON generated_articles(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_article_mentions_article ON article_player_mentions(article_id);
CREATE INDEX IF NOT EXISTS idx_article_mentions_player ON article_player_mentions(player_id);

-- Enable RLS
ALTER TABLE generated_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_player_mentions ENABLE ROW LEVEL SECURITY;

-- Public read access for articles
CREATE POLICY "Anyone can view published articles"
  ON generated_articles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public read access for mentions
CREATE POLICY "Anyone can view article mentions"
  ON article_player_mentions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write access (using service role)
CREATE POLICY "Service role can insert articles"
  ON generated_articles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update articles"
  ON generated_articles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete articles"
  ON generated_articles FOR DELETE
  TO service_role
  USING (true);

-- Helper function to increment view count
CREATE OR REPLACE FUNCTION increment_article_views(p_article_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE generated_articles
  SET view_count = view_count + 1
  WHERE article_id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to increment share count
CREATE OR REPLACE FUNCTION increment_article_shares(p_article_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE generated_articles
  SET share_count = share_count + 1
  WHERE article_id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent articles by type
CREATE OR REPLACE FUNCTION get_recent_articles(
  p_article_type text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  article_id uuid,
  slug text,
  headline text,
  subheadline text,
  article_type text,
  content_json jsonb,
  player_ids text[],
  publish_date timestamptz,
  last_modified timestamptz,
  view_count integer,
  share_count integer,
  featured boolean,
  meta_description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.article_id,
    a.slug,
    a.headline,
    a.subheadline,
    a.article_type,
    a.content_json,
    a.player_ids,
    a.publish_date,
    a.last_modified,
    a.view_count,
    a.share_count,
    a.featured,
    a.meta_description
  FROM generated_articles a
  WHERE (p_article_type IS NULL OR a.article_type = p_article_type)
  ORDER BY a.publish_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get featured articles
CREATE OR REPLACE FUNCTION get_featured_articles(p_limit integer DEFAULT 3)
RETURNS TABLE (
  article_id uuid,
  slug text,
  headline text,
  subheadline text,
  article_type text,
  content_json jsonb,
  player_ids text[],
  publish_date timestamptz,
  view_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.article_id,
    a.slug,
    a.headline,
    a.subheadline,
    a.article_type,
    a.content_json,
    a.player_ids,
    a.publish_date,
    a.view_count
  FROM generated_articles a
  WHERE a.featured = true
  ORDER BY a.publish_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;