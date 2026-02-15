import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: feedback, error } = await supabase
      .from('user_feedback')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;
    if (!feedback || feedback.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No feedback in this period' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const pageComplaints = new Map<string, { count: number; type: string }>();
    feedback
      .filter((f: any) => f.type !== 'reaction')
      .forEach((f: any) => {
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
      .filter((f: any) => f.type === 'wrong_value' && f.metadata?.playerName)
      .forEach((f: any) => {
        const player = f.metadata.playerName;
        playerComplaints.set(player, (playerComplaints.get(player) || 0) + 1);
      });

    const accuracy_complaints = Array.from(playerComplaints.entries())
      .map(([player_name, count]) => ({ player_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const confusingPages = new Map<string, number>();
    feedback
      .filter((f: any) => f.type === 'confusing')
      .forEach((f: any) => {
        const page = f.page;
        confusingPages.set(page, (confusingPages.get(page) || 0) + 1);
      });

    const most_confusing_pages = Array.from(confusingPages.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const featureRequestMap = new Map<string, number>();
    feedback
      .filter((f: any) => f.type === 'feature')
      .forEach((f: any) => {
        const message = f.message?.toLowerCase() || '';
        featureRequestMap.set(f.message || '', (featureRequestMap.get(f.message || '') || 0) + 1);
      });

    const feature_requests = Array.from(featureRequestMap.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const reactions = feedback.filter((f: any) => f.type === 'reaction');
    const reaction_stats = {
      positive: reactions.filter((r: any) => r.metadata?.reaction === 'up').length,
      negative: reactions.filter((r: any) => r.metadata?.reaction === 'down').length,
    };

    const summary = {
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      total_feedback: feedback.length,
      open_issues: feedback.filter((f: any) => f.status === 'open').length,
      top_complaints,
      accuracy_complaints,
      most_confusing_pages,
      feature_requests,
      reaction_stats,
    };

    let report = `# Feedback Summary (${days} days)\n\n`;
    report += `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n\n`;
    report += `## Overview\n`;
    report += `- Total Feedback: ${summary.total_feedback}\n`;
    report += `- Open Issues: ${summary.open_issues}\n`;
    report += `- Positive Reactions: ${reaction_stats.positive}\n`;
    report += `- Negative Reactions: ${reaction_stats.negative}\n\n`;

    if (top_complaints.length > 0) {
      report += `## Top Complaints\n`;
      top_complaints.forEach((c, i) => {
        report += `${i + 1}. ${c.page} (${c.count} reports, type: ${c.type})\n`;
      });
      report += `\n`;
    }

    if (accuracy_complaints.length > 0) {
      report += `## Most Reported Players (Value Issues)\n`;
      accuracy_complaints.forEach((c, i) => {
        report += `${i + 1}. ${c.player_name} (${c.count} reports)\n`;
      });
      report += `\n`;
    }

    if (most_confusing_pages.length > 0) {
      report += `## Most Confusing Pages\n`;
      most_confusing_pages.forEach((c, i) => {
        report += `${i + 1}. ${c.page} (${c.count} reports)\n`;
      });
      report += `\n`;
    }

    if (feature_requests.length > 0) {
      report += `## Top Feature Requests\n`;
      feature_requests.forEach((c, i) => {
        report += `${i + 1}. ${c.message.slice(0, 100)}... (${c.count} requests)\n`;
      });
      report += `\n`;
    }

    return new Response(
      JSON.stringify({
        summary,
        formatted_report: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
