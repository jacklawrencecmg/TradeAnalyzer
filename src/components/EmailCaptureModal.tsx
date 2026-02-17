import { useState } from 'react';
import { X, Mail, ArrowRight, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useVisitorTracking } from '../hooks/useVisitorTracking';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'trade_save' | 'watchlist' | 'report';
  onSuccess?: (email: string) => void;
}

const REASON_CONFIG = {
  trade_save: {
    title: 'Email This Trade',
    description: 'We\'ll send this trade analysis to your email so you can review it later',
    buttonText: 'Send Trade Analysis',
    successMessage: 'Trade analysis sent! Check your email.'
  },
  watchlist: {
    title: 'Email Your Watchlist',
    description: 'Get weekly updates on your tracked players sent directly to your inbox',
    buttonText: 'Start Weekly Updates',
    successMessage: 'Watchlist activated! You\'ll receive weekly updates.'
  },
  report: {
    title: 'Get Weekly Dynasty Report',
    description: 'Receive personalized dynasty insights and trade opportunities every Monday',
    buttonText: 'Send Me Reports',
    successMessage: 'Report subscription confirmed! First report arrives Monday.'
  }
};

export function EmailCaptureModal({ isOpen, onClose, reason, onSuccess }: EmailCaptureModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { sessionId, track } = useVisitorTracking();

  if (!isOpen) return null;

  const config = REASON_CONFIG[reason];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await supabase
        .from('email_captures')
        .insert({
          session_id: sessionId,
          email,
          capture_reason: reason,
          captured_at: new Date().toISOString()
        });

      await track('email_captured', { reason, email_domain: email.split('@')[1] });

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(email);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Email capture error:', err);
      setError('Failed to save email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-fdp-surface-1 rounded-2xl shadow-2xl max-w-md w-full border border-fdp-border-1 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-fdp-text-3 hover:text-fdp-text-1 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-fdp-text-1 mb-2">
                Success!
              </h3>
              <p className="text-fdp-text-3">
                {config.successMessage}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-14 h-14 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-xl flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-white" />
                </div>

                <h2 className="text-2xl font-bold text-fdp-text-1 mb-2">
                  {config.title}
                </h2>
                <p className="text-fdp-text-3 text-sm">
                  {config.description}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-fdp-text-2 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 rounded-lg text-fdp-text-1 placeholder:text-fdp-text-3 focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
                    required
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-500 text-xs mt-2">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {isLoading ? (
                    'Sending...'
                  ) : (
                    <>
                      {config.buttonText}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      track('create_account_clicked', { from: 'email_capture' });
                      window.location.href = '/auth?action=signup';
                    }}
                    className="text-sm text-fdp-accent-1 hover:text-fdp-accent-2 font-semibold"
                  >
                    Or create a full account →
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-fdp-border-1">
                <p className="text-xs text-fdp-text-3 text-center">
                  We respect your privacy. Unsubscribe anytime.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function useEmailCapture(reason: EmailCaptureModalProps['reason']) {
  const [isOpen, setIsOpen] = useState(false);
  const { track } = useVisitorTracking();

  function open() {
    setIsOpen(true);
    track('email_capture_shown', { reason });
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
