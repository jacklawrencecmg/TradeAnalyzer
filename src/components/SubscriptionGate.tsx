import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { CreditCard, CheckCircle, Clock, LogIn, AlertCircle } from 'lucide-react';

interface SubscriptionGateProps {
  children: ReactNode;
}

interface SubscriptionStatus {
  tier: string;
  status: string;
  is_pro: boolean;
  is_trial: boolean;
  trial_days_left: number;
  period_end: string | null;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const stripePaymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK;

  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter your email and password');
      return;
    }
    setLoginLoading(true);
    const result = await signIn(loginEmail, loginPassword);
    if (result.error) {
      setLoginError(result.error);
    }
    setLoginLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    setSubscriptionStatus(null);
    setShowLoginForm(false);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');

    if (!user) {
      setLoading(false);
      return;
    }

    async function checkSubscription() {
      try {
        const { data, error } = await supabase
          .rpc('get_user_subscription', { p_user_id: user!.id });

        if (error) throw error;

        if (data && data.length > 0) {
          setSubscriptionStatus(data[0]);
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      } finally {
        setLoading(false);
      }
    }

    checkSubscription();
  }, [user]);

  if (loading) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="/FDP2.png"
                alt="Fantasy Draft Pros Logo"
                className="h-32 w-auto object-contain drop-shadow-lg"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <h1 className="text-4xl font-bold text-fdp-text-1 mb-2">Fantasy Draft Pros</h1>
            <p className="text-fdp-text-3">Professional Fantasy Football Tools</p>
          </div>

          <div className="bg-fdp-surface-1 rounded-lg shadow-xl p-8 border border-fdp-border-1">
            <h2 className="text-xl font-bold text-fdp-text-1 mb-1 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-fdp-accent-1" />
              Sign in to continue
            </h2>
            <p className="text-sm text-fdp-text-3 mb-6">Enter your account credentials below.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fdp-text-2 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                  placeholder="your.email@example.com"
                  disabled={loginLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fdp-text-2 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                  placeholder="Enter password"
                  disabled={loginLoading}
                />
              </div>
              {loginError && (
                <div className="bg-fdp-neg bg-opacity-10 border border-fdp-neg text-fdp-neg px-4 py-3 rounded-lg text-sm">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (subscriptionStatus?.is_pro) {
    return <>{children}</>;
  }

  const handleSubscribe = () => {
    if (stripePaymentLink) {
      window.location.href = stripePaymentLink;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/FDP2.png"
              alt="Fantasy Draft Pros Logo"
              className="h-32 w-auto object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl font-bold text-fdp-text-1 mb-2">Welcome to Fantasy Draft Pros</h1>
          <p className="text-fdp-text-3 text-lg">
            Subscribe to access professional fantasy football tools
          </p>
        </div>

        <div className="bg-fdp-surface-1 rounded-lg shadow-xl p-8 border border-fdp-border-1">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-fdp-bg-0" />
            </div>
            <h2 className="text-3xl font-bold text-fdp-text-1 mb-2">Pro Membership</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-5xl font-bold text-fdp-accent-1">$2.99</span>
              <span className="text-fdp-text-3">/month</span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Unlimited Trade Calculations</p>
                <p className="text-sm text-fdp-text-3">Analyze as many trades as you want</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Power Rankings & Playoff Odds</p>
                <p className="text-sm text-fdp-text-3">Track your team's performance and playoff chances</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Trade Suggestions Engine</p>
                <p className="text-sm text-fdp-text-3">Get AI-powered trade recommendations</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Market Alerts & Watchlist</p>
                <p className="text-sm text-fdp-text-3">Get notified when player values change</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Advanced IDP Support</p>
                <p className="text-sm text-fdp-text-3">Full support for IDP leagues</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-fdp-pos flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fdp-text-1">Unlimited League Imports</p>
                <p className="text-sm text-fdp-text-3">Manage all your leagues in one place</p>
              </div>
            </div>
          </div>

          {subscriptionStatus?.is_trial && subscriptionStatus.trial_days_left > 0 && (
            <div className="bg-fdp-accent-1 bg-opacity-10 border border-fdp-accent-1 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-fdp-accent-1">
                <Clock className="w-5 h-5" />
                <p className="font-semibold">
                  Trial Active: {subscriptionStatus.trial_days_left} day{subscriptionStatus.trial_days_left !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>
          )}

          {user && subscriptionStatus && !subscriptionStatus.is_pro && !subscriptionStatus.is_trial && (
            <div className="bg-fdp-neg bg-opacity-10 border border-fdp-neg rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-fdp-neg">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-semibold">Your free trial has expired.</p>
              </div>
            </div>
          )}

          <button
            onClick={handleSubscribe}
            className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-bold py-4 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all text-lg"
          >
            Subscribe Now - $2.99/month
          </button>

          <p className="text-center text-sm text-fdp-text-3 mt-4">
            Cancel anytime. No long-term commitments.
          </p>

          <div className="mt-6 border-t border-fdp-border-1 pt-6">
            {!showLoginForm ? (
              <button
                onClick={() => setShowLoginForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-2 rounded-lg hover:bg-fdp-border-1 transition-all font-medium"
              >
                <LogIn className="w-4 h-4" />
                Already have an account? Sign in
              </button>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-fdp-text-2 mb-3 flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign in to your account
                </h3>
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-fdp-text-3 mb-1">Email</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="your.email@example.com"
                      disabled={loginLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fdp-text-3 mb-1">Password</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Enter password"
                      disabled={loginLoading}
                    />
                  </div>
                  {loginError && (
                    <div className="bg-fdp-neg bg-opacity-10 border border-fdp-neg text-fdp-neg px-3 py-2 rounded-lg text-sm">
                      {loginError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="flex-1 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-2 px-4 rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loginLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowLoginForm(false); setLoginError(''); }}
                      className="px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-3 rounded-lg hover:bg-fdp-border-1 transition-all text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
