import { getRevenueInsights, getCTAPerformance } from './attribution';
import { trackAction } from './attribution';

export interface TriggerOptimization {
  trigger: string;
  shouldShowEarlier: boolean;
  shouldShowLater: boolean;
  recommendedTiming: 'immediate' | 'delayed' | 'default';
  confidence: number;
  conversionRate: number;
  avgDaysToConvert: number;
}

export interface CTAOptimization {
  ctaType: string;
  ctaText: string;
  shouldPromote: boolean;
  shouldDemote: boolean;
  alternativeCTA: string | null;
  conversionRate: number;
  clickThroughRate: number;
}

export async function getOptimizedTriggerTiming(
  userActionHistory: string[]
): Promise<TriggerOptimization[]> {
  const insights = await getRevenueInsights(30);

  if (!insights || !insights.conversion_rate_by_trigger) {
    return [];
  }

  const optimizations: TriggerOptimization[] = [];

  for (const [trigger, data] of Object.entries(insights.conversion_rate_by_trigger)) {
    const conversionRate = (data.count / insights.total_upgrades) * 100;
    const avgDays = data.avg_days;

    let shouldShowEarlier = false;
    let shouldShowLater = false;
    let recommendedTiming: 'immediate' | 'delayed' | 'default' = 'default';
    let confidence = 0;

    if (conversionRate > 20 && avgDays < 3) {
      shouldShowEarlier = true;
      recommendedTiming = 'immediate';
      confidence = 0.9;
    } else if (conversionRate > 15 && avgDays < 7) {
      shouldShowEarlier = true;
      recommendedTiming = 'immediate';
      confidence = 0.7;
    } else if (conversionRate < 5 && avgDays > 14) {
      shouldShowLater = true;
      recommendedTiming = 'delayed';
      confidence = 0.6;
    }

    const isRelevantToUser = userActionHistory.some((action) =>
      action.includes(trigger.split('_')[0])
    );

    if (isRelevantToUser && conversionRate > 10) {
      shouldShowEarlier = true;
      recommendedTiming = 'immediate';
      confidence = Math.min(confidence + 0.2, 1);
    }

    optimizations.push({
      trigger,
      shouldShowEarlier,
      shouldShowLater,
      recommendedTiming,
      confidence,
      conversionRate,
      avgDaysToConvert: avgDays,
    });
  }

  return optimizations.sort((a, b) => b.confidence - a.confidence);
}

export async function getOptimizedCTAs(): Promise<CTAOptimization[]> {
  const ctaPerformance = await getCTAPerformance();

  if (!ctaPerformance || ctaPerformance.length === 0) {
    return [];
  }

  const avgConversionRate =
    ctaPerformance.reduce((sum, cta) => sum + (cta.conversion_rate || 0), 0) /
    ctaPerformance.length;

  const avgCTR =
    ctaPerformance.reduce((sum, cta) => sum + (cta.click_through_rate || 0), 0) /
    ctaPerformance.length;

  const optimizations: CTAOptimization[] = ctaPerformance.map((cta) => {
    const shouldPromote =
      (cta.conversion_rate || 0) > avgConversionRate * 1.5 && cta.conversions > 5;
    const shouldDemote =
      (cta.conversion_rate || 0) < avgConversionRate * 0.5 && cta.impressions > 50;

    let alternativeCTA: string | null = null;
    if (shouldDemote) {
      const bestAlternative = ctaPerformance.find(
        (alt) =>
          alt.cta_type === cta.cta_type &&
          (alt.conversion_rate || 0) > (cta.conversion_rate || 0) * 1.5
      );
      alternativeCTA = bestAlternative?.cta_text || null;
    }

    return {
      ctaType: cta.cta_type,
      ctaText: cta.cta_text,
      shouldPromote,
      shouldDemote,
      alternativeCTA,
      conversionRate: cta.conversion_rate || 0,
      clickThroughRate: cta.click_through_rate || 0,
    };
  });

  return optimizations.sort((a, b) => b.conversionRate - a.conversionRate);
}

