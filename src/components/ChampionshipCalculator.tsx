import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface TeamOdds {
  roster_id: number;
  team_name: string;
  owner_name: string;
  total_value: number;
  win_odds: number;
  playoff_odds: number;
  championship_odds: number;
  strength_of_schedule: number;
}

interface ChampionshipCalculatorProps {
  leagueId: string;
}

export default function ChampionshipCalculator({ leagueId }: ChampionshipCalculatorProps) {
  const [loading, setLoading] = useState(false);
  const [teamOdds, setTeamOdds] = useState<TeamOdds[]>([]);

  useEffect(() => {
    calculateOdds();
  }, [leagueId]);

  const calculateOdds = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

      const teamValues = await Promise.all(
        rosters.map(async (roster: any) => {
          const playerIds = roster.players || [];
          const values = await Promise.all(
            playerIds.map((id: string) => getPlayerValue(id))
          );
          const totalValue = values.reduce((sum: number, val: number) => sum + val, 0);

          return {
            roster_id: roster.roster_id,
            team_name: `Team ${roster.roster_id}`,
            owner_name: roster.owner_id,
            total_value: totalValue,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            points_for: roster.settings?.fpts || 0
          };
        })
      );

      const totalLeagueValue = teamValues.reduce((sum, team) => sum + team.total_value, 0);
      const avgValue = totalLeagueValue / teamValues.length;

      const odds: TeamOdds[] = teamValues.map(team => {
        const valueStrength = team.total_value / avgValue;
        const recordStrength = team.wins / Math.max(team.wins + team.losses, 1);

        const playoffBase = (valueStrength * 0.6 + recordStrength * 0.4) * 100;
        const playoff_odds = Math.min(Math.max(playoffBase, 1), 99);

        const championshipBase = (valueStrength * 0.7 + recordStrength * 0.3) * (playoff_odds / 100) * 100;
        const championship_odds = Math.min(Math.max(championshipBase, 0.5), 75);

        return {
          roster_id: team.roster_id,
          team_name: team.team_name,
          owner_name: team.owner_name,
          total_value: team.total_value,
          win_odds: valueStrength * 50,
          playoff_odds,
          championship_odds,
          strength_of_schedule: 50
        };
      });

      setTeamOdds(odds.sort((a, b) => b.championship_odds - a.championship_odds));
    } catch (error) {
      console.error('Error calculating odds:', error);
    }
    setLoading(false);
  };

  const getOddsColor = (odds: number) => {
    if (odds >= 50) return 'text-green-400';
    if (odds >= 25) return 'text-blue-400';
    if (odds >= 10) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">Championship Probability</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Calculating championship odds...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teamOdds.map((team, index) => (
              <div
                key={team.roster_id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-gray-500">#{index + 1}</span>
                    <div>
                      <h3 className="text-xl font-bold">{team.team_name}</h3>
                      <p className="text-gray-400">Total Value: {team.total_value.toLocaleString()}</p>
                    </div>
                  </div>
                  {index === 0 && (
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Playoff Odds</p>
                    <p className={`text-2xl font-bold ${getOddsColor(team.playoff_odds)}`}>
                      {team.playoff_odds.toFixed(1)}%
                    </p>
                    <div className="mt-2 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 rounded-full h-2 transition-all"
                        style={{ width: `${team.playoff_odds}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-1">Championship Odds</p>
                    <p className={`text-2xl font-bold ${getOddsColor(team.championship_odds)}`}>
                      {team.championship_odds.toFixed(1)}%
                    </p>
                    <div className="mt-2 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-500 rounded-full h-2 transition-all"
                        style={{ width: `${team.championship_odds}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400 mb-1">Weekly Win Probability</p>
                    <p className={`text-2xl font-bold ${getOddsColor(team.win_odds)}`}>
                      {team.win_odds.toFixed(1)}%
                    </p>
                    <div className="mt-2 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 rounded-full h-2 transition-all"
                        style={{ width: `${team.win_odds}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            How Odds Are Calculated
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>Championship odds are based on:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Total roster value (70% weight)</li>
              <li>Current win-loss record (30% weight)</li>
              <li>Playoff qualification probability</li>
            </ul>
            <p className="mt-4 text-gray-400">
              These probabilities are estimates based on current roster strength and performance.
              Actual results may vary based on matchups, injuries, and other factors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
