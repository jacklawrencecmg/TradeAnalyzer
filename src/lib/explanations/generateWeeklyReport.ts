/**
 * Weekly Market Report Generator
 *
 * Generates comprehensive weekly recaps of fantasy market movements.
 * Creates engaging content for homepage and blog.
 *
 * Output:
 * - Biggest value gains/drops
 * - Most volatile players
 * - Position trends
 * - Market insights
 * - Key takeaways
 */

import { supabase } from '../supabase';
import { categorizeReason } from './buildValueReasoning';

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  format: 'dynasty' | 'redraft';
  season: number;
  weekNumber?: number;

  biggestGainers: Array<{
    playerId: string;
    playerName: string;
    position: string;
    delta: number;
    percentChange: number;
    explanation: string;
    reason: string;
  }>;

  biggestLosers: Array<{
    playerId: string;
    playerName: string;
    position: string;
    delta: number;
    percentChange: number;
    explanation: string;
    reason: string;
  }>;

  mostVolatile: Array<{
    playerId: string;
    playerName: string;
    position: string;
    changeCount: number;
    totalSwing: number;
    trend: 'up' | 'down' | 'volatile';
  }>;

  positionTrends: {
    QB: PositionTrend;
    RB: PositionTrend;
    WR: PositionTrend;
    TE: PositionTrend;
  };

  keyInsights: string[];
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface PositionTrend {
  avgChange: number;
  direction: 'up' | 'down' | 'stable';
  volatility: number;
  topMover: string;
  topMoverDelta: number;
  insight: string;
}

/**
 * Generate weekly market report
 *
 * @param weekStart - Start date of week
 * @param weekEnd - End date of week
 * @param format - Dynasty or redraft
 * @returns Report data
 */
export async function generateWeeklyReport(
  weekStart: Date,
  weekEnd: Date,
  format: 'dynasty' | 'redraft'
): Promise<WeeklyReportData> {
  // Query explanations for this week
  const { data: explanations, error } = await supabase
    .from('player_value_explanations')
    .select(
      `
      player_id,
      delta,
      old_value,
      new_value,
      primary_reason,
      explanation_text,
      generated_at,
      nfl_players!inner (
        full_name,
        player_position
      )
    `
    )
    .eq('format', format)
    .gte('generated_at', weekStart.toISOString())
    .lte('generated_at', weekEnd.toISOString());

  if (error || !explanations || explanations.length === 0) {
    return createEmptyReport(weekStart, weekEnd, format);
  }

  // Process biggest gainers
  const gainers = explanations
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10)
    .map((e) => ({
      playerId: e.player_id,
      playerName: (e.nfl_players as any).full_name,
      position: (e.nfl_players as any).player_position,
      delta: e.delta,
      percentChange: (e.delta / e.old_value) * 100,
      explanation: e.explanation_text,
      reason: categorizeReason(e.primary_reason),
    }));

  // Process biggest losers
  const losers = explanations
    .filter((e) => e.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 10)
    .map((e) => ({
      playerId: e.player_id,
      playerName: (e.nfl_players as any).full_name,
      position: (e.nfl_players as any).player_position,
      delta: e.delta,
      percentChange: (e.delta / e.old_value) * 100,
      explanation: e.explanation_text,
      reason: categorizeReason(e.primary_reason),
    }));

  // Find most volatile (multiple changes)
  const playerChangeMap = new Map<string, any[]>();
  for (const exp of explanations) {
    if (!playerChangeMap.has(exp.player_id)) {
      playerChangeMap.set(exp.player_id, []);
    }
    playerChangeMap.get(exp.player_id)!.push(exp);
  }

  const volatile = Array.from(playerChangeMap.entries())
    .filter(([_, changes]) => changes.length >= 2)
    .map(([playerId, changes]) => {
      const totalSwing = changes.reduce((sum, c) => sum + Math.abs(c.delta), 0);
      const netChange = changes.reduce((sum, c) => sum + c.delta, 0);

      return {
        playerId,
        playerName: (changes[0].nfl_players as any).full_name,
        position: (changes[0].nfl_players as any).player_position,
        changeCount: changes.length,
        totalSwing,
        trend: netChange > 500 ? 'up' as const : netChange < -500 ? 'down' as const : 'volatile' as const,
      };
    })
    .sort((a, b) => b.totalSwing - a.totalSwing)
    .slice(0, 10);

  // Calculate position trends
  const positionTrends = calculatePositionTrends(explanations);

  // Generate key insights
  const keyInsights = generateKeyInsights(explanations, gainers, losers, positionTrends);

  // Determine market sentiment
  const marketSentiment = determineMarketSentiment(explanations);

  const season = weekStart.getFullYear();
  const weekNumber = getWeekNumber(weekStart);

  return {
    weekStart,
    weekEnd,
    format,
    season,
    weekNumber,
    biggestGainers: gainers,
    biggestLosers: losers,
    mostVolatile: volatile,
    positionTrends,
    keyInsights,
    marketSentiment,
  };
}

