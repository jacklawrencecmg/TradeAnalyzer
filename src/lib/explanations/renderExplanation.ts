/**
 * Explanation Renderer
 *
 * Converts structured reasoning into human-readable explanations.
 * Never hallucinates - only describes actual factors from reasoning.
 *
 * Templates for each reason type with appropriate language.
 */

import type { ValueReasoning } from './buildValueReasoning';
import { categorizeReason } from './buildValueReasoning';

export interface ExplanationOptions {
  includeSecondary?: boolean;
  includeMagnitude?: boolean;
  includeDirection?: boolean;
  format?: 'short' | 'medium' | 'long';
}

/**
 * Render explanation text from structured reasoning
 *
 * @param reasoning - Structured value reasoning
 * @param options - Rendering options
 * @returns Human-readable explanation
 */
export function renderExplanation(
  reasoning: ValueReasoning,
  options: ExplanationOptions = {}
): string {
  const {
    includeSecondary = true,
    includeMagnitude = true,
    includeDirection = true,
    format = 'medium',
  } = options;

  const delta = reasoning.delta;
  const absDelta = Math.abs(delta);

  // Determine direction
  const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'adjusted';

  // Determine magnitude
  let magnitude = '';
  if (includeMagnitude) {
    if (absDelta >= 1500) {
      magnitude = 'significantly ';
    } else if (absDelta >= 800) {
      magnitude = 'substantially ';
    } else if (absDelta >= 500) {
      magnitude = 'notably ';
    } else if (absDelta >= 250) {
      magnitude = 'moderately ';
    } else if (absDelta >= 150) {
      magnitude = 'slightly ';
    } else {
      magnitude = 'minimally ';
    }
  }

  // Build primary reason text
  const primaryText = renderReasonText(
    reasoning.primaryReason,
    reasoning.primaryReasonDelta,
    reasoning.position,
    {
      direction,
      magnitude,
      includeDirection,
    }
  );

  if (format === 'short' || !includeSecondary) {
    return primaryText;
  }

  // Add secondary reasons
  if (reasoning.secondaryReasons.length > 0) {
    const secondaryTexts = reasoning.secondaryReasons
      .filter((r) => Math.abs(r.delta) >= 100) // Only include meaningful secondary factors
      .slice(0, 2) // Max 2 secondary reasons
      .map((r) => renderSecondaryReason(r.reason, r.delta));

    if (secondaryTexts.length > 0) {
      return `${primaryText}, with additional ${secondaryTexts.join(' and ')}`;
    }
  }

  return primaryText;
}

/**
 * Render primary reason text
 */
function renderReasonText(
  reason: string,
  delta: number,
  position: string,
  context: {
    direction: string;
    magnitude: string;
    includeDirection: boolean;
  }
): string {
  const { direction, magnitude, includeDirection } = context;
  const directionText = includeDirection ? `${magnitude}${direction}` : `${magnitude}changed`;

  switch (reason) {
    case 'production':
      if (delta > 0) {
        return `Value ${directionText} after strong production performance`;
      }
      return `Value ${directionText} due to declining production metrics`;

    case 'breakout':
      return `Value ${directionText} after elite usage and production jump`;

    case 'injury':
    case 'availability':
      return `Value ${directionText} due to injury designation affecting short-term availability`;

    case 'scarcity':
      if (delta > 0) {
        return `Value adjusted upward due to positional scarcity in this league format`;
      }
      return `Value adjusted downward due to positional depth in this league format`;

    case 'market_anchor':
      return `Value corrected toward market consensus rankings`;

    case 'role_change':
      if (delta > 0) {
        return `Value ${directionText} after promotion to starting role`;
      }
      return `Value ${directionText} due to reduced role opportunity`;

    case 'age_curve':
      if (delta > 0) {
        return `Value ${directionText} despite age-related decline projection`;
      }
      return `Value ${directionText} due to age-related decline projection`;

    case 'trade_impact':
      if (delta > 0) {
        return `Value ${directionText} after trade to improved situation`;
      }
      return `Value ${directionText} after trade to worse situation`;

    case 'opportunity':
      if (delta > 0) {
        return `Value ${directionText} due to increased opportunity share`;
      }
      return `Value ${directionText} due to decreased opportunity share`;

    case 'regression':
      return `Value ${directionText} projecting efficiency regression`;

    case 'efficiency':
      if (delta > 0) {
        return `Value ${directionText} due to improved efficiency metrics`;
      }
      return `Value ${directionText} due to declining efficiency metrics`;

    case 'draft_capital':
      return `Value ${directionText} based on high draft capital investment`;

    case 'landing_spot':
      if (delta > 0) {
        return `Value ${directionText} after landing in favorable offensive situation`;
      }
      return `Value ${directionText} due to landing in challenging offensive situation`;

    default:
      return `Value ${directionText} based on updated projections`;
  }
}

