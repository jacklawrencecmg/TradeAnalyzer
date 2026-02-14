import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUsageCount, USAGE_LIMITS } from '../lib/subscription';
import { useSubscription } from '../hooks/useSubscription';

interface UsageMeterProps {
  feature: 'trade_calc' | 'league_import';
  onUpgrade: () => void;
}

export default function UsageMeter({ feature, onUpgrade }: UsageMeterProps) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [usage, setUsage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !isPro) {
      loadUsage();
    } else {
      setLoading(false);
    }
  }, [user, isPro]);

  const loadUsage = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const count = await getUsageCount(user.id, feature);
      setUsage(count);
    } catch (err) {
      console.error('Error loading usage:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isPro || loading) {
    return null;
  }

  const limit = USAGE_LIMITS.free[feature];
  const remaining = Math.max(0, limit - usage);
  const percentage = (usage / limit) * 100;

  const isNearLimit = remaining <= 2;
  const isAtLimit = remaining === 0;

  const featureNames = {
    trade_calc: 'Trade Calculations',
    league_import: 'League Imports',
  };

  return (
    <div className={`p-4 rounded-lg border ${
      isAtLimit ? 'bg-red-50 border-red-200' :
      isNearLimit ? 'bg-orange-50 border-orange-200' :
      'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className={`text-sm font-semibold ${
            isAtLimit ? 'text-red-900' :
            isNearLimit ? 'text-orange-900' :
            'text-blue-900'
          }`}>
            {featureNames[feature]} Today
          </h3>
          <p className={`text-xs ${
            isAtLimit ? 'text-red-700' :
            isNearLimit ? 'text-orange-700' :
            'text-blue-700'
          }`}>
            {remaining} of {limit} remaining
          </p>
        </div>
        {isNearLimit && (
          <AlertCircle className={`w-5 h-5 ${
            isAtLimit ? 'text-red-600' : 'text-orange-600'
          }`} />
        )}
      </div>

      <div className="w-full bg-white rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-full transition-all ${
            isAtLimit ? 'bg-red-500' :
            isNearLimit ? 'bg-orange-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {isAtLimit && (
        <button
          onClick={onUpgrade}
          className="w-full px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
        >
          Upgrade for Unlimited
        </button>
      )}

      {isNearLimit && !isAtLimit && (
        <button
          onClick={onUpgrade}
          className="w-full px-3 py-2 bg-white border border-orange-300 text-orange-700 rounded-lg text-sm font-semibold hover:bg-orange-50 transition-all"
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