/**
 * Calculate position trends
 */
function calculatePositionTrends(explanations: any[]): WeeklyReportData['positionTrends'] {
  const positions = ['QB', 'RB', 'WR', 'TE'] as const;
  const trends: any = {};

  for (const pos of positions) {
    const posExplanations = explanations.filter(
      (e) => (e.nfl_players as any).player_position === pos
    );

    if (posExplanations.length === 0) {
      trends[pos] = {
        avgChange: 0,
        direction: 'stable' as const,
        volatility: 0,
        topMover: 'N/A',
        topMoverDelta: 0,
        insight: `No significant ${pos} movement this week`,
      };
      continue;
    }

    const avgChange =
      posExplanations.reduce((sum, e) => sum + e.delta, 0) / posExplanations.length;

    const volatility =
      posExplanations.reduce((sum, e) => sum + Math.abs(e.delta), 0) / posExplanations.length;

    const direction =
      avgChange > 50 ? ('up' as const) : avgChange < -50 ? ('down' as const) : ('stable' as const);

    const topMover = posExplanations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

    const insight = generatePositionInsight(pos, avgChange, direction, topMover);

    trends[pos] = {
      avgChange: Math.round(avgChange),
      direction,
      volatility: Math.round(volatility),
      topMover: (topMover.nfl_players as any).full_name,
      topMoverDelta: topMover.delta,
      insight,
    };
  }

  return trends;
}

/**
 * Generate position-specific insight
 */
function generatePositionInsight(
  position: string,
  avgChange: number,
  direction: 'up' | 'down' | 'stable',
  topMover: any
): string {
  const reason = categorizeReason(topMover.primary_reason);

  if (direction === 'up') {
    return `${position} values trending upward, led by ${(topMover.nfl_players as any).full_name} due to ${reason.toLowerCase()}`;
  }

  if (direction === 'down') {
    return `${position} values declining, with ${(topMover.nfl_players as any).full_name} dropping most due to ${reason.toLowerCase()}`;
  }

  return `${position} values relatively stable, with ${(topMover.nfl_players as any).full_name} showing most movement`;
}

/**
 * Generate key insights
 */
