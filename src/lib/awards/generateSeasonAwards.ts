import { supabase } from '../supabase';

interface Award {
  league_id: string;
  season: number;
  award: string;
  roster_id: number | null;
  team_name: string | null;
  user_id: string | null;
  details: string;
  stats: any;
}

export async function generateSeasonAwards(
  leagueId: string,
  season: number = 2025
): Promise<Award[]> {
  try {
    const { data: rankings } = await supabase
      .from('league_power_rankings')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('week', { ascending: true });

    if (!rankings || rankings.length === 0) {
      return [];
    }

    const teams = new Map<string, any>();
    rankings.forEach(r => {
      if (!teams.has(r.team_id)) {
        teams.set(r.team_id, {
          team_id: r.team_id,
          team_name: r.team_name,
          user_id: r.user_id,
          weeks: [],
          total_power: 0,
          best_rank: 999,
          worst_rank: 0,
          roster_value_start: 0,
          roster_value_end: 0,
        });
      }
      const team = teams.get(r.team_id);
      team.weeks.push(r);
      team.total_power += r.power_score;
      team.best_rank = Math.min(team.best_rank, r.rank);
      team.worst_rank = Math.max(team.worst_rank, r.rank);
    });

    teams.forEach(team => {
      if (team.weeks.length > 0) {
        team.roster_value_start = team.weeks[0].roster_strength;
        team.roster_value_end = team.weeks[team.weeks.length - 1].roster_strength;
      }
    });

    const awards: Award[] = [];

    const bestGM = findBestGM(teams);
    if (bestGM) {
      awards.push({
        league_id: leagueId,
        season,
        award: 'Best GM',
        roster_id: parseInt(bestGM.team_id),
        team_name: bestGM.team_name,
        user_id: bestGM.user_id,
        details: `Consistently elite management with an average power score of ${(bestGM.total_power / bestGM.weeks.length).toFixed(2)}`,
        stats: {
          avg_power: (bestGM.total_power / bestGM.weeks.length).toFixed(2),
          best_rank: bestGM.best_rank,
        },
      });
    }

    const mostConsistent = findMostConsistent(teams);
    if (mostConsistent) {
      awards.push({
        league_id: leagueId,
        season,
        award: 'Most Consistent',
        roster_id: parseInt(mostConsistent.team_id),
        team_name: mostConsistent.team_name,
        user_id: mostConsistent.user_id,
        details: `Steady performance all season, never wavering from competitive form`,
        stats: {
          best_rank: mostConsistent.best_rank,
          worst_rank: mostConsistent.worst_rank,
          variance: mostConsistent.worst_rank - mostConsistent.best_rank,
        },
      });
    }

    const dynastyBuilder = findDynastyBuilder(teams);
    if (dynastyBuilder) {
      const valueIncrease = (dynastyBuilder.roster_value_end - dynastyBuilder.roster_value_start) * 100;
      awards.push({
        league_id: leagueId,
        season,
        award: 'Dynasty Builder',
        roster_id: parseInt(dynastyBuilder.team_id),
        team_name: dynastyBuilder.team_name,
        user_id: dynastyBuilder.user_id,
        details: `Increased roster value by ${valueIncrease.toFixed(1)}% through smart acquisitions`,
        stats: {
          value_increase: valueIncrease.toFixed(1),
          start_value: dynastyBuilder.roster_value_start,
          end_value: dynastyBuilder.roster_value_end,
        },
      });
    }

    const biggestRiser = findBiggestRiser(teams);
    if (biggestRiser) {
      awards.push({
        league_id: leagueId,
        season,
        award: 'Biggest Riser',
        roster_id: parseInt(biggestRiser.team_id),
        team_name: biggestRiser.team_name,
        user_id: biggestRiser.user_id,
        details: `Climbed from rank ${biggestRiser.worst_rank} to ${biggestRiser.best_rank} over the season`,
        stats: {
          start_rank: biggestRiser.worst_rank,
          end_rank: biggestRiser.best_rank,
          improvement: biggestRiser.worst_rank - biggestRiser.best_rank,
        },
      });
    }

    const tradeKing = findTradeKing(teams);
    if (tradeKing) {
      awards.push({
        league_id: leagueId,
        season,
        award: 'Trade King',
        roster_id: parseInt(tradeKing.team_id),
        team_name: tradeKing.team_name,
        user_id: tradeKing.user_id,
        details: `Made the most impactful trades, significantly improving team strength`,
        stats: {
          value_increase: ((tradeKing.roster_value_end - tradeKing.roster_value_start) * 100).toFixed(1),
        },
      });
    }

    const { error } = await supabase
      .from('season_awards')
      .upsert(awards, {
        onConflict: 'league_id,season,award',
      });

    if (error) {
      console.error('Error saving awards:', error);
    }

    return awards;
  } catch (error) {
    console.error('Error generating season awards:', error);
    return [];
  }
}

function findBestGM(teams: Map<string, any>): any {
  let best = null;
  let highestAvg = 0;

  teams.forEach(team => {
    if (team.weeks.length === 0) return;
    const avg = team.total_power / team.weeks.length;
    if (avg > highestAvg) {
      highestAvg = avg;
      best = team;
    }
  });

  return best;
}

function findMostConsistent(teams: Map<string, any>): any {
  let best = null;
  let lowestVariance = 999;

  teams.forEach(team => {
    if (team.weeks.length === 0) return;
    const variance = team.worst_rank - team.best_rank;
    if (variance < lowestVariance && team.best_rank <= 6) {
      lowestVariance = variance;
      best = team;
    }
  });

  return best;
}

function findDynastyBuilder(teams: Map<string, any>): any {
  let best = null;
  let highestIncrease = 0;

  teams.forEach(team => {
    if (team.weeks.length === 0) return;
    const increase = team.roster_value_end - team.roster_value_start;
    if (increase > highestIncrease) {
      highestIncrease = increase;
      best = team;
    }
  });

  return best;
}

function findBiggestRiser(teams: Map<string, any>): any {
  let best = null;
  let biggestRise = 0;

  teams.forEach(team => {
    if (team.weeks.length === 0) return;
    const rise = team.worst_rank - team.best_rank;
    if (rise > biggestRise && rise >= 3) {
      biggestRise = rise;
      best = team;
    }
  });

  return best;
}

function findTradeKing(teams: Map<string, any>): any {
  return findDynastyBuilder(teams);
}
