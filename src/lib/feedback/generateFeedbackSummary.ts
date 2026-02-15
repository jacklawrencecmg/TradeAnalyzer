import { supabase } from '../supabase';

interface FeedbackSummary {
  period_start: string;
  period_end: string;
  total_feedback: number;
  open_issues: number;
  top_complaints: Array<{
    page: string;
    count: number;
    type: string;
  }>;
  accuracy_complaints: Array<{
    player_name: string;
    count: number;
  }>;
  most_confusing_pages: Array<{
    page: string;
    count: number;
  }>;
  feature_requests: Array<{
    message: string;
    count: number;
  }>;
  reaction_stats: {
    positive: number;
    negative: number;
  };
}

export async function generateFeedbackSummary(
  startDate: Date,
  endDate: Date
): Promise<FeedbackSummary | null> {
  try {
    const { data: feedback, error } = await supabase
      .from('user_feedback')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;
    if (!feedback || feedback.length === 0) return null;

    const pageComplaints = new Map<string, { count: number; type: string }>();
    feedback
      .filter(f => f.type !== 'reaction')
      .forEach(f => {
        const key = f.page;
        const existing = pageComplaints.get(key) || { count: 0, type: f.type };
        existing.count++;
        pageComplaints.set(key, existing);
      });

    const top_complaints = Array.from(pageComplaints.entries())
      .map(([page, data]) => ({ page, count: data.count, type: data.type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const playerComplaints = new Map<string, number>();
    feedback
      .filter(f => f.type === 'wrong_value' && f.metadata?.playerName)
      .forEach(f => {
        const player = f.metadata.playerName;
        playerComplaints.set(player, (playerComplaints.get(player) || 0) + 1);
      });

    const accuracy_complaints = Array.from(playerComplaints.entries())
      .map(([player_name, count]) => ({ player_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const confusingPages = new Map<string, number>();
    feedback
      .filter(f => f.type === 'confusing')
      .forEach(f => {
        const page = f.page;
        confusingPages.set(page, (confusingPages.get(page) || 0) + 1);
      });

    const most_confusing_pages = Array.from(confusingPages.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const featureRequestMap = new Map<string, number>();
    feedback
      .filter(f => f.type === 'feature')
      .forEach(f => {
        const message = f.message?.toLowerCase() || '';
        const similar = Array.from(featureRequestMap.keys()).find(
          key => key.includes(message.slice(0, 20)) || message.includes(key.slice(0, 20))
        );
        if (similar) {
          featureRequestMap.set(similar, (featureRequestMap.get(similar) || 0) + 1);
        } else {
          featureRequestMap.set(f.message || '', 1);
        }
      });

    const feature_requests = Array.from(featureRequestMap.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const reactions = feedback.filter(f => f.type === 'reaction');
    const reaction_stats = {
      positive: reactions.filter(r => r.metadata?.reaction === 'up').length,
      negative: reactions.filter(r => r.metadata?.reaction === 'down').length,
    };

    const summary: FeedbackSummary = {
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      total_feedback: feedback.length,
      open_issues: feedback.filter(f => f.status === 'open').length,
      top_complaints,
      accuracy_complaints,
      most_confusing_pages,
      feature_requests,
      reaction_stats,
    };

    return summary;
  } catch (error) {
    console.error('Error generating feedback summary:', error);
    return null;
  }
}

export async function generateWeeklyFeedbackSummary(): Promise<FeedbackSummary | null> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return generateFeedbackSummary(startDate, endDate);
}

export function formatFeedbackSummary(summary: FeedbackSummary): string {
  let report = `# Weekly Feedback Summary\n\n`;
  report += `Period: ${new Date(summary.period_start).toLocaleDateString()} - ${new Date(summary.period_end).toLocaleDateString()}\n\n`;

  report += `## Overview\n`;
  report += `- Total Feedback: ${summary.total_feedback}\n`;
  report += `- Open Issues: ${summary.open_issues}\n`;
  report += `- Positive Reactions: ${summary.reaction_stats.positive}\n`;
  report += `- Negative Reactions: ${summary.reaction_stats.negative}\n\n`;

  if (summary.top_complaints.length > 0) {
    report += `## Top Complaints\n`;
    summary.top_complaints.forEach((c, i) => {
      report += `${i + 1}. ${c.page} (${c.count} reports, type: ${c.type})\n`;
    });
    report += `\n`;
  }

  if (summary.accuracy_complaints.length > 0) {
    report += `## Most Reported Players (Value Issues)\n`;
    summary.accuracy_complaints.forEach((c, i) => {
      report += `${i + 1}. ${c.player_name} (${c.count} reports)\n`;
    });
    report += `\n`;
  }

  if (summary.most_confusing_pages.length > 0) {
    report += `## Most Confusing Pages\n`;
    summary.most_confusing_pages.forEach((c, i) => {
      report += `${i + 1}. ${c.page} (${c.count} reports)\n`;
    });
    report += `\n`;
  }

  if (summary.feature_requests.length > 0) {
    report += `## Top Feature Requests\n`;
    summary.feature_requests.forEach((c, i) => {
      report += `${i + 1}. ${c.message.slice(0, 100)}... (${c.count} requests)\n`;
    });
    report += `\n`;
  }

  return report;
}
