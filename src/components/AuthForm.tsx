import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, UserPlus } from 'lucide-react';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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
        console.log('Starting signup process...');
        const result = await signUp(email, password);
        console.log('Signup result:', result);

        if (result.error) {
          console.error('Signup error:', result.error);
          setError(`Signup failed: ${result.error}`);
        } else {
          console.log('Signup successful!');
          setSuccess('Account created successfully! You now have a 7-day Pro trial. Welcome!');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          // Don't auto-switch to login since user is now logged in
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
                console.error('Logo failed to load');
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
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

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
