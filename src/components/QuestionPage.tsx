import { useEffect, useState } from 'react';
import { HelpCircle, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { useParams, Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { generatePlayerSlug } from '../lib/seo/meta';
import { injectMultipleStructuredData } from '../lib/seo/structuredData';
import { ListSkeleton } from './LoadingSkeleton';

interface QuestionPage {
  page_id: string;
  slug: string;
  question: string;
  question_type: string;
  player_id: string;
  player_id_2?: string;
  short_answer: string;
  explanation_json: any;
  value_data: any;
  similar_players: string[];
  publish_date: string;
  last_modified: string;
  meta_description: string;
  keywords: string[];
}

export function QuestionPageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<QuestionPage | null>(null);
  const [relatedQuestions, setRelatedQuestions] = useState<QuestionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    loadQuestionPage();
  }, [slug]);

  async function loadQuestionPage() {
    try {
      setLoading(true);
      setError('');

      const { data, error: pageError } = await supabase
        .from('generated_question_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (pageError) throw pageError;
      if (!data) {
        setError('Question not found');
        setLoading(false);
        return;
      }

      setPage(data);

      await supabase.rpc('increment_question_page_views', { p_page_id: data.page_id });

      setMetaTags(data);
      injectQuestionSchema(data);

      await loadRelatedQuestions(data.player_id, data.page_id);
    } catch (err) {
      console.error('Error loading question page:', err);
      setError('Failed to load question');
    } finally {
      setLoading(false);
    }
  }

  async function loadRelatedQuestions(playerId: string, currentPageId: string) {
    try {
      const { data } = await supabase
        .rpc('get_player_question_pages', { p_player_id: playerId });

      if (data) {
        setRelatedQuestions(data.filter((q: QuestionPage) => q.page_id !== currentPageId));
      }
    } catch (err) {
      console.error('Error loading related questions:', err);
    }
  }

  function setMetaTags(page: QuestionPage) {
    document.title = `${page.question} | Fantasy Draft Pros`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && page.meta_description) {
      metaDesc.setAttribute('content', page.meta_description);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', page.question);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && page.short_answer) {
      ogDesc.setAttribute('content', page.short_answer);
    }
  }

  function injectQuestionSchema(page: QuestionPage) {
    const qaSchema = {
      '@context': 'https://schema.org',
      '@type': 'QAPage',
      mainEntity: {
        '@type': 'Question',
        name: page.question,
        text: page.question,
        answerCount: 1,
        acceptedAnswer: {
          '@type': 'Answer',
          text: page.short_answer,
          dateCreated: page.publish_date,
          dateModified: page.last_modified,
          author: {
            '@type': 'Organization',
            name: 'Fantasy Draft Pros'
          }
        }
      }
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://www.fantasydraftpros.com'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Dynasty Questions',
          item: 'https://www.fantasydraftpros.com/questions'
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: page.question,
          item: `https://www.fantasydraftpros.com/questions/${page.slug}`
        }
      ]
    };

    injectMultipleStructuredData([qaSchema, breadcrumbSchema]);
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

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-fdp-text-1 mb-4">Question Not Found</h1>
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

  const lastModified = new Date(page.last_modified);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-8 px-4">
      <article className="max-w-4xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <Link to="/questions" className="hover:text-fdp-accent-1">Dynasty Questions</Link>
          {' / '}
          <span className="text-fdp-text-1">Answer</span>
        </nav>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <span className="px-3 py-1 bg-fdp-surface-2 text-fdp-accent-1 text-sm font-semibold rounded-full uppercase">
              {page.question_type.replace('_', ' ')}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-fdp-text-1 mb-6 leading-tight">
            {page.question}
          </h1>

          <div className="bg-gradient-to-r from-fdp-accent-1/10 to-fdp-accent-2/10 border-l-4 border-fdp-accent-1 rounded-lg p-6 mb-6">
            <div className="text-sm font-semibold text-fdp-accent-1 mb-2">SHORT ANSWER</div>
            <p className="text-lg text-fdp-text-1 leading-relaxed">
              {page.short_answer}
            </p>
          </div>

          <div className="text-sm text-fdp-text-3">
            Last updated {lastModified.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </header>

        {page.value_data && (
          <div className="mb-8 bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
            <h3 className="text-xl font-bold text-fdp-text-1 mb-4">Dynasty Value Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {page.value_data.primary_player && (
                <Link
                  to={`/dynasty-value/${generatePlayerSlug(page.value_data.primary_player.full_name)}`}
                  className="bg-fdp-surface-2 rounded-lg p-4 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
                >
                  <div className="text-sm text-fdp-text-3 mb-1">
                    {page.value_data.primary_player.position} • {page.value_data.primary_player.team || 'FA'}
                  </div>
                  <div className="font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-2">
                    {page.value_data.primary_player.full_name}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-fdp-accent-1">
                      {page.value_data.primary_player.fdp_value}
                    </div>
                    <div className="text-sm text-fdp-text-3">Dynasty Value</div>
                  </div>
                  {page.value_data.primary_player.rank > 0 && (
                    <div className="text-xs text-fdp-text-3 mt-2">
                      Rank #{page.value_data.primary_player.rank}
                    </div>
                  )}
                </Link>
              )}

              {page.value_data.secondary_player && (
                <Link
                  to={`/dynasty-value/${generatePlayerSlug(page.value_data.secondary_player.full_name)}`}
                  className="bg-fdp-surface-2 rounded-lg p-4 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
                >
                  <div className="text-sm text-fdp-text-3 mb-1">
                    {page.value_data.secondary_player.position} • {page.value_data.secondary_player.team || 'FA'}
                  </div>
                  <div className="font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-2">
                    {page.value_data.secondary_player.full_name}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-fdp-accent-1">
                      {page.value_data.secondary_player.fdp_value}
                    </div>
                    <div className="text-sm text-fdp-text-3">Dynasty Value</div>
                  </div>
                  {page.value_data.secondary_player.rank > 0 && (
                    <div className="text-xs text-fdp-text-3 mt-2">
                      Rank #{page.value_data.secondary_player.rank}
                    </div>
                  )}
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="prose prose-invert prose-lg max-w-none mb-12">
          {page.explanation_json.sections?.map((section: any, index: number) => (
            <section key={index} className="mb-8">
              <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">{section.heading}</h2>
              {section.paragraphs?.map((paragraph: string, pIndex: number) => (
                <p key={pIndex} className="text-fdp-text-2 mb-4 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-fdp-accent-1" />
            <h3 className="text-xl font-bold text-fdp-text-1">Check Current Dynasty Values</h3>
          </div>
          <p className="text-fdp-text-3 mb-4">
            Get real-time dynasty values, rankings, and trade analysis for all players.
          </p>
          <div className="flex gap-3">
            <Link
              to="/dynasty-rankings"
              className="px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              View Rankings
            </Link>
            <Link
              to="/"
              className="px-4 py-2 bg-fdp-surface-2 text-fdp-text-1 rounded-lg font-semibold hover:bg-fdp-border-1 transition-colors"
            >
              Trade Calculator
            </Link>
          </div>
        </div>

        {relatedQuestions.length > 0 && (
          <div className="border-t border-fdp-border-1 pt-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-fdp-accent-1" />
              <h3 className="text-2xl font-bold text-fdp-text-1">Related Questions</h3>
            </div>
            <div className="space-y-4">
              {relatedQuestions.slice(0, 5).map(related => (
                <Link
                  key={related.page_id}
                  to={`/questions/${related.slug}`}
                  className="block bg-fdp-surface-1 rounded-lg p-4 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-fdp-accent-1 font-semibold uppercase mb-2">
                        {related.question_type.replace('_', ' ')}
                      </div>
                      <h4 className="text-lg font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-2">
                        {related.question}
                      </h4>
                      <p className="text-sm text-fdp-text-3 line-clamp-2">
                        {related.short_answer}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-fdp-text-3 group-hover:text-fdp-accent-1 transition-colors flex-shrink-0" />
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
