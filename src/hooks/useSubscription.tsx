import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
  getUserSubscription,
  checkFeatureAccess,
  trackUsage,
  getUsageCount,
  checkUsageLimit,
  UserSubscription,
  USAGE_LIMITS
} from '../lib/subscription';

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const sub = await getUserSubscription(user.id);
      setSubscription(sub);
    } catch (err) {
      console.error('Error loading subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasFeatureAccess = async (feature: string): Promise<boolean> => {
    if (!user) return false;
    return await checkFeatureAccess(user.id, feature);
  };

  const trackFeatureUsage = async (feature: string): Promise<number> => {
    if (!user) return 0;
    return await trackUsage(user.id, feature);
  };

  const getFeatureUsage = async (feature: string): Promise<number> => {
    if (!user) return 0;
    return await getUsageCount(user.id, feature);
  };

  const canUseFeature = async (feature: string): Promise<boolean> => {
    if (!user) return false;

    if (subscription?.is_pro) {
      return true;
    }

    const limit = USAGE_LIMITS.free[feature as keyof typeof USAGE_LIMITS.free];
    if (limit === undefined) {
      return await hasFeatureAccess(feature);
    }

    return await checkUsageLimit(user.id, feature, limit);
  };

  const isPro = subscription?.is_pro || false;
  const isTrial = subscription?.is_trial || false;
  const trialDaysLeft = subscription?.trial_days_left || 0;

  return {
    subscription,
    loading,
    isPro,
    isTrial,
    trialDaysLeft,
    hasFeatureAccess,
    trackFeatureUsage,
    getFeatureUsage,
    canUseFeature,
    refresh: loadSubscription,
  };
}
