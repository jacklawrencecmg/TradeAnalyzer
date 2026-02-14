import { Sparkles, Clock, AlertCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import ProBadge from './ProBadge';

interface SubscriptionBadgeProps {
  onUpgrade: () => void;
}

export default function SubscriptionBadge({ onUpgrade }: SubscriptionBadgeProps) {
  const { subscription, isPro, isTrial, trialDaysLeft, loading } = useSubscription();

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 h-10 rounded-lg w-32"></div>
    );
  }

  if (!subscription) {
    return (
      <button
        onClick={onUpgrade}
        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm"
      >
        Upgrade to Pro
      </button>
    );
  }

  if (isPro && !isTrial) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-100 to-orange-100 border border-orange-300 rounded-lg">
        <ProBadge size="md" />
        <span className="text-sm font-semibold text-gray-900">Pro Member</span>
      </div>
    );
  }

  if (isTrial) {
    return (
      <div className="flex items-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 border border-green-300 rounded-lg">
          <Clock className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-900">
            Trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left
          </span>
        </div>
        <button
          onClick={onUpgrade}
          className="px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  if (subscription.status === 'past_due') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-lg">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm font-semibold text-red-900">Payment Failed</span>
      </div>
    );
  }

  return (
    <button
      onClick={onUpgrade}
      className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
    >
      <Sparkles className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-semibold text-gray-900">Upgrade to Pro</span>
    </button>
  );
}
