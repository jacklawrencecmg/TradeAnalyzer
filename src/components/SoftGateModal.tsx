import { useState } from 'react';
import { X, Lock, Check, ArrowRight } from 'lucide-react';
import { useVisitorTracking } from '../hooks/useVisitorTracking';

interface SoftGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'trade_save' | 'watchlist' | 'weekly_report' | 'alerts' | 'comparison';
  preview?: React.ReactNode;
}

const FEATURE_CONFIG = {
  trade_save: {
    title: 'Save This Trade',
    description: 'Track this trade and see how values change over time',
    benefits: [
      'Save unlimited trades',
      'Get alerts on value changes',
      'Compare multiple trade scenarios',
      'Export trade history'
    ]
  },
  watchlist: {
    title: 'Add to Watchlist',
    description: 'Track players and get instant alerts on value changes',
    benefits: [
      'Track unlimited players',
      'Real-time value alerts',
      'Custom alert thresholds',
      'Weekly watchlist reports'
    ]
  },
  weekly_report: {
    title: 'Weekly Dynasty Report',
    description: 'Get personalized weekly insights for your team',
    benefits: [
      'AI-powered trade suggestions',
      'Value trend analysis',
      'League-specific advice',
      'Email delivery every Monday'
    ]
  },
  alerts: {
    title: 'Value Change Alerts',
    description: 'Never miss a buying or selling opportunity',
    benefits: [
      'Instant value change alerts',
      'Custom threshold settings',
      'Email and in-app notifications',
      'Historical alert archive'
    ]
  },
  comparison: {
    title: 'Player Comparison',
    description: 'Deep dive into player comparisons with advanced metrics',
    benefits: [
      'Side-by-side stat comparison',
      'Value trend charts',
      'Age curve analysis',
      'Trade recommendation engine'
    ]
  }
};

export function SoftGateModal({ isOpen, onClose, feature, preview }: SoftGateModalProps) {
  const { track, intent } = useVisitorTracking();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const config = FEATURE_CONFIG[feature];

  async function handleSignup() {
    setIsLoading(true);
    await track('save_attempt', { feature, intent_level: intent.level });

    window.location.href = `/auth?action=signup&redirect=${encodeURIComponent(window.location.pathname)}&feature=${feature}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-fdp-surface-1 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-fdp-border-1">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-fdp-text-3 hover:text-fdp-text-1 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col md:flex-row">
          {preview && (
            <div className="md:w-1/2 bg-fdp-bg-0 p-6 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-fdp-bg-0/95 pointer-events-none" />
              <div className="relative opacity-60 blur-sm pointer-events-none select-none">
                {preview}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-fdp-surface-1 rounded-full p-4 shadow-xl">
                  <Lock className="w-8 h-8 text-fdp-accent-1" />
                </div>
              </div>
            </div>
          )}

          <div className={`${preview ? 'md:w-1/2' : 'w-full'} p-8`}>
            <div className="mb-6">
              <div className="w-14 h-14 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-fdp-text-1 mb-2">
                {config.title}
              </h2>
              <p className="text-fdp-text-3">
                {config.description}
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {config.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-fdp-accent-1/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-fdp-accent-1" />
                  </div>
                  <span className="text-sm text-fdp-text-2">{benefit}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSignup}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white font-bold py-4 px-6 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <p className="text-xs text-fdp-text-3 text-center mt-3">
              No credit card required • Takes 30 seconds
            </p>

            {intent.level === 'high' && (
              <div className="mt-4 p-3 bg-fdp-accent-1/10 border border-fdp-accent-1/30 rounded-lg">
                <p className="text-xs text-fdp-accent-1 font-semibold">
                  🔥 High engagement detected — You'll love these features!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function useSoftGate(feature: SoftGateModalProps['feature']) {
  const [isOpen, setIsOpen] = useState(false);
  const { track } = useVisitorTracking();

  function open() {
    setIsOpen(true);
    track('soft_gate_shown', { feature });
  }

  function close() {
    setIsOpen(false);
  }

  return {
    isOpen,
    open,
    close
  };
}
