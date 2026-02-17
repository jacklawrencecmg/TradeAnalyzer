import { supabase } from './supabase';

export interface UserSubscription {
  tier: 'free' | 'pro';
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  is_pro: boolean;
  is_trial: boolean;
  trial_days_left: number;
  period_end: string | null;
  cancel_at_period_end: boolean;
}

export const FREE_FEATURES = [
  'player_search',
  'player_detail',
  'rankings',
  'dynasty_reports',
  'basic_trade_calc',
] as const;

export const PRO_FEATURES = [
  'trade_suggestions',
  'team_strategy',
  'market_alerts',
  'watchlist',
  'power_rankings_history',
  'advanced_idp_presets',
  'future_pick_projections',
  'player_trend_analytics',
  'unlimited_trades',
  'unlimited_leagues',
] as const;

export const USAGE_LIMITS = {
  free: {
    trade_calc: 3,
    league_import: 1,
    alerts: 5,
    tracked_players: 3,
    trade_saves: 5,
  },
  pro: {
    trade_calc: Infinity,
    league_import: Infinity,
    alerts: Infinity,
    tracked_players: Infinity,
    trade_saves: Infinity,
  },
} as const;

export interface QuotaCheck {
  allowed: boolean;
  has_premium: boolean;
  current_count: number;
  limit: number | null;
  remaining: number | null;
}

export interface MissedOpportunity {
  opportunity_id: string;
  opportunity_type: string;
  player_id: string;
  value_before: number;
  value_after: number;
  detected_at: string;
  free_user_could_have_saved: string;
}

export interface ValueProof {
  missed_opportunities_count: number;
  total_value_change: number;
  avg_hours_delayed: number;
  top_opportunities: MissedOpportunity[];
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_subscription', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        tier: 'free',
        status: 'active',
        is_pro: false,
        is_trial: false,
        trial_days_left: 0,
        period_end: null,
      };
    }

    return data[0];
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_feature_access', {
      p_user_id: userId,
      p_feature: feature,
    });

    if (error) {
      console.error('Error checking feature access:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

export async function trackUsage(userId: string, feature: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('track_usage', {
      p_user_id: userId,
      p_feature: feature,
    });

    if (error) {
      console.error('Error tracking usage:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Error:', err);
    return 0;
  }
}

export async function getUsageCount(userId: string, feature: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_usage_count', {
      p_user_id: userId,
      p_feature: feature,
    });

    if (error) {
      console.error('Error getting usage count:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Error:', err);
    return 0;
  }
}

export async function checkUsageLimit(
  userId: string,
  feature: string,
  limit: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_usage_limit', {
      p_user_id: userId,
      p_feature: feature,
      p_limit: limit,
    });

    if (error) {
      console.error('Error checking usage limit:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

export async function createCheckoutSession(
  successUrl?: string,
  cancelUrl?: string
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const result = await response.json();
    return result.url;
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return null;
  }
}

export async function cancelSubscription(): Promise<{ success: boolean; message: string; period_end?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to cancel subscription');
    }

    return result;
  } catch (err) {
    console.error('Error canceling subscription:', err);
    throw err;
  }
}

export async function reactivateSubscription(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reactivate-subscription`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to reactivate subscription');
    }

    return result;
  } catch (err) {
    console.error('Error reactivating subscription:', err);
    throw err;
  }
}

export function getFeatureDisplayName(feature: string): string {
  const names: Record<string, string> = {
    trade_suggestions: 'AI Trade Suggestions',
    team_strategy: 'Team Strategy Advice',
    market_alerts: 'Market Alerts',
    watchlist: 'Player Watchlist',
    power_rankings_history: 'Historical Power Rankings',
    advanced_idp_presets: 'Advanced IDP Scoring',
    future_pick_projections: 'Draft Pick Projections',
    player_trend_analytics: 'Player Trend Analytics',
    unlimited_trades: 'Unlimited Trade Calculations',
    unlimited_leagues: 'Unlimited League Imports',
  };

  return names[feature] || feature;
}

export function getFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    trade_suggestions: 'Get AI-powered trade suggestions based on your team needs and market trends',
    team_strategy: 'Receive personalized strategy advice for rebuilding, competing, or roster management',
    market_alerts: 'Get notified when player values spike or drop significantly',
    watchlist: 'Track unlimited players and get alerts on value changes',
    power_rankings_history: 'View historical power rankings and track your progress over time',
    advanced_idp_presets: 'Access advanced IDP scoring configurations for deeper defensive analysis',
    future_pick_projections: 'Project the value of future draft picks based on league context',
    player_trend_analytics: 'Deep dive into player value trends with advanced analytics',
    unlimited_trades: 'Analyze unlimited trades per day without restrictions',
    unlimited_leagues: 'Import and manage unlimited fantasy leagues',
  };

  return descriptions[feature] || 'Premium feature';
}

export async function checkQuota(
  userId: string,
  quotaType: string,
  freeLimit: number
): Promise<QuotaCheck> {
  try {
    const { data, error } = await supabase.rpc('check_usage_quota', {
      p_user_id: userId,
      p_quota_type: quotaType,
      p_free_limit: freeLimit,
    });

    if (error) {
      console.error('Error checking quota:', error);
      return {
        allowed: false,
        has_premium: false,
        current_count: 0,
        limit: freeLimit,
        remaining: freeLimit,
      };
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return {
      allowed: false,
      has_premium: false,
      current_count: 0,
      limit: freeLimit,
      remaining: freeLimit,
    };
  }
}

export async function incrementUsage(
  userId: string,
  actionType: string,
  quotaType?: string
): Promise<void> {
  try {
    await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_action_type: actionType,
      p_quota_type: quotaType,
    });
  } catch (err) {
    console.error('Error incrementing usage:', err);
  }
}

export async function grantTrial(
  userId: string,
  triggerAction: string,
  durationHours: number = 24
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('grant_trial', {
      p_user_id: userId,
      p_trigger_action: triggerAction,
      p_duration_hours: durationHours,
    });

    if (error) {
      console.error('Error granting trial:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function recordMissedOpportunity(
  userId: string,
  opportunityType: string,
  playerId: string,
  valueBefore: number,
  valueAfter: number,
  benefitDescription: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('record_missed_opportunity', {
      p_user_id: userId,
      p_opportunity_type: opportunityType,
      p_player_id: playerId,
      p_value_before: valueBefore,
      p_value_after: valueAfter,
      p_benefit_description: benefitDescription,
    });

    if (error) {
      console.error('Error recording missed opportunity:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function getValueProof(userId: string): Promise<ValueProof | null> {
  try {
    const { data, error } = await supabase.rpc('get_value_proof', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting value proof:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        missed_opportunities_count: 0,
        total_value_change: 0,
        avg_hours_delayed: 0,
        top_opportunities: [],
      };
    }

    return data[0];
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function recordUpgradeTrigger(
  userId: string,
  triggerType: string,
  context: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase
      .from('upgrade_triggers')
      .insert({
        user_id: userId,
        trigger_type: triggerType,
        context,
        shown_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error('Error recording upgrade trigger:', err);
  }
}
