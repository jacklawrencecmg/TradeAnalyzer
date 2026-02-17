import { useState } from 'react';
import TradeAnalyzer from './TradeAnalyzer';
import { TodayInDynasty } from './TodayInDynasty';
import { LogIn, UserPlus, TrendingUp, Target, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signUp(email, password);
        if (result.error) {
          setError(`Signup failed: ${result.error}`);
        } else {
          setSuccess('Account created successfully! You now have a 7-day Pro trial. Welcome!');
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
        <div className="max-w-md w-full">
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
            <h1 className="text-4xl font-bold text-fdp-text-1 mb-2">Fantasy Draft Pros</h1>
            <p className="text-fdp-text-3">Professional Fantasy Football Tools - $2.99/month</p>
          </div>

          <div className="bg-fdp-surface-1 rounded-lg shadow-xl p-8 border border-fdp-border-1">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                    : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
                }`}
              >
                <LogIn className="inline-block w-4 h-4 mr-2" />
                Login
              </button>
              <button
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                    : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
                }`}
              >
                <UserPlus className="inline-block w-4 h-4 mr-2" />
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-fdp-text-2 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                  placeholder="your.email@example.com"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-fdp-text-2 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                  placeholder="Enter password"
                  disabled={loading}
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-fdp-text-2 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                    placeholder="Confirm password"
                    disabled={loading}
                  />
                </div>
              )}

              {error && (
                <div className="bg-fdp-neg bg-opacity-10 border border-fdp-neg text-fdp-neg px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-fdp-pos bg-opacity-10 border border-fdp-pos text-fdp-pos px-4 py-3 rounded-lg">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Please wait...' : mode === 'signup' ? 'Start 7-Day Free Trial' : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => setShowAuth(false)}
              className="w-full mt-4 text-fdp-text-3 hover:text-fdp-text-1 transition-colors text-sm"
            >
              ← Back to free trade analyzer
            </button>

            <div className="mt-6 p-4 bg-fdp-surface-2 border border-fdp-border-1 rounded-lg">
              <p className="text-sm font-semibold text-fdp-text-1 mb-2">Pro Membership - $2.99/month:</p>
              <ul className="text-sm text-fdp-text-3 space-y-1">
                <li>Unlimited trade calculations</li>
                <li>Unlimited league imports</li>
                <li>Power rankings and playoff odds</li>
                <li>Trade suggestions engine</li>
                <li>Team strategy advice</li>
                <li>Market alerts and watchlist</li>
                <li>Advanced IDP presets</li>
                <li>Player trend analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/FDP2.png"
              alt="Fantasy Draft Pros Logo"
              className="h-24 w-auto object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-5xl font-bold text-fdp-text-1 mb-3">Fantasy Draft Pros</h1>
          <p className="text-xl text-fdp-text-2 mb-2">
            Dynasty Trade Analyzer & Player Values
          </p>
          <p className="text-lg text-fdp-accent-1 font-semibold mb-6">
            World's First Offensive Player + IDP + FAAB + Pick - Trade Analyzer
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setMode('signup');
                setShowAuth(true);
              }}
              className="bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-bold py-3 px-8 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
            >
              <UserPlus className="inline-block w-5 h-5 mr-2" />
              Start 7-Day Free Trial
            </button>
            <button
              onClick={() => {
                setMode('login');
                setShowAuth(true);
              }}
              className="bg-fdp-surface-1 text-fdp-text-1 font-semibold py-3 px-8 rounded-lg border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
            >
              <LogIn className="inline-block w-5 h-5 mr-2" />
              Sign In
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mb-12">
          <div className="bg-fdp-surface-1 rounded-xl shadow-2xl p-6 border border-fdp-border-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-fdp-text-1">Free Trade Analyzer</h2>
              <div className="text-sm text-fdp-text-3">Try it now - no signup required</div>
            </div>
            <TradeAnalyzer isGuest={true} />
          </div>
        </div>

        <TodayInDynasty />

        <div className="max-w-5xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-fdp-text-1 text-center mb-8">
            Player Rankings & Values
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <a
              href="/dynasty-rankings"
              className="bg-fdp-surface-1 rounded-lg p-6 border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
            >
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2 group-hover:text-fdp-accent-1 transition-colors">
                Dynasty Rankings
              </h3>
              <p className="text-fdp-text-3">
                Top 1000 dynasty player values updated daily with rankings, tiers, and trade analysis.
              </p>
            </a>

            <a
              href="/top1000"
              className="bg-fdp-surface-1 rounded-lg p-6 border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
            >
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2 group-hover:text-fdp-accent-1 transition-colors">
                Top 1000 Values
              </h3>
              <p className="text-fdp-text-3">
                Complete player value database with filtering by position and league settings.
              </p>
            </a>

            <a
              href="/trade-calculator"
              className="bg-fdp-surface-1 rounded-lg p-6 border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
            >
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2 group-hover:text-fdp-accent-1 transition-colors">
                Trade Calculator
              </h3>
              <p className="text-fdp-text-3">
                Analyze dynasty trades with picks, IDP, and FAAB. Get instant fairness ratings.
              </p>
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-fdp-text-1 text-center mb-8">
            Unlock Pro Features
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-fdp-surface-1 rounded-lg p-6 border border-fdp-border-1">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2">AI Trade Suggestions</h3>
              <p className="text-fdp-text-3">
                Get smart trade recommendations based on your team needs and league dynamics.
              </p>
            </div>

            <div className="bg-fdp-surface-1 rounded-lg p-6 border border-fdp-border-1">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2">Team Strategy Advice</h3>
              <p className="text-fdp-text-3">
                Personalized rebuild or compete guidance to maximize your championship odds.
              </p>
            </div>

            <div className="bg-fdp-surface-1 rounded-lg p-6 border border-fdp-border-1">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-fdp-text-1 mb-2">Market Alerts</h3>
              <p className="text-fdp-text-3">
                Get notified when player values spike so you can buy low or sell high.
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold mb-4">
              Only $2.99/month - 7-Day Free Trial
            </div>
            <p className="text-fdp-text-3">
              Cancel anytime. No long-term commitment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
