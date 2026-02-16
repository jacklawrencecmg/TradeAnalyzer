import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function calculateRosterStrength(supabase: any, players: string[]): Promise<number> {
  if (!players || players.length === 0) return 0;

  try {
    const { data: playerValues } = await supabase
      .from('latest_player_values')
      .select('player_id, adjusted_value')
      .in('player_id', players);

    if (!playerValues || playerValues.length === 0) return 0;

    const totalValue = playerValues.reduce((sum: number, p: any) => sum + (p.adjusted_value || 0), 0);
    const avgValue = totalValue / players.length;

    return Math.min(avgValue / 10, 1.0);
  } catch (error) {
    console.error('Error calculating roster strength:', error);
    return 0;
  }
}

function calculateRecordScore(settings: any): number {
  const wins = settings?.wins || 0;
  const losses = settings?.losses || 0;
  const totalGames = wins + losses;

  if (totalGames === 0) return 0.5;

  return wins / totalGames;
}

function calculateRecentPerformance(settings: any): number {
  const pointsFor = settings?.fpts || 0;
  const pointsAgainst = settings?.fpts_against || 0;

  if (pointsFor === 0) return 0.5;

  return pointsFor / Math.max(pointsFor + pointsAgainst, 1);
}

function renderRankingReason(ranking: any, trend: number): string {
  const reasons = [];

  if (trend > 0) {
    reasons.push(`Rising ${trend} spot${trend > 1 ? 's' : ''}`);
  } else if (trend < 0) {
    reasons.push(`Falling ${Math.abs(trend)} spot${Math.abs(trend) > 1 ? 's' : ''}`);
  } else if (ranking.rank === 1) {
    reasons.push('Dominant league leader');
  } else if (ranking.rank <= 3) {
    reasons.push('Strong championship contender');
  }

  if (ranking.roster_strength > 0.8) {
    reasons.push('elite roster value');
  } else if (ranking.roster_strength > 0.6) {
    reasons.push('strong roster depth');
  } else if (ranking.roster_strength < 0.4) {
    reasons.push('needs roster upgrades');
  }

  if (ranking.record_score > 0.7) {
    reasons.push('excellent win percentage');
  } else if (ranking.record_score < 0.3) {
    reasons.push('struggling with losses');
  }

  if (ranking.recent_performance > 0.6) {
    reasons.push('high scoring offense');
  } else if (ranking.recent_performance < 0.4) {
    reasons.push('needs more production');
  }

  if (reasons.length === 0) {
    return 'Steady middle-of-the-pack team';
  }

  return reasons.slice(0, 3).join(' • ');
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
    const leagueId = url.searchParams.get('league_id');
    const week = parseInt(url.searchParams.get('week') || '1');
    const season = parseInt(url.searchParams.get('season') || '2026');

    if (!leagueId) {
      return new Response('Missing league_id', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const rostersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/rosters`
    );
    const rosters = await rostersResponse.json();

    const usersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/users`
    );
    const users = await usersResponse.json();

    const rankings = [];

    for (const roster of rosters) {
      const owner = users.find((u: any) => u.user_id === roster.owner_id);
      const teamName = owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`;

      const rosterStrength = await calculateRosterStrength(supabase, roster.players || []);
      const recordScore = calculateRecordScore(roster.settings);
      const recentPerformance = calculateRecentPerformance(roster.settings);
      const scheduleStrength = 0.5;

      const powerScore =
        rosterStrength * 0.45 +
        recordScore * 0.30 +
        recentPerformance * 0.15 +
        scheduleStrength * 0.10;

      rankings.push({
        team_id: roster.roster_id.toString(),
        team_name: teamName,
        power_score: powerScore,
        roster_strength: rosterStrength,
        record_score: recordScore,
        recent_performance: recentPerformance,
        schedule_strength: scheduleStrength,
        metadata: {
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          points_for: roster.settings?.fpts || 0,
        },
      });
    }

    rankings.sort((a, b) => b.power_score - a.power_score);

    const { data: previousRankings } = await supabase
      .from('league_power_rankings')
      .select('team_id, rank')
      .eq('league_id', leagueId)
      .eq('week', week - 1)
      .eq('season', season);

    const previousRankMap = new Map(
      (previousRankings || []).map((r: any) => [r.team_id, r.rank])
    );

    const finalRankings = rankings.map((ranking, index) => {
      const rank = index + 1;
      const previousRank = previousRankMap.get(ranking.team_id);
      const trend = previousRank ? previousRank - rank : 0;

      const reason = renderRankingReason({ ...ranking, rank }, trend);

      return {
        league_id: leagueId,
        week,
        season,
        team_id: ranking.team_id,
        team_name: ranking.team_name,
        rank,
        power_score: ranking.power_score,
        roster_strength: ranking.roster_strength,
        record_score: ranking.record_score,
        schedule_strength: ranking.schedule_strength,
        recent_performance: ranking.recent_performance,
        metadata: {
          ...ranking.metadata,
          trend,
          reason,
        },
      };
    });

    const { error } = await supabase
      .from('league_power_rankings')
      .upsert(finalRankings, {
        onConflict: 'league_id,week,season,team_id',
      });

    if (error) {
      console.error('Error saving rankings:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        league_id: leagueId,
        week,
        season,
        rankings: finalRankings.length,
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
