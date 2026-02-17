import { useState, useEffect } from 'react';
import { X, Zap, Clock, TrendingUp, Bell, Target, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { recordUpgradeTrigger, grantTrial } from '../lib/subscription';
import { trackCTAImpression, trackCTAClick, trackAction } from '../lib/attribution';

export type TriggerType =
  | 'trade_limit_reached'
  | 'watched_player_twice'
  | 'before_waivers'
  | 'missed_opportunity'
  | 'trade_monitoring'
  | 'multiple_trades';

interface TriggerConfig {
  icon: JSX.Element;
  headline: string;
  benefit: string;
  urgency?: string;
  cta: string;
  trialEligible: boolean;
}

const TRIGGER_CONFIGS: Record<TriggerType, TriggerConfig> = {
  trade_limit_reached: {
    icon: <Target className="w-6 h-6" />,
    headline: 'You\'ve hit your daily trade limit',
    benefit: 'Track this trade automatically and get notified of value changes',
    cta: 'Upgrade to Premium',
    trialEligible: false,
  },
  watched_player_twice: {
    icon: <Bell className="w-6 h-6" />,
    headline: 'Get notified when this player\'s value changes',
    benefit: 'Premium users got alerts 2 hours before you saw this change',
    cta: 'Start Free Trial',
    trialEligible: true,
  },
  before_waivers: {
    icon: <Clock className="w-6 h-6" />,
    headline: 'Waivers run tonight',
    benefit: 'Get instant alerts on waiver wire value spikes',
    urgency: 'Time-sensitive opportunity',
    cta: 'Unlock Instant Alerts',
    trialEligible: true,
  },
  missed_opportunity: {
    icon: <TrendingUp className="w-6 h-6" />,
    headline: 'You missed this opportunity',
    benefit: 'Premium users were warned 2 hours earlier and could sell high',
    urgency: 'Don\'t miss the next one',
    cta: 'Get Early Alerts',
    trialEligible: true,
  },
  trade_monitoring: {
    icon: <Zap className="w-6 h-6" />,
    headline: 'Track this trade automatically',
    benefit: 'Get alerts when players in this trade change value',
    cta: 'Enable Auto-Tracking',
    trialEligible: true,
  },
  multiple_trades: {
    icon: <Sparkles className="w-6 h-6" />,
    headline: 'You\'re on fire!',
    benefit: 'You\'ve run 3+ trades. Save and compare them all with Premium',
    cta: 'Start Free Trial',
    trialEligible: true,
  },
};

interface HighIntentUpgradeTriggerProps {
  trigger: TriggerType;
  context?: Record<string, any>;
  onClose?: () => void;
}

export function HighIntentUpgradeTrigger({ trigger, context, onClose }: HighIntentUpgradeTriggerProps) {
  const { user } = useAuth();
  const { isPro, isTrial } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [isGrantingTrial, setIsGrantingTrial] = useState(false);

  const config = TRIGGER_CONFIGS[trigger];

  useEffect(() => {
    if (user && !isPro && !isTrial) {
      recordUpgradeTrigger(user.id, trigger, context || {});
      trackCTAImpression(trigger, config.cta, trigger);
      trackAction('view_upgrade_trigger', { trigger, ...context }, user.id);
    }
  }, [user, trigger, context, isPro, isTrial, config]);

  if (!user || isPro || isTrial || dismissed) {
    return null;
  }

  async function handleUpgrade() {
    if (!user) return;

    trackCTAClick(trigger, config.cta, trigger);
    trackAction('click_upgrade_cta', { trigger, cta: config.cta, ...context }, user.id);

    if (config.trialEligible) {
      setIsGrantingTrial(true);
      const trialId = await grantTrial(user.id, trigger, 24);

      if (trialId) {
        trackAction('start_trial', { trigger, trial_id: trialId }, user.id);
        alert('🎉 24-hour premium trial activated! Enjoy all features.');
        window.location.reload();
      } else {
        window.location.href = '/premium';
      }
    } else {
      window.location.href = '/premium';
    }
  }

  function handleDismiss() {
    setDismissed(true);
    onClose?.();
  }

  return (
    <div className="fixed bottom-6 right-6 max-w-md z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-2xl p-6 relative border border-orange-300">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            {config.icon}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">
              {config.headline}
            </h3>

            {config.urgency && (
              <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-2 py-1 mb-2">
                <Clock className="w-3 h-3 text-white" />
                <span className="text-xs font-semibold text-white">
                  {config.urgency}
                </span>
              </div>
            )}

            <p className="text-white/90 text-sm mb-4">
              {config.benefit}
            </p>

            <button
              onClick={handleUpgrade}
              disabled={isGrantingTrial}
              className="w-full bg-white text-orange-600 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isGrantingTrial ? (
                'Starting Trial...'
              ) : (
                <>
                  {config.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {config.trialEligible && (
              <p className="text-white/60 text-xs text-center mt-2">
                ✨ Includes 24-hour free trial
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotaLimitBanner({ quotaType, current, limit }: {
  quotaType: string;
  current: number;
  limit: number;
}) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (!user || isPro || dismissed || current < limit) {
    return null;
  }

  const remaining = limit - current;
  const isAtLimit = remaining <= 0;

  const quotaLabels: Record<string, string> = {
    alerts: 'alerts',
    tracked_players: 'tracked players',
    trade_saves: 'saved trades',
    trade_calc: 'trade calculations',
  };

  const label = quotaLabels[quotaType] || quotaType;

  if (isAtLimit) {
    return (
      <HighIntentUpgradeTrigger
        trigger="trade_limit_reached"
        context={{ quota_type: quotaType, current, limit }}
        onClose={() => setDismissed(true)}
      />
    );
  }

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-fdp-text-1 text-sm">
              {remaining} {label} remaining today
            </span>
          </div>
          <p className="text-xs text-fdp-text-3">
            Upgrade to Premium for unlimited {label}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/premium'}
          className="text-xs font-semibold text-orange-500 hover:text-orange-600 whitespace-nowrap"
        >
          Upgrade →
        </button>
      </div>
      <div className="mt-3 h-2 bg-fdp-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
          style={{ width: `${(current / limit) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function useQuotaCheck(quotaType: string, limit: number) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [current, setCurrent] = useState(0);
  const [canUse, setCanUse] = useState(true);

  useEffect(() => {
    if (!user || isPro) {
      setCanUse(true);
      return;
    }

    checkUsage();
  }, [user, isPro, quotaType]);

  async function checkUsage() {
    if (!user) return;

    const { checkQuota } = await import('../lib/subscription');
    const result = await checkQuota(user.id, quotaType, limit);

    setCurrent(result.current_count);
    setCanUse(result.allowed);
  }

  async function increment() {
    if (!user || isPro) return;

    const { incrementUsage } = await import('../lib/subscription');
    await incrementUsage(user.id, quotaType, quotaType);
    await checkUsage();
  }

  return {
    current,
    limit,
    remaining: Math.max(0, limit - current),
    canUse,
    isAtLimit: current >= limit,
    increment,
  };
}
