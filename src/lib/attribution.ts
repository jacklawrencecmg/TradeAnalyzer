import { supabase } from './supabase';

export interface UpgradeEvent {
  event_id: string;
  user_id: string;
  trigger_event: string;
  trigger_context: Record<string, any>;
  days_since_signup: number;
  session_actions: number;
  last_important_actions: any[];
  cta_shown: string | null;
  cta_clicked: string | null;
  trial_converted: boolean;
  revenue_amount: number;
  created_at: string;
}

export interface CTAPerformance {
  cta_id: string;
  cta_type: string;
  cta_text: string;
  trigger_context: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_generated: number;
  conversion_rate?: number;
  click_through_rate?: number;
}

export interface RevenueInsights {
  total_upgrades: number;
  total_revenue: number;
  upgrades_by_trigger: Record<string, number>;
  conversion_rate_by_trigger: Record<string, { count: number; avg_days: number }>;
  avg_days_to_upgrade: number;
  avg_actions_to_upgrade: number;
  best_performing_cta: {
    cta_type: string;
    cta_text: string;
    conversion_rate: number;
    conversions: number;
    revenue: number;
  } | null;
  worst_performing_cta: {
    cta_type: string;
    cta_text: string;
    conversion_rate: number;
    conversions: number;
    impressions: number;
  } | null;
}

export async function trackUserAction(
  userId: string | null,
  sessionId: string | null,
  actionType: string,
  actionContext: Record<string, any> = {},
  pagePath?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('track_user_action', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_action_type: actionType,
      p_action_context: actionContext,
      p_page_path: pagePath,
    });

    if (error) {
      console.error('Error tracking user action:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function recordUpgradeEvent(
  userId: string,
  ctaShown?: string,
  ctaClicked?: string,
  trialConverted: boolean = false,
  revenueAmount: number = 0
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('record_upgrade_event', {
      p_user_id: userId,
      p_cta_shown: ctaShown,
      p_cta_clicked: ctaClicked,
      p_trial_converted: trialConverted,
      p_revenue_amount: revenueAmount,
    });

    if (error) {
      console.error('Error recording upgrade event:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function trackCTAImpression(
  ctaType: string,
  ctaText: string,
  triggerContext: string = 'general'
): Promise<void> {
  try {
    await supabase.rpc('track_cta_impression', {
      p_cta_type: ctaType,
      p_cta_text: ctaText,
      p_trigger_context: triggerContext,
    });
  } catch (err) {
    console.error('Error tracking CTA impression:', err);
  }
}

export async function trackCTAClick(
  ctaType: string,
  ctaText: string,
  triggerContext: string = 'general'
): Promise<void> {
  try {
    await supabase.rpc('track_cta_click', {
      p_cta_type: ctaType,
      p_cta_text: ctaText,
      p_trigger_context: triggerContext,
    });
  } catch (err) {
    console.error('Error tracking CTA click:', err);
  }
}

export async function getRevenueInsights(daysBack: number = 30): Promise<RevenueInsights | null> {
  try {
    const { data, error } = await supabase.rpc('get_revenue_insights', {
      p_days_back: daysBack,
    });

    if (error) {
      console.error('Error getting revenue insights:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        total_upgrades: 0,
        total_revenue: 0,
        upgrades_by_trigger: {},
        conversion_rate_by_trigger: {},
        avg_days_to_upgrade: 0,
        avg_actions_to_upgrade: 0,
        best_performing_cta: null,
        worst_performing_cta: null,
      };
    }

    return data[0];
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function getCTAPerformance(): Promise<CTAPerformance[]> {
  try {
    const { data, error } = await supabase
      .from('cta_performance')
      .select('*')
      .order('conversions', { ascending: false });

    if (error) {
      console.error('Error getting CTA performance:', error);
      return [];
    }

    return (data || []).map((cta) => ({
      ...cta,
      conversion_rate: cta.impressions > 0 ? (cta.conversions / cta.impressions) * 100 : 0,
      click_through_rate: cta.impressions > 0 ? (cta.clicks / cta.impressions) * 100 : 0,
    }));
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getUpgradeEvents(limit: number = 50): Promise<UpgradeEvent[]> {
  try {
    const { data, error } = await supabase
      .from('upgrade_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting upgrade events:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

let sessionId: string | null = null;

export function getSessionId(): string {
  if (!sessionId) {
    sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('session_id', sessionId);
    }
  }
  return sessionId;
}

export function trackAction(
  actionType: string,
  context?: Record<string, any>,
  userId?: string | null
): void {
  const session = getSessionId();
  trackUserAction(
    userId || null,
    session,
    actionType,
    context || {},
    window.location.pathname
  );
}

export function useActionTracking() {
  return {
    trackAction,
    trackCTAImpression,
    trackCTAClick,
  };
}
