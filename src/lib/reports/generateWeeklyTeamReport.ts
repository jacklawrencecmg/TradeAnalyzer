import { supabase } from '../supabase';

interface TeamRoster {
  player_id: string;
  player_name: string;
  position: string;
  value: number;
}

interface WeeklyReport {
  user_id: string;
  league_id: string;
  week: number;
  season: number;
  summary: string;
  strengths: any[];
  weaknesses: any[];
  missed_moves: any[];
  recommended_moves: any[];
  value_change: number;
}

export async function generateWeeklyTeamReport(
  userId: string,
  leagueId: string,
  week: number,
  season: number = 2025
): Promise<WeeklyReport | null> {
  try {
    const { data: league } = await supabase
      .from('leagues')
      .select('*, league_rosters(*)')
      .eq('id', leagueId)
      .single();

    if (!league) return null;

    const userRoster = league.league_rosters.find((r: any) => r.user_id === userId);
    if (!userRoster) return null;

    const roster: TeamRoster[] = userRoster.players || [];

    const { data: lastWeekReport } = await supabase
      .from('weekly_team_reports')
      .select('value_change')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('week', week - 1)
      .eq('season', season)
      .maybeSingle();

    const currentValue = roster.reduce((sum, p) => sum + (p.value || 0), 0);
    const lastWeekValue = lastWeekReport ? currentValue - lastWeekReport.value_change : currentValue;
    const valueChange = currentValue - lastWeekValue;

    const positionGroups = {
      QB: roster.filter(p => p.position === 'QB'),
      RB: roster.filter(p => p.position === 'RB'),
      WR: roster.filter(p => p.position === 'WR'),
      TE: roster.filter(p => p.position === 'TE'),
    };

    const strengths = [];
    const weaknesses = [];

    for (const [pos, players] of Object.entries(positionGroups)) {
      const avgValue = players.reduce((sum, p) => sum + (p.value || 0), 0) / Math.max(players.length, 1);

      if (players.length >= 3 && avgValue > 500) {
        strengths.push({
          position: pos,
          reason: `Strong ${pos} depth with ${players.length} players averaging ${Math.round(avgValue)} value`,
          players: players.map(p => p.player_name).slice(0, 3),
        });
      }

      if (players.length < 2 || avgValue < 300) {
        weaknesses.push({
          position: pos,
          reason: `Weak ${pos} depth - only ${players.length} player(s) averaging ${Math.round(avgValue)} value`,
          suggestion: `Consider targeting ${pos} in trades or waivers`,
        });
      }
    }

    const recommendedMoves = [];

    if (weaknesses.length > 0) {
      const weakestPos = weaknesses[0].position;
      const strongestPos = strengths.length > 0 ? strengths[0].position : null;

      if (strongestPos && strongestPos !== weakestPos) {
        recommendedMoves.push({
          type: 'trade',
          action: `Trade from ${strongestPos} depth to acquire ${weakestPos}`,
          priority: 'high',
        });
      }
    }

    const summary = generateSummary(valueChange, strengths, weaknesses);

    const report: WeeklyReport = {
      user_id: userId,
      league_id: leagueId,
      week,
      season,
      summary,
      strengths,
      weaknesses,
      missed_moves: [],
      recommended_moves: recommendedMoves,
      value_change: valueChange,
    };

    const { error } = await supabase
      .from('weekly_team_reports')
      .upsert(report, {
        onConflict: 'user_id,league_id,week,season',
      });

    if (error) throw error;

    return report;
  } catch (error) {
    console.error('Error generating weekly team report:', error);
    return null;
  }
}

function generateSummary(valueChange: number, strengths: any[], weaknesses: any[]): string {
  let summary = '';

  if (valueChange > 100) {
    summary += 'Your team value increased this week. ';
  } else if (valueChange < -100) {
    summary += 'Your team value decreased this week. ';
  } else {
    summary += 'Your team value remained stable this week. ';
  }

  if (strengths.length > 0) {
    summary += `Your ${strengths[0].position} position is a strength. `;
  }

  if (weaknesses.length > 0) {
    summary += `However, your ${weaknesses[0].position} depth needs attention. `;
  }

  if (weaknesses.length > 0 && strengths.length > 0) {
    summary += `Consider trading from your ${strengths[0].position} depth to improve at ${weaknesses[0].position}.`;
  } else if (weaknesses.length > 0) {
    summary += `Focus on adding ${weaknesses[0].position} talent this week.`;
  } else {
    summary += 'Your roster looks balanced overall.';
  }

  return summary;
}

export async function generateAllWeeklyReports(week: number, season: number = 2025) {
  try {
    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, league_rosters(user_id)');

    if (!leagues) return;

    for (const league of leagues) {
      const userIds = new Set(league.league_rosters.map((r: any) => r.user_id).filter(Boolean));

      for (const userId of userIds) {
        await generateWeeklyTeamReport(userId, league.id, week, season);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Generated weekly reports for week ${week}, season ${season}`);
  } catch (error) {
    console.error('Error generating all weekly reports:', error);
  }
}