function generateKeyInsights(
  explanations: any[],
  gainers: any[],
  losers: any[],
  positionTrends: any
): string[] {
  const insights: string[] = [];

  // Total changes
  insights.push(`${explanations.length} significant value changes tracked this week`);

  // Top gainer
  if (gainers.length > 0) {
    const top = gainers[0];
    insights.push(
      `${top.playerName} led all gainers with +${top.delta} value (${top.percentChange.toFixed(1)}%) due to ${top.reason.toLowerCase()}`
    );
  }

  // Top loser
  if (losers.length > 0) {
    const top = losers[0];
    insights.push(
      `${top.playerName} had largest decline with ${top.delta} value (${top.percentChange.toFixed(1)}%) due to ${top.reason.toLowerCase()}`
    );
  }

  // Position trends
  const trendingUp = Object.entries(positionTrends)
    .filter(([_, trend]: any) => trend.direction === 'up')
    .map(([pos]) => pos);

  const trendingDown = Object.entries(positionTrends)
    .filter(([_, trend]: any) => trend.direction === 'down')
    .map(([pos]) => pos);

  if (trendingUp.length > 0) {
    insights.push(`${trendingUp.join(', ')} position${trendingUp.length > 1 ? 's' : ''} trending upward`);
  }

  if (trendingDown.length > 0) {
    insights.push(`${trendingDown.join(', ')} position${trendingDown.length > 1 ? 's' : ''} experiencing declines`);
  }

  // Reason analysis
  const reasonCounts: Record<string, number> = {};
  for (const exp of explanations) {
    const reason = categorizeReason(exp.primary_reason);
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  if (topReason) {
    insights.push(
      `${topReason[0]} was the most common factor (${topReason[1]} players affected)`
    );
  }

  return insights;
}

/**
 * Determine market sentiment
 */
function determineMarketSentiment(explanations: any[]): 'bullish' | 'bearish' | 'neutral' {
  const totalPositive = explanations.filter((e) => e.delta > 0).length;
  const totalNegative = explanations.filter((e) => e.delta < 0).length;

  const ratio = totalPositive / (totalPositive + totalNegative);

  if (ratio >= 0.6) return 'bullish';
  if (ratio <= 0.4) return 'bearish';
  return 'neutral';
}

/**
 * Store weekly report in database
 */
export async function storeWeeklyReport(reportData: WeeklyReportData): Promise<boolean> {
  const reportTitle = generateReportTitle(reportData);
  const reportSummary = generateReportSummary(reportData);
  const reportContent = generateReportContent(reportData);

  const { error } = await supabase.from('weekly_market_reports').upsert(
    {
      week_start: reportData.weekStart.toISOString().split('T')[0],
      week_end: reportData.weekEnd.toISOString().split('T')[0],
      format: reportData.format,
      season: reportData.season,
      week_number: reportData.weekNumber,
      biggest_gainers: JSON.stringify(reportData.biggestGainers),
      biggest_losers: JSON.stringify(reportData.biggestLosers),
      most_volatile: JSON.stringify(reportData.mostVolatile),
      position_trends: JSON.stringify(reportData.positionTrends),
      key_insights: JSON.stringify(reportData.keyInsights),
      market_sentiment: reportData.marketSentiment,
      total_value_changes: reportData.biggestGainers.length + reportData.biggestLosers.length,
      avg_volatility: calculateAverageVolatility(reportData),
      most_active_position: getMostActivePosition(reportData),
      report_title: reportTitle,
      report_summary: reportSummary,
      report_content: reportContent,
      published: true,
      published_at: new Date().toISOString(),
    },
    { onConflict: 'week_start,format,report_type' }
  );

  return !error;
}

/**
 * Generate report title
 */
function generateReportTitle(reportData: WeeklyReportData): string {
  const weekStr = reportData.weekNumber
    ? `Week ${reportData.weekNumber}`
    : reportData.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const format = reportData.format === 'dynasty' ? 'Dynasty' : 'Redraft';

  return `${format} Market Report: ${weekStr} ${reportData.season}`;
}

/**
 * Generate report summary
 */
function generateReportSummary(reportData: WeeklyReportData): string {
  const topGainer = reportData.biggestGainers[0];
  const topLoser = reportData.biggestLosers[0];

  let summary = `Weekly ${reportData.format} market movements. `;

  if (topGainer) {
    summary += `${topGainer.playerName} led gainers (+${topGainer.delta}). `;
  }

  if (topLoser) {
    summary += `${topLoser.playerName} biggest decline (${topLoser.delta}). `;
  }

  summary += `Market sentiment: ${reportData.marketSentiment}.`;

  return summary;
}

/**
 * Generate full report content
 */
function generateReportContent(reportData: WeeklyReportData): string {
  let content = '';

  content += '## Top Movers\n\n';
  content += '### Biggest Gainers\n';
  for (const gainer of reportData.biggestGainers.slice(0, 5)) {
    content += `- **${gainer.playerName}** (${gainer.position}): +${gainer.delta} - ${gainer.explanation}\n`;
  }

  content += '\n### Biggest Losers\n';
  for (const loser of reportData.biggestLosers.slice(0, 5)) {
    content += `- **${loser.playerName}** (${loser.position}): ${loser.delta} - ${loser.explanation}\n`;
  }

  content += '\n## Position Trends\n\n';
  for (const [pos, trend] of Object.entries(reportData.positionTrends)) {
    content += `**${pos}**: ${trend.insight}\n\n`;
  }

  content += '\n## Key Insights\n\n';
  for (const insight of reportData.keyInsights) {
    content += `- ${insight}\n`;
  }

  return content;
}

/**
 * Create empty report
 */
function createEmptyReport(
  weekStart: Date,
  weekEnd: Date,
  format: 'dynasty' | 'redraft'
): WeeklyReportData {
  return {
    weekStart,
    weekEnd,
    format,
    season: weekStart.getFullYear(),
    biggestGainers: [],
    biggestLosers: [],
    mostVolatile: [],
    positionTrends: {
      QB: {
        avgChange: 0,
        direction: 'stable',
        volatility: 0,
        topMover: 'N/A',
        topMoverDelta: 0,
        insight: 'No QB movement',
      },
      RB: {
        avgChange: 0,
        direction: 'stable',
        volatility: 0,
        topMover: 'N/A',
        topMoverDelta: 0,
        insight: 'No RB movement',
      },
      WR: {
        avgChange: 0,
        direction: 'stable',
        volatility: 0,
        topMover: 'N/A',
        topMoverDelta: 0,
        insight: 'No WR movement',
      },
      TE: {
        avgChange: 0,
        direction: 'stable',
        volatility: 0,
        topMover: 'N/A',
        topMoverDelta: 0,
        insight: 'No TE movement',
      },
    },
    keyInsights: ['No significant value changes this week'],
    marketSentiment: 'neutral',
  };
}

function calculateAverageVolatility(reportData: WeeklyReportData): number {
  const allChanges = [...reportData.biggestGainers, ...reportData.biggestLosers];
  if (allChanges.length === 0) return 0;

  const totalVolatility = allChanges.reduce((sum, p) => sum + Math.abs(p.delta), 0);
  return Math.round(totalVolatility / allChanges.length);
}

function getMostActivePosition(reportData: WeeklyReportData): string {
  const positions = Object.entries(reportData.positionTrends).sort(
    (a, b) => b[1].volatility - a[1].volatility
  );

  return positions[0]?.[0] || 'N/A';
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}
