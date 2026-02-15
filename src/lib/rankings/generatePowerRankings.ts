import { supabase } from '../supabase';

interface TeamData {
  roster_id: number;
  team_name: string;
  user_id: string | null;
  roster: any[];
  owner: any;
}

interface PowerRanking {
  league_id: string;
  week: number;
  season: number;
  team_id: string;
  team_name: string;
  user_id: string | null;
  rank: number;
  power_score: number;
  roster_strength: number;
  record_score: number;
  schedule_strength: number;
  recent_performance: number;
  metadata: any;
}

export async function generatePowerRankings(
  leagueId: string,
  week: number,
  season: number = 2025
): Promise<PowerRanking[]> {
  try {
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('sleeper_league_id', leagueId)
      .maybeSingle();

    if (leagueError || !league) {
      console.error('League not found:', leagueError);
      return [];
    }

    const sleeperResponse = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/rosters`
    );
    const rosters = await sleeperResponse.json();

    const usersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/users`
    );
    const users = await usersResponse.json();

    const teamsData: TeamData[] = rosters.map((roster: any) => {
      const owner = users.find((u: any) => u.user_id === roster.owner_id);
      return {
        roster_id: roster.roster_id,
        team_name: owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`,
        user_id: null,
        roster: roster.players || [],
        owner,
        settings: roster.settings,
      };
    });

    const rankings: PowerRanking[] = [];

    for (const team of teamsData) {
      const rosterStrength = await calculateRosterStrength(team.roster);
      const recordScore = calculateRecordScore(team);
      const scheduleStrength = 0.5;
      const recentPerformance = calculateRecentPerformance(team);

      const powerScore =
        rosterStrength * 0.45 +
        recordScore * 0.30 +
        recentPerformance * 0.15 +
        scheduleStrength * 0.10;

      rankings.push({
        league_id: leagueId,
        week,
        season,
        team_id: team.roster_id.toString(),
        team_name: team.team_name,
        user_id: team.user_id,
        rank: 0,
        power_score: powerScore,
        roster_strength: rosterStrength,
        record_score: recordScore,
        schedule_strength: scheduleStrength,
        recent_performance: recentPerformance,
        metadata: {
          wins: team.settings?.wins || 0,
          losses: team.settings?.losses || 0,
          points_for: team.settings?.fpts || 0,
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

    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
      const previousRank = previousRankMap.get(ranking.team_id);
      if (previousRank) {
        ranking.metadata.trend = previousRank - ranking.rank;
      }
    });

    const { error: insertError } = await supabase
      .from('league_power_rankings')
      .upsert(
        rankings.map(r => ({
          league_id: r.league_id,
          week: r.week,
          season: r.season,
          team_id: r.team_id,
          team_name: r.team_name,
          user_id: r.user_id,
          rank: r.rank,
          power_score: r.power_score,
          roster_strength: r.roster_strength,
          record_score: r.record_score,
          schedule_strength: r.schedule_strength,
          recent_performance: r.recent_performance,
          metadata: r.metadata,
        })),
        {
          onConflict: 'league_id,week,season,team_id',
        }
      );

    if (insertError) {
      console.error('Error inserting rankings:', insertError);
    }

    return rankings;
  } catch (error) {
    console.error('Error generating power rankings:', error);
    return [];
  }
}

async function calculateRosterStrength(players: string[]): Promise<number> {
  if (!players || players.length === 0) return 0;

  try {
    const { data: playerValues } = await supabase
      .from('player_values')
      .select('player_id, value')
      .in('player_id', players);

    if (!playerValues || playerValues.length === 0) return 0;

    const totalValue = playerValues.reduce((sum, p) => sum + (p.value || 0), 0);
    const avgValue = totalValue / players.length;

    return Math.min(avgValue / 10, 1.0);
  } catch (error) {
    console.error('Error calculating roster strength:', error);
    return 0;
  }
}

function calculateRecordScore(team: any): number {
  const wins = team.settings?.wins || 0;
  const losses = team.settings?.losses || 0;
  const totalGames = wins + losses;

  if (totalGames === 0) return 0.5;

  const winPct = wins / totalGames;
  return winPct;
}

function calculateRecentPerformance(team: any): number {
  const pointsFor = team.settings?.fpts || 0;
  const pointsAgainst = team.settings?.fpts_against || 0;

  if (pointsFor === 0) return 0.5;

  const ratio = pointsFor / Math.max(pointsFor + pointsAgainst, 1);
  return ratio;
}

export function renderRankingReason(
  ranking: PowerRanking,
  trend: number
): string {
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
