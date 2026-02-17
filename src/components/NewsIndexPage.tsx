import { useEffect, useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Target, Eye } from 'lucide-react';
import { Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { TableSkeleton } from './LoadingSkeleton';

interface Article {
  article_id: string;
  slug: string;
  headline: string;
  subheadline: string;
  article_type: string;
  publish_date: string;
  view_count: number;
  share_count: number;
}

export function NewsIndexPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Dynasty Football News & Analysis | Fantasy Draft Pros';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Latest dynasty fantasy football news, player value movements, buy-low targets, and market analysis. AI-generated insights updated daily.');
    }

    loadArticles();
  }, [filter]);

  async function loadArticles() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('get_recent_articles', {
          p_article_type: filter === 'all' ? null : filter,
          p_limit: 50
        });

      if (error) throw error;

      if (data) {
        setArticles(data);
      }
    } catch (err) {
      console.error('Error loading articles:', err);
    } finally {
      setLoading(false);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'riser':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'faller':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'buy_low':
        return <Target className="w-5 h-5 text-blue-500" />;
      default:
        return <TrendingUp className="w-5 h-5 text-fdp-accent-1" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-7xl mx-auto">
          <TableSkeleton rows={10} cols={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <span className="text-fdp-text-1">Dynasty News</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-fdp-text-1 mb-4">
            Dynasty Football News & Analysis
          </h1>
          <p className="text-lg text-fdp-text-2 max-w-3xl">
            AI-powered insights on player value movements, buy-low opportunities, and market trends. Updated daily based on real dynasty trade data and predictive analytics.
          </p>
        </div>

        <div className="flex gap-3 mb-8 overflow-x-auto">
          {[
            { value: 'all', label: 'All Articles' },
            { value: 'riser', label: 'Risers' },
            { value: 'faller', label: 'Fallers' },
            { value: 'buy_low', label: 'Buy Low' },
            { value: 'sell_high', label: 'Sell High' },
            { value: 'weekly_recap', label: 'Weekly Recaps' }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                filter === value
                  ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                  : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-fdp-surface-1 rounded-xl border border-fdp-border-1">
            <h3 className="text-xl font-bold text-fdp-text-1 mb-2">No Articles Yet</h3>
            <p className="text-fdp-text-3">
              Articles are generated daily based on player value movements and market trends.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map(article => (
              <Link
                key={article.article_id}
                to={`/news/${article.slug}`}
                className="block bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-fdp-surface-2 rounded-lg flex items-center justify-center">
                    {getIcon(article.article_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-fdp-surface-2 text-fdp-accent-1 text-xs font-semibold rounded uppercase">
                        {article.article_type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-4 text-xs text-fdp-text-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(article.publish_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {article.view_count} views
                        </span>
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-2">
                      {article.headline}
                    </h2>

                    {article.subheadline && (
                      <p className="text-fdp-text-3 line-clamp-2">
                        {article.subheadline}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
