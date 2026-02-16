import { X, Check, Sparkles, Zap, TrendingUp, Bell, Target, BarChart } from 'lucide-react';
import { createCheckoutSession } from '../lib/subscription';
import { useState } from 'react';
import ProBadge from './ProBadge';

interface UpgradeModalProps {
  onClose: () => void;
  feature?: string;
}

export default function UpgradeModal({ onClose, feature }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = () => {
    const stripeLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK;
    if (stripeLink) {
      window.location.href = stripeLink;
    } else {
      alert('Payment link not configured. Please contact support.');
    }
  };

  const proFeatures = [
    { icon: TrendingUp, name: 'AI Trade Suggestions', description: 'Get smart trade recommendations' },
    { icon: Target, name: 'Team Strategy Advice', description: 'Personalized rebuild/compete guidance' },
    { icon: Bell, name: 'Market Alerts', description: 'Notifications on player value spikes' },
    { icon: Sparkles, name: 'Unlimited Watchlist', description: 'Track unlimited players' },
    { icon: BarChart, name: 'Advanced Analytics', description: 'Deep trend analysis and projections' },
    { icon: Zap, name: 'Unlimited Usage', description: 'No daily limits on any features' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8" />
              <h2 className="text-3xl font-bold">Upgrade to Pro</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {feature && (
            <p className="text-orange-100">
              Unlock <span className="font-bold">{feature}</span> and all premium features
            </p>
          )}
        </div>

        <div className="p-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-bold text-gray-900">$2.99</span>
              <span className="text-xl text-gray-600">/month</span>
            </div>
            <p className="text-gray-600">Cancel anytime. No long-term commitment.</p>
            <div className="mt-4 inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
              7-Day Free Trial Included
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {proFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{feature.name}</div>
                  <div className="text-sm text-gray-600">{feature.description}</div>
                </div>
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">Free Tier Keeps:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Rankings and player values</li>
              <li>• Basic trade calculator (3/day)</li>
              <li>• Player search and profiles</li>
              <li>• Weekly market reports</li>
            </ul>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
          >
            Start 7-Day Free Trial
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            You won't be charged until your trial ends. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
