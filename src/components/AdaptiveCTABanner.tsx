import { useState, useEffect } from 'react';
import { X, TrendingUp, Star, Zap, ArrowRight } from 'lucide-react';
import { useVisitorTracking } from '../hooks/useVisitorTracking';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface CTAVariant {
  id: string;
  headline: string;
  subheadline: string;
}

interface IntentMessages {
  low: { headline: string; subheadline: string; icon: JSX.Element };
  medium: { headline: string; subheadline: string; icon: JSX.Element };
  high: { headline: string; subheadline: string; icon: JSX.Element };
}

const INTENT_MESSAGES: IntentMessages = {
  low: {
    headline: 'Dynasty Values',
    subheadline: 'See real dynasty values — updated daily',
    icon: <TrendingUp className="w-5 h-5" />
  },
  medium: {
    headline: 'Save Your Watchlist',
    subheadline: 'Track players and get alerts on value changes',
    icon: <Star className="w-5 h-5" />
  },
  high: {
    headline: 'Save This Trade',
    subheadline: 'Track value changes and get alerts',
    icon: <Zap className="w-5 h-5" />
  }
};

export function AdaptiveCTABanner() {
  const { user } = useAuth();
  const { intent, sessionId, loading, track, isReturningVisitor } = useVisitorTracking();
  const [dismissed, setDismissed] = useState(false);
  const [variant, setVariant] = useState<CTAVariant | null>(null);
  const [experimentId, setExperimentId] = useState<string | null>(null);

  useEffect(() => {
    if (user || loading || !sessionId) return;

    const dismissedKey = 'fdp_cta_dismissed';
    if (localStorage.getItem(dismissedKey)) {
      setDismissed(true);
      return;
    }

    loadExperimentVariant();
  }, [user, loading, sessionId]);

  async function loadExperimentVariant() {
    try {
      const { data } = await supabase
        .rpc('get_experiment_variant', {
          p_experiment_name: 'headline_test',
          p_session_id: sessionId
        });

      if (data) {
        setVariant(data);

        const { data: experiment } = await supabase
          .from('cta_experiments')
          .select('experiment_id')
          .eq('experiment_name', 'headline_test')
          .eq('is_active', true)
          .single();

        if (experiment) {
          setExperimentId(experiment.experiment_id);

          await supabase
            .from('cta_experiment_results')
            .insert({
              experiment_id: experiment.experiment_id,
              variant_id: data.id,
              session_id: sessionId,
              shown_at: new Date().toISOString()
            });
        }
      }
    } catch (error) {
      console.error('Failed to load experiment variant:', error);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('fdp_cta_dismissed', 'true');
  }

  async function handleClick() {
    await track('click_cta', {
      intent_level: intent.level,
      variant_id: variant?.id
    });

    if (experimentId && variant) {
      await supabase
        .from('cta_experiment_results')
        .update({ clicked: true })
        .eq('experiment_id', experimentId)
        .eq('variant_id', variant.id)
        .eq('session_id', sessionId);
    }

    window.location.href = '/auth?action=signup';
  }

  if (user || dismissed || loading) {
    return null;
  }

  const message = INTENT_MESSAGES[intent.level];
  const headline = variant?.headline || message.headline;
  const subheadline = variant?.subheadline || message.subheadline;

  return (
    <div className="fixed bottom-6 right-6 max-w-md z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-xl shadow-2xl p-6 relative border border-white/20">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            {message.icon}
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">
              {headline}
            </h3>
            <p className="text-white/90 text-sm mb-4">
              {subheadline}
            </p>

            {isReturningVisitor && (
              <div className="bg-white/10 rounded-lg px-3 py-2 mb-4">
                <p className="text-white/90 text-xs font-semibold">
                  Welcome back! Values have changed since your last visit
                </p>
              </div>
            )}

            <button
              onClick={handleClick}
              className="w-full bg-white text-fdp-accent-1 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2 group"
            >
              {intent.level === 'high' ? 'Get Started Free' : 'Sign Up Free'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="text-white/60 text-xs text-center mt-2">
              No credit card required
            </p>
          </div>
        </div>

        {intent.score > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between text-white/80 text-xs">
              <span>Intent Score: {intent.score}/100</span>
              <span className="px-2 py-1 bg-white/10 rounded-full capitalize">
                {intent.level} Intent
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InlineCTA({ context = 'general' }: { context?: string }) {
  const { user } = useAuth();
  const { intent, track } = useVisitorTracking();

  if (user) return null;

  const messages: Record<string, { title: string; description: string }> = {
    trade: {
      title: 'Save this trade',
      description: 'Create a free account to save trades and track value changes over time'
    },
    watchlist: {
      title: 'Add to watchlist',
      description: 'Sign up free to track players and get alerts on value changes'
    },
    general: {
      title: 'See full rankings',
      description: 'Create a free account to access all dynasty rankings and features'
    }
  };

  const message = messages[context] || messages.general;

  async function handleClick() {
    await track('click_inline_cta', { context });
    window.location.href = '/auth?action=signup';
  }

  return (
    <div className="bg-gradient-to-r from-fdp-accent-1/10 to-fdp-accent-2/10 border border-fdp-accent-1/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-1">
            {message.title}
          </h3>
          <p className="text-sm text-fdp-text-3 mb-4">
            {message.description}
          </p>
          <button
            onClick={handleClick}
            className="bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
