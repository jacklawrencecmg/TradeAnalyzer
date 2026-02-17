import { useEffect, useState } from 'react';
import { HelpCircle, TrendingUp, TrendingDown, Target, MessageSquare } from 'lucide-react';
import { Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { TableSkeleton } from './LoadingSkeleton';

interface QuestionPreview {
  page_id: string;
  slug: string;
  question: string;
  question_type: string;
  player_id: string;
  short_answer: string;
  publish_date: string;
  view_count: number;
}

export function QuestionsIndexPage() {
  const [questions, setQuestions] = useState<QuestionPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    document.title = 'Dynasty Fantasy Football Questions & Answers | Fantasy Draft Pros';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Expert answers to dynasty fantasy football questions. Player analysis, trade advice, buy-low targets, and long-term outlook for all dynasty assets.');
    }

    loadQuestions();
  }, [filter]);

  async function loadQuestions() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('get_question_pages_by_type', {
          p_question_type: filter === 'all' ? null : filter,
          p_limit: 100
        });

      if (error) throw error;

      if (data) {
        setQuestions(data);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'buy_low':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'sell_high':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'dynasty_outlook':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'trade_comparison':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-fdp-accent-1" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-7xl mx-auto">
          <TableSkeleton rows={10} cols={2} />
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
          <span className="text-fdp-text-1">Dynasty Questions</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-fdp-text-1 mb-4">
            Dynasty Fantasy Football Questions
          </h1>
          <p className="text-lg text-fdp-text-2 max-w-3xl">
            Expert answers to your dynasty questions powered by advanced analytics. Get insights on player values, trade decisions, buy-low opportunities, and long-term dynasty strategy.
          </p>
        </div>

        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All Questions', icon: HelpCircle },
            { value: 'buy_low', label: 'Buy Low', icon: Target },
            { value: 'dynasty_outlook', label: 'Dynasty Outlook', icon: TrendingUp },
            { value: 'trade_comparison', label: 'Trade Advice', icon: MessageSquare },
            { value: 'sell_high', label: 'Sell High', icon: TrendingDown }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                filter === value
                  ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                  : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-16 bg-fdp-surface-1 rounded-xl border border-fdp-border-1">
            <HelpCircle className="w-16 h-16 text-fdp-text-3 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-fdp-text-1 mb-2">No Questions Yet</h3>
            <p className="text-fdp-text-3">
              Questions are automatically generated based on player values and market trends.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {questions.map(question => (
              <Link
                key={question.page_id}
                to={`/questions/${question.slug}`}
                className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-fdp-surface-2 rounded-lg flex items-center justify-center">
                    {getIcon(question.question_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-fdp-accent-1 font-semibold uppercase mb-2">
                      {question.question_type.replace('_', ' ')}
                    </div>

                    <h2 className="text-xl font-bold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors mb-3">
                      {question.question}
                    </h2>

                    <p className="text-fdp-text-3 text-sm line-clamp-3 mb-3">
                      {question.short_answer}
                    </p>

                    <div className="flex items-center justify-between text-xs text-fdp-text-3">
                      <span>{question.view_count} views</span>
                      <span className="text-fdp-accent-1 group-hover:text-fdp-accent-2 font-semibold">
                        Read Answer →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 bg-gradient-to-r from-fdp-surface-1 to-fdp-surface-2 rounded-xl p-8 border border-fdp-border-1">
          <h3 className="text-2xl font-bold text-fdp-text-1 mb-4">Can't Find Your Question?</h3>
          <p className="text-fdp-text-2 mb-6">
            Use our dynasty rankings and trade calculator to analyze any player or trade scenario in real-time.
          </p>
          <div className="flex gap-4">
            <Link
              to="/dynasty-rankings"
              className="px-6 py-3 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              View Rankings
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-fdp-surface-2 text-fdp-text-1 rounded-lg font-semibold hover:bg-fdp-border-1 transition-colors"
            >
              Trade Calculator
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