/**
 * Render secondary reason text (shorter format)
 */
function renderSecondaryReason(reason: string, delta: number): string {
  const category = categorizeReason(reason);

  switch (reason) {
    case 'production':
      return delta > 0 ? 'improved production' : 'declining production';

    case 'scarcity':
      return 'positional scarcity adjustment';

    case 'age_curve':
      return 'age curve adjustment';

    case 'availability':
    case 'injury':
      return 'availability concerns';

    case 'market_anchor':
      return 'market consensus alignment';

    case 'role_change':
      return delta > 0 ? 'expanded role' : 'reduced role';

    case 'opportunity':
      return delta > 0 ? 'increased opportunity' : 'decreased opportunity';

    case 'efficiency':
      return delta > 0 ? 'efficiency gains' : 'efficiency decline';

    case 'breakout':
      return 'breakout indicators';

    case 'regression':
      return 'regression indicators';

    default:
      return `${category} factors`;
  }
}

/**
 * Render detailed explanation with component breakdown
 *
 * Includes specific deltas for each factor.
 */
export function renderDetailedExplanation(reasoning: ValueReasoning): string {
  const primaryText = renderExplanation(reasoning, { includeSecondary: false });

  const componentLines: string[] = [];

  // Sort components by absolute delta
  const sortedComponents = Object.entries(reasoning.components).sort(
    ([, a], [, b]) => Math.abs(b) - Math.abs(a)
  );

  for (const [reason, delta] of sortedComponents) {
    if (Math.abs(delta) >= 100) {
      const category = categorizeReason(reason);
      const sign = delta > 0 ? '+' : '';
      componentLines.push(`${category}: ${sign}${delta}`);
    }
  }

  if (componentLines.length === 0) {
    return primaryText;
  }

  return `${primaryText}\n\nFactors:\n${componentLines.map((line) => `• ${line}`).join('\n')}`;
}

/**
 * Render explanation for rank change
 *
 * Focuses on rank movement rather than value.
 */
export function renderRankChangeExplanation(
  reasoning: ValueReasoning,
  oldRank: number,
  newRank: number
): string {
  const rankDelta = newRank - oldRank;

  if (rankDelta === 0) {
    return `Maintained rank #${newRank}`;
  }

  const direction = rankDelta < 0 ? 'up' : 'down';
  const magnitude = Math.abs(rankDelta);

  let magnitudeText = '';
  if (magnitude >= 50) {
    magnitudeText = 'Jumped';
  } else if (magnitude >= 20) {
    magnitudeText = 'Moved';
  } else if (magnitude >= 10) {
    magnitudeText = 'Shifted';
  } else {
    magnitudeText = 'Moved slightly';
  }

  const primaryReason = renderSecondaryReason(
    reasoning.primaryReason,
    reasoning.primaryReasonDelta
  );

  return `${magnitudeText} ${direction} ${magnitude} ranks to #${newRank} due to ${primaryReason}`;
}

/**
 * Render confidence-aware explanation
 *
 * Adds confidence qualifier if reasoning is uncertain.
 */
export function renderConfidentExplanation(
  reasoning: ValueReasoning,
  confidence: number
): string {
  const baseExplanation = renderExplanation(reasoning);

  if (confidence >= 0.8) {
    return baseExplanation;
  }

  if (confidence >= 0.6) {
    return `${baseExplanation} (moderate confidence)`;
  }

  return `${baseExplanation} (estimated based on available data)`;
}

/**
 * Render explanation for trade context
 *
 * Emphasizes why player is valuable/not valuable in trade.
 */
