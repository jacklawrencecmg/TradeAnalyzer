import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Target, ArrowRight } from 'lucide-react';
import { Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';

interface FeaturedArticle {
  article_id: string;
  slug: string;
  headline: string;
  subheadline: string;
  article_type: string;
  publish_date: string;
  view_count: number;
}

export function TodayInDynasty() {
  const [articles, setArticles] = useState<FeaturedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedArticles();
  }, []);

  async function loadFeaturedArticles() {
    try {
      const { data, error } = await supabase
        .rpc('get_featured_articles', { p_limit: 3 });

      if (error) throw error;

      if (data) {
        setArticles(data);
      }
    } catch (err) {
      console.error('Error loading featured articles:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || articles.length === 0) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'riser':
        return <TrendingUp className="w-6 h-6" />;
      case 'faller':
        return <TrendingDown className="w-6 h-6" />;
      case 'buy_low':
        return <Target className="w-6 h-6" />;
      default:
        return <TrendingUp className="w-6 h-6" />;
    }
  };

  const getGradient = (type: string) => {
    switch (type) {
      case 'riser':
        return 'from-green-500 to-emerald-600';
      case 'faller':
        return 'from-red-500 to-rose-600';
      case 'buy_low':
        return 'from-blue-500 to-indigo-600';
      default:
        return 'from-fdp-accent-1 to-fdp-accent-2';
    }
  };

  return (
    <div className="max-w-7xl mx-auto mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-fdp-text-1">
          Today in Dynasty Football
        </h2>
        <Link
          to="/news"
          className="text-fdp-accent-1 hover:text-fdp-accent-2 font-semibold flex items-center gap-2"
        >
          View All Articles
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {articles.map(article => (
          <Link
            key={article.article_id}
            to={`/news/${article.slug}`}
            className="bg-fdp-surface-1 rounded-xl border border-fdp-border-1 hover:border-fdp-accent-1 transition-all overflow-hidden group"
          >
            <div className={`bg-gradient-to-r ${getGradient(article.article_type)} p-6 text-white`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold uppercase opacity-90">
                  {article.article_type.replace('_', ' ')}
                </span>
                {getIcon(article.article_type)}
              </div>
              <h3 className="text-xl font-bold leading-tight">
                {article.headline}
              </h3>
            </div>

            <div className="p-6">
              <p className="text-fdp-text-3 text-sm line-clamp-3 mb-4">
                {article.subheadline}
              </p>

              <div className="flex items-center justify-between text-xs text-fdp-text-3">
                <span>{new Date(article.publish_date).toLocaleDateString()}</span>
                <span className="text-fdp-accent-1 group-hover:text-fdp-accent-2 font-semibold flex items-center gap-1">
                  Read More
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center py-12 bg-fdp-surface-1 rounded-xl border border-fdp-border-1">
          <p className="text-fdp-text-3">
            New articles are generated daily based on player value movements.
          </p>
        </div>
      )}
    </div>
  );
}
