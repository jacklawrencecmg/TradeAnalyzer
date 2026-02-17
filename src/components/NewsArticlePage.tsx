import { useEffect, useState } from 'react';
import { Calendar, TrendingUp, Share2, Eye } from 'lucide-react';
import { useParams, Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { generatePlayerSlug } from '../lib/seo/meta';
import { injectMultipleStructuredData } from '../lib/seo/structuredData';
import { ListSkeleton } from './LoadingSkeleton';

interface Article {
  article_id: string;
  slug: string;
  headline: string;
  subheadline: string;
  article_type: string;
  content_json: any;
  player_ids: string[];
  publish_date: string;
  last_modified: string;
  view_count: number;
  share_count: number;
  meta_description: string;
  keywords: string[];
}

interface PlayerCard {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  fdp_value: number;
  rank: number;
}

export function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    loadArticle();
  }, [slug]);

  async function loadArticle() {
    try {
      setLoading(true);
      setError('');

      const { data, error: articleError } = await supabase
        .from('generated_articles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (articleError) throw articleError;
      if (!data) {
        setError('Article not found');
        setLoading(false);
        return;
      }

      setArticle(data);

      await supabase.rpc('increment_article_views', { p_article_id: data.article_id });

      setMetaTags(data);
      injectArticleSchema(data);

      if (data.player_ids && data.player_ids.length > 0) {
        await loadPlayerCards(data.player_ids);
      }

      await loadRelatedArticles(data.article_type, data.article_id);

    } catch (err) {
      console.error('Error loading article:', err);
      setError('Failed to load article');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayerCards(playerIds: string[]) {
    try {
      const { data } = await supabase
        .rpc('get_latest_player_values', {})
        .in('player_id', playerIds.slice(0, 10));

      if (data) {
        const cards = data.map((p: any, index: number) => ({
          player_id: p.player_id,
          full_name: p.full_name,
          position: p.position,
          team: p.team,
          fdp_value: p.fdp_value || 0,
          rank: index + 1
        }));

        setPlayerCards(cards);
      }
    } catch (err) {
      console.error('Error loading player cards:', err);
    }
  }

  async function loadRelatedArticles(articleType: string, currentArticleId: string) {
    try {
      const { data } = await supabase
        .rpc('get_recent_articles', { p_article_type: articleType, p_limit: 4 });

      if (data) {
        setRelatedArticles(data.filter((a: Article) => a.article_id !== currentArticleId));
      }
    } catch (err) {
      console.error('Error loading related articles:', err);
    }
  }

  function setMetaTags(article: Article) {
    document.title = `${article.headline} | Fantasy Draft Pros`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && article.meta_description) {
      metaDesc.setAttribute('content', article.meta_description);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', article.headline);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && article.meta_description) {
      ogDesc.setAttribute('content', article.meta_description);
    }
  }

  function injectArticleSchema(article: Article) {
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'SportsArticle',
      headline: article.headline,
      description: article.subheadline,
      datePublished: article.publish_date,
      dateModified: article.last_modified,
      author: {
        '@type': 'Organization',
        name: 'Fantasy Draft Pros',
        url: 'https://www.fantasydraftpros.com'
      },
      publisher: {
        '@type': 'Organization',
        name: 'Fantasy Draft Pros',
        logo: {
          '@type': 'ImageObject',
          url: 'https://raw.githubusercontent.com/jacklawrencecmg/jacklawrencecmg.github.io/main/logo-shield.png'
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://www.fantasydraftpros.com/news/${article.slug}`
      }
    };

    injectMultipleStructuredData([articleSchema]);
  }

  async function handleShare() {
    if (!article) return;

    await supabase.rpc('increment_article_shares', { p_article_id: article.article_id });

    const url = `https://www.fantasydraftpros.com/news/${article.slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: article.headline,
          text: article.subheadline,
          url: url
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-4xl mx-auto">
          <ListSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-fdp-text-1 mb-4">Article Not Found</h1>
          <p className="text-fdp-text-3 mb-8">{error}</p>
          <Link
            to="/"
            className="text-fdp-accent-1 hover:text-fdp-accent-2 font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const publishDate = new Date(article.publish_date);
  const lastModified = new Date(article.last_modified);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-8 px-4">
      <article className="max-w-4xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <Link to="/news" className="hover:text-fdp-accent-1">Dynasty News</Link>
          {' / '}
          <span className="text-fdp-text-1">Article</span>
        </nav>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 text-sm font-semibold rounded-full uppercase">
              {article.article_type.replace('_', ' ')}
            </span>
            <div className="flex items-center gap-4 text-sm text-fdp-text-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {publishDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {article.view_count} views
              </span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-fdp-text-1 mb-4 leading-tight">
            {article.headline}
          </h1>

          {article.subheadline && (
            <p className="text-xl text-fdp-text-2 mb-6 leading-relaxed">
              {article.subheadline}
            </p>
          )}

          <div className="flex items-center justify-between py-4 border-t border-b border-fdp-border-1">
            <div className="text-sm text-fdp-text-3">
              By <span className="font-semibold text-fdp-text-1">FDP Model</span>
              {lastModified > publishDate && (
                <span className="ml-2">• Updated {getRelativeTime(lastModified)}</span>
              )}
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 text-fdp-accent-1 hover:text-fdp-accent-2 font-semibold transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </header>

        {playerCards.length > 0 && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {playerCards.slice(0, 6).map(player => (
              <Link
                key={player.player_id}
                to={`/dynasty-value/${generatePlayerSlug(player.full_name)}`}
                className="bg-fdp-surface-1 rounded-lg p-4 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors">
                      {player.full_name}
                    </div>
                    <div className="text-sm text-fdp-text-3">
                      {player.position} • {player.team || 'FA'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-fdp-accent-1">{player.fdp_value}</div>
                    <div className="text-xs text-fdp-text-3">Dynasty Value</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none mb-12">
          {article.content_json.sections?.map((section: any, index: number) => (
            <section key={index} className="mb-8">
              <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">{section.heading}</h2>
              {section.paragraphs?.map((paragraph: string, pIndex: number) => (
                <p key={pIndex} className="text-fdp-text-2 mb-4 leading-relaxed">
                  {renderParagraph(paragraph)}
                </p>
              ))}
            </section>
          ))}
        </div>

        {relatedArticles.length > 0 && (
          <div className="border-t border-fdp-border-1 pt-8">
            <h3 className="text-2xl font-bold text-fdp-text-1 mb-6">More Dynasty Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedArticles.slice(0, 4).map(related => (
                <Link
                  key={related.article_id}
                  to={`/news/${related.slug}`}
                  className="bg-fdp-surface-1 rounded-lg p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
                >
                  <div className="text-xs text-fdp-accent-1 font-semibold uppercase mb-2">
                    {related.article_type.replace('_', ' ')}
                  </div>
                  <h4 className="text-lg font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-2">
                    {related.headline}
                  </h4>
                  <p className="text-sm text-fdp-text-3 line-clamp-2">
                    {related.subheadline}
                  </p>
                  <div className="text-xs text-fdp-text-3 mt-4">
                    {new Date(related.publish_date).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function renderParagraph(text: string): React.ReactNode {
  const boldPattern = /\*\*(.*?)\*\*/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}