export async function shouldShowUpgradeTrigger(
  userId: string,
  triggerType: string,
  userActions: string[]
): Promise<{ shouldShow: boolean; timing: 'immediate' | 'delayed'; confidence: number }> {
  const optimizations = await getOptimizedTriggerTiming(userActions);

  const triggerOpt = optimizations.find((opt) => opt.trigger === triggerType);

  if (!triggerOpt) {
    return { shouldShow: true, timing: 'default' as 'immediate', confidence: 0.5 };
  }

  if (triggerOpt.shouldShowEarlier && triggerOpt.confidence > 0.7) {
    trackAction('auto_optimized_trigger_shown_early', {
      trigger: triggerType,
      confidence: triggerOpt.confidence,
    }, userId);

    return {
      shouldShow: true,
      timing: 'immediate',
      confidence: triggerOpt.confidence,
    };
  }

  if (triggerOpt.shouldShowLater && triggerOpt.confidence > 0.6) {
    trackAction('auto_optimized_trigger_delayed', {
      trigger: triggerType,
      confidence: triggerOpt.confidence,
    }, userId);

    return {
      shouldShow: false,
      timing: 'delayed',
      confidence: triggerOpt.confidence,
    };
  }

  return {
    shouldShow: true,
    timing: triggerOpt.recommendedTiming,
    confidence: triggerOpt.confidence,
  };
}

export async function getBestCTAForTrigger(triggerType: string): Promise<string | null> {
  const optimizedCTAs = await getOptimizedCTAs();

  const relevantCTAs = optimizedCTAs.filter(
    (cta) => cta.ctaType === triggerType || cta.shouldPromote
  );

  if (relevantCTAs.length === 0) {
    return null;
  }

  const bestCTA = relevantCTAs
    .filter((cta) => cta.conversionRate > 10)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  return bestCTA?.ctaText || null;
}

export async function getOptimizationRecommendations(): Promise<{
  triggerOptimizations: TriggerOptimization[];
  ctaOptimizations: CTAOptimization[];
  topRecommendations: string[];
}> {
  const [triggerOpts, ctaOpts] = await Promise.all([
    getOptimizedTriggerTiming([]),
    getOptimizedCTAs(),
  ]);

  const topRecommendations: string[] = [];

  const earlyTriggers = triggerOpts.filter(
    (opt) => opt.shouldShowEarlier && opt.confidence > 0.7
  );
  if (earlyTriggers.length > 0) {
    topRecommendations.push(
      `Show "${earlyTriggers[0].trigger}" trigger earlier - ${earlyTriggers[0].conversionRate.toFixed(1)}% conversion rate`
    );
  }

  const promoteCTAs = ctaOpts.filter((opt) => opt.shouldPromote);
  if (promoteCTAs.length > 0) {
    topRecommendations.push(
      `Promote CTA "${promoteCTAs[0].ctaText}" - ${promoteCTAs[0].conversionRate.toFixed(1)}% conversion rate`
    );
  }

  const demoteCTAs = ctaOpts.filter((opt) => opt.shouldDemote);
  if (demoteCTAs.length > 0) {
    topRecommendations.push(
      `Replace low-performing CTA "${demoteCTAs[0].ctaText}" (${demoteCTAs[0].conversionRate.toFixed(1)}% conversion)${
        demoteCTAs[0].alternativeCTA
          ? ` with "${demoteCTAs[0].alternativeCTA}"`
          : ''
      }`
    );
  }

  const lateTriggers = triggerOpts.filter(
    (opt) => opt.shouldShowLater && opt.confidence > 0.6
  );
  if (lateTriggers.length > 0) {
    topRecommendations.push(
      `Delay "${lateTriggers[0].trigger}" trigger - low conversion rate (${lateTriggers[0].conversionRate.toFixed(1)}%)`
    );
  }

  return {
    triggerOptimizations: triggerOpts,
    ctaOptimizations: ctaOpts,
    topRecommendations: topRecommendations.slice(0, 5),
  };
}
