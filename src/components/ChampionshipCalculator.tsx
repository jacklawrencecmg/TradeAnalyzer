import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Calendar, PieChart } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue, fetchLeagueUsers, fetchAllPlayers } from '../services/sleeperApi';
import { TeamStrengthsModal } from './TeamStrengthsModal';

interface TeamOdds {
  roster_id: number;
  team_name: string;
  owner_name: string;
  total_value: number;
  win_odds: number;
  playoff_odds: number;
  championship_odds: number;
  strength_of_schedule: number;
  positional_strengths?: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
}

interface ChampionshipCalculatorProps {
  leagueId: string;
}

export default function ChampionshipCalculator({ leagueId }: ChampionshipCalculatorProps) {
  const [loading, setLoading] = useState(false);
  const [teamOdds, setTeamOdds] = useState<TeamOdds[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamOdds | null>(null);
  const [showStrengthsModal, setShowStrengthsModal] = useState(false);

  useEffect(() => {
    calculateOdds();
  }, [leagueId]);

  const calculateOdds = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const users = await fetchLeagueUsers(leagueId);
      const allPlayers = await fetchAllPlayers();

      const userMap = new Map(users.map(user => [user.user_id, user]));

      // Collect all unique player IDs across all rosters
      const allPlayerIds = new Set<string>();
      rosters.forEach((roster: any) => {
        (roster.players || []).forEach((id: string) => allPlayerIds.add(id));
      });

      // Batch fetch all player values at once
      const playerValuesMap = new Map<string, number>();
      await Promise.all(
        Array.from(allPlayerIds).map(async (id) => {
          try {
            const value = await getPlayerValue(id);
            playerValuesMap.set(id, value);
          } catch (err) {
            console.error(`Error fetching value for ${id}:`, err);
            playerValuesMap.set(id, 0);
          }
        })
      );

      const teamValues = rosters.map((roster: any) => {
          const playerIds = roster.players || [];
          const values = playerIds.map((id: string) => playerValuesMap.get(id) || 0);
          const totalValue = values.reduce((sum: number, val: number) => sum + val, 0);

          const positionalStrengths = { QB: 0, RB: 0, WR: 0, TE: 0 };
          playerIds.forEach((playerId: string, index: number) => {
            const player = allPlayers[playerId];
            if (player && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
              positionalStrengths[player.position as keyof typeof positionalStrengths] += values[index] || 0;
            }
          });

          const owner = userMap.get(roster.owner_id);
          const teamName = owner?.metadata?.team_name || owner?.display_name || owner?.username || `Team ${roster.roster_id}`;

          return {
            roster_id: roster.roster_id,
            team_name: teamName,
            owner_name: owner?.display_name || owner?.username || 'Unknown',
            total_value: totalValue,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            points_for: roster.settings?.fpts || 0,
            positional_strengths: positionalStrengths
          };
        });

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
                      <p className="text-gray-400">Total Value: {team.total_value.toFixed(1)}</p>
                    </div>
                  </div>
                  {index === 0 && (
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
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

                <button
                  onClick={() => {
                    setSelectedTeam(team);
                    setShowStrengthsModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <PieChart className="w-4 h-4" />
                  View Team Strengths
                </button>
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

      {selectedTeam && selectedTeam.positional_strengths && (
        <TeamStrengthsModal
          isOpen={showStrengthsModal}
          onClose={() => setShowStrengthsModal(false)}
          teamName={selectedTeam.team_name}
          strengths={[
            { category: 'QB', value: selectedTeam.positional_strengths.QB, color: '#3b82f6' },
            { category: 'RB', value: selectedTeam.positional_strengths.RB, color: '#10b981' },
            { category: 'WR', value: selectedTeam.positional_strengths.WR, color: '#f59e0b' },
            { category: 'TE', value: selectedTeam.positional_strengths.TE, color: '#8b5cf6' },
          ]}
        />
      )}
    </div>
  );
}
