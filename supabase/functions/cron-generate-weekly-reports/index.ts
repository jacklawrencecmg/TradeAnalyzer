import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TeamRoster {
  player_id: string;
  player_name: string;
  position: string;
  value: number;
}

async function generateWeeklyTeamReport(
  supabase: any,
  userId: string,
  leagueId: string,
  week: number,
  season: number
) {
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

    const currentValue = roster.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
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
      const avgValue = players.reduce((sum: number, p: any) => sum + (p.value || 0), 0) / Math.max(players.length, 1);

      if (players.length >= 3 && avgValue > 500) {
        strengths.push({
          position: pos,
          reason: `Strong ${pos} depth with ${players.length} players averaging ${Math.round(avgValue)} value`,
          players: players.map((p: any) => p.player_name).slice(0, 3),
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

    const report = {
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
    console.error('Error generating report:', error);
    return null;
  }
}

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
    const week = parseInt(url.searchParams.get('week') || '1');
    const season = parseInt(url.searchParams.get('season') || '2025');

    const { data: leagues } = await supabase
      .from('leagues')
      .select('id, league_rosters(user_id)');

    if (!leagues) {
      return new Response(
        JSON.stringify({ error: 'No leagues found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];
    for (const league of leagues) {
      const userIds = new Set(
        league.league_rosters.map((r: any) => r.user_id).filter(Boolean)
      );

      for (const userId of userIds) {
        const report = await generateWeeklyTeamReport(
          supabase,
          userId,
          league.id,
          week,
          season
        );
        if (report) {
          results.push(report);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        week,
        season,
        reports_generated: results.length,
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