export function renderTradeExplanation(
  reasoning: ValueReasoning,
  tradeContext?: 'acquiring' | 'trading_away'
): string {
  const baseExplanation = renderExplanation(reasoning, { format: 'short' });

  if (!tradeContext) {
    return baseExplanation;
  }

  const trend = reasoning.delta > 0 ? 'rising' : reasoning.delta < 0 ? 'falling' : 'stable';

  if (tradeContext === 'acquiring') {
    if (trend === 'rising') {
      return `${baseExplanation} - buying into positive trend`;
    }
    if (trend === 'falling') {
      return `${baseExplanation} - potential buy-low opportunity`;
    }
    return baseExplanation;
  }

  // trading_away
  if (trend === 'rising') {
    return `${baseExplanation} - selling at peak value`;
  }
  if (trend === 'falling') {
    return `${baseExplanation} - may want to move before further decline`;
  }
  return baseExplanation;
}

/**
 * Render weekly summary explanation
 *
 * Shorter format for weekly report lists.
 */
export function renderWeeklySummary(reasoning: ValueReasoning): string {
  const delta = reasoning.delta;
  const absDelta = Math.abs(delta);
  const direction = delta > 0 ? '↑' : '↓';
  const primaryReason = categorizeReason(reasoning.primaryReason);

  return `${direction} ${absDelta} - ${primaryReason}`;
}

/**
 * Render position-specific explanation
 *
 * Adds position-relevant context to explanation.
 */
export function renderPositionContextExplanation(
  reasoning: ValueReasoning,
  position: string
): string {
  const baseExplanation = renderExplanation(reasoning);

  // Add position-specific context for certain reasons
  if (reasoning.primaryReason === 'scarcity') {
    const positionContext = getPositionScarcityContext(position, reasoning.delta > 0);
    if (positionContext) {
      return `${baseExplanation}. ${positionContext}`;
    }
  }

  if (reasoning.primaryReason === 'age_curve' && position === 'RB') {
    return `${baseExplanation}. RB position shows steep decline after age 27`;
  }

  if (reasoning.primaryReason === 'breakout' && position === 'WR') {
    return `${baseExplanation}. WRs typically break out in years 2-3`;
  }

  return baseExplanation;
}

/**
 * Get position-specific scarcity context
 */
function getPositionScarcityContext(position: string, positive: boolean): string | null {
  if (positive) {
    switch (position) {
      case 'QB':
        return 'Elite QB production is increasingly rare';
      case 'RB':
        return 'Workhorse RBs are scarce in modern NFL';
      case 'TE':
        return 'Very few fantasy-relevant TEs available';
      case 'WR':
        return 'Premium WRs command significant value';
      default:
        return null;
    }
  } else {
    switch (position) {
      case 'QB':
        return 'QB depth reduces individual value';
      case 'RB':
        return 'RBBC approach limits individual upside';
      case 'WR':
        return 'WR depth in this format reduces scarcity premium';
      case 'TE':
        return 'Tight streaming TEs available reduces individual value';
      default:
        return null;
    }
  }
}

/**
 * Render explanation with emoji indicators
 *
 * Adds visual indicators for different reason types.
 */
export function renderExplanationWithEmoji(reasoning: ValueReasoning): string {
  const baseExplanation = renderExplanation(reasoning);
  const emoji = getReasonEmoji(reasoning.primaryReason, reasoning.delta > 0);

  return `${emoji} ${baseExplanation}`;
}

/**
 * Get emoji for reason type
 */
function getReasonEmoji(reason: string, positive: boolean): string {
  switch (reason) {
    case 'production':
      return positive ? '📈' : '📉';
    case 'breakout':
      return '🚀';
    case 'injury':
    case 'availability':
      return '🏥';
    case 'scarcity':
      return '💎';
    case 'market_anchor':
      return '⚖️';
    case 'role_change':
      return positive ? '⬆️' : '⬇️';
    case 'age_curve':
      return '📅';
    case 'trade_impact':
      return '🔄';
    case 'opportunity':
      return positive ? '🎯' : '🚫';
    case 'regression':
      return '📊';
    default:
      return positive ? '✅' : '⚠️';
  }
}
