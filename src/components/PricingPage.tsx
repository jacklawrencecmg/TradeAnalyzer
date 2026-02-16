import { Check, X, Sparkles, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { createCheckoutSession } from '../lib/subscription';
import { useSubscription } from '../hooks/useSubscription';
import ProBadge from './ProBadge';
import { SubscriptionManagement } from './SubscriptionManagement';

interface PricingPageProps {
  onBack: () => void;
}

export default function PricingPage({ onBack }: PricingPageProps) {
  const [loading, setLoading] = useState(false);
  const { subscription, isPro } = useSubscription();

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const url = await createCheckoutSession(
        window.location.origin + '/dashboard?upgrade=success',
        window.location.origin + '/dashboard?upgrade=canceled'
      );

      if (url) {
        window.location.href = url;
      } else {
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = {
    free: [
      { name: 'Player search and profiles', included: true },
      { name: 'Dynasty rankings', included: true },
      { name: 'Weekly market reports', included: true },
      { name: 'Basic trade calculator', included: true, note: '10/day' },
      { name: 'League import', included: true, note: '1 league' },
      { name: 'Player value history', included: true },
      { name: 'Trade suggestions', included: false },
      { name: 'Team strategy advice', included: false },
      { name: 'Market alerts', included: false },
      { name: 'Player watchlist', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Unlimited usage', included: false },
    ],
    pro: [
      { name: 'Player search and profiles', included: true },
      { name: 'Dynasty rankings', included: true },
      { name: 'Weekly market reports', included: true },
      { name: 'Unlimited trade calculations', included: true },
      { name: 'Unlimited league imports', included: true },
      { name: 'Player value history', included: true },
      { name: 'AI trade suggestions', included: true },
      { name: 'Team strategy advice', included: true },
      { name: 'Market alerts & notifications', included: true },
      { name: 'Unlimited watchlist', included: true },
      { name: 'Advanced trend analytics', included: true },
      { name: 'Priority support', included: true },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img
              src="/FDP2.png"
              alt="Fantasy Draft Pros"
              className="h-20 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Start with our free tier or unlock premium features with Pro
          </p>
        </div>

        {isPro && !subscription?.is_trial && (
          <div className="mb-8 max-w-2xl mx-auto">
            <SubscriptionManagement />
          </div>
        )}

        {subscription?.is_trial && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-green-900">
                You're on a Pro Trial
              </h3>
            </div>
            <p className="text-green-800">
              {subscription.trial_days_left} days left in your free trial. Upgrade now to continue Pro access after your trial ends.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Free</h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-600">
                Perfect for casual dynasty managers
              </p>
            </div>

            <div className="p-6">
              <ul className="space-y-3">
                {features.free.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={feature.included ? 'text-gray-900' : 'text-gray-400'}>
                      {feature.name}
                      {feature.note && (
                        <span className="text-sm text-gray-500 ml-2">({feature.note})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="w-full mt-8 py-3 bg-gray-200 text-gray-600 rounded-lg font-semibold cursor-not-allowed"
              >
                Current Plan
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-2xl border-2 border-orange-500 overflow-hidden relative">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-bl-lg text-sm font-bold">
              POPULAR
            </div>

            <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-b border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">Pro</h2>
                <ProBadge size="md" />
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-gray-900">$7</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-700">
                For serious dynasty managers who want every edge
              </p>
              <div className="mt-4 inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                7-Day Free Trial
              </div>
            </div>

            <div className="p-6">
              <ul className="space-y-3">
                {features.pro.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-900 font-medium">
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={loading || isPro}
                className="w-full mt-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Loading...' : isPro ? 'Current Plan' : 'Start Free Trial'}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                Cancel anytime. No long-term commitment.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h3 className="text-xl font-bold text-blue-900 mb-4 text-center">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4 max-w-3xl mx-auto">
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Can I cancel anytime?</h4>
              <p className="text-blue-800">
                Yes! You can cancel your Pro subscription at any time. You'll keep access until the end of your billing period.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">What happens after the free trial?</h4>
              <p className="text-blue-800">
                After 7 days, you'll be charged $7/month. You can cancel before the trial ends to avoid being charged.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">What if I downgrade from Pro to Free?</h4>
              <p className="text-blue-800">
                You'll keep all your data, but some features will become locked. Your watchlist, league data, and trade history are preserved.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Do you offer refunds?</h4>
              <p className="text-blue-800">
                We offer a 30-day money-back guarantee if you're not satisfied with Pro. Just email support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
