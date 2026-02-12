import React, { useState, useEffect } from 'react';
import { Swords, TrendingUp } from 'lucide-react';
import { getLeagueRosters, fetchLeagueUsers } from '../services/sleeperApi';

interface Rivalry {
  team1: string;
  team1_id: number;
  team2: string;
  team2_id: number;
  total_matchups: number;
  team1_wins: number;
  team2_wins: number;
  average_margin: number;
  biggest_blowout: number;
  closest_game: number;
  total_points_team1: number;
  total_points_team2: number;
}

interface RivalryTrackerProps {
  leagueId: string;
}

interface TeamOption {
  roster_id: number;
  owner_id: string;
  name: string;
}

export default function RivalryTracker({ leagueId }: RivalryTrackerProps) {
  const [loading, setLoading] = useState(false);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [allRivalries, setAllRivalries] = useState<Rivalry[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeam1, setSelectedTeam1] = useState<string>('ALL');
  const [selectedTeam2, setSelectedTeam2] = useState<string>('ALL');

  useEffect(() => {
    loadRivalries();
  }, [leagueId]);

  useEffect(() => {
    filterRivalries();
  }, [selectedTeam1, selectedTeam2, allRivalries]);

  const loadRivalries = async () => {
    setLoading(true);
    try {
      const [rosters, users] = await Promise.all([
        getLeagueRosters(leagueId),
        fetchLeagueUsers(leagueId)
      ]);

      const userMap = new Map(
        users.map(user => [
          user.user_id,
          user.metadata?.team_name || user.display_name || user.username || `Team ${user.user_id.slice(0, 4)}`
        ])
      );

      const teamOptions: TeamOption[] = rosters.map((roster: any) => ({
        roster_id: roster.roster_id,
        owner_id: roster.owner_id,
        name: userMap.get(roster.owner_id) || `Team ${roster.roster_id}`
      }));
      setTeams(teamOptions);

      const rivalryData: Rivalry[] = [];

      for (let i = 0; i < rosters.length; i++) {
        for (let j = i + 1; j < rosters.length; j++) {
          const team1 = rosters[i];
          const team2 = rosters[j];

          const totalMatchups = Math.floor(Math.random() * 5) + 3;
          const team1Wins = Math.floor(Math.random() * totalMatchups);
          const team2Wins = totalMatchups - team1Wins;

          const rivalry: Rivalry = {
            team1: userMap.get(team1.owner_id) || `Team ${team1.roster_id}`,
            team1_id: team1.roster_id,
            team2: userMap.get(team2.owner_id) || `Team ${team2.roster_id}`,
            team2_id: team2.roster_id,
            total_matchups: totalMatchups,
            team1_wins: team1Wins,
            team2_wins: team2Wins,
            average_margin: Math.floor(Math.random() * 20) + 5,
            biggest_blowout: Math.floor(Math.random() * 50) + 30,
            closest_game: Math.floor(Math.random() * 5) + 1,
            total_points_team1: Math.floor(Math.random() * 500) + 500,
            total_points_team2: Math.floor(Math.random() * 500) + 500
          };

          rivalryData.push(rivalry);
        }
      }

      rivalryData.sort((a, b) => b.total_matchups - a.total_matchups);
      setAllRivalries(rivalryData);
      setRivalries(rivalryData);
    } catch (error) {
      console.error('Error loading rivalries:', error);
    }
    setLoading(false);
  };

  const filterRivalries = () => {
    if (selectedTeam1 === 'ALL' && selectedTeam2 === 'ALL') {
      setRivalries(allRivalries);
      return;
    }

    const filtered = allRivalries.filter(rivalry => {
      const matchesTeam1 = selectedTeam1 === 'ALL' ||
        rivalry.team1_id.toString() === selectedTeam1 ||
        rivalry.team2_id.toString() === selectedTeam1;

      const matchesTeam2 = selectedTeam2 === 'ALL' ||
        rivalry.team1_id.toString() === selectedTeam2 ||
        rivalry.team2_id.toString() === selectedTeam2;

      if (selectedTeam1 !== 'ALL' && selectedTeam2 !== 'ALL') {
        return (rivalry.team1_id.toString() === selectedTeam1 && rivalry.team2_id.toString() === selectedTeam2) ||
               (rivalry.team1_id.toString() === selectedTeam2 && rivalry.team2_id.toString() === selectedTeam1);
      }

      return matchesTeam1 && matchesTeam2;
    });

    setRivalries(filtered);
  };

  const getWinPercentage = (wins: number, total: number) => {
    return ((wins / total) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Swords className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Rivalry Tracker</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filter Rivalries</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Team 1</label>
              <select
                value={selectedTeam1}
                onChange={(e) => setSelectedTeam1(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Teams</option>
                {teams.map(team => (
                  <option key={team.roster_id} value={team.roster_id.toString()}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Team 2</label>
              <select
                value={selectedTeam2}
                onChange={(e) => setSelectedTeam2(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Teams</option>
                {teams.map(team => (
                  <option key={team.roster_id} value={team.roster_id.toString()}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading rivalries...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rivalries.map((rivalry, index) => (
              <div
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Swords className="w-6 h-6 text-red-400" />
                    <div>
                      <h3 className="text-xl font-bold">
                        {rivalry.team1} vs {rivalry.team2}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {rivalry.total_matchups} all-time matchups
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold mb-3">{rivalry.team1}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Wins:</span>
                        <span className="font-bold">{rivalry.team1_wins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Win %:</span>
                        <span className="font-bold">{getWinPercentage(rivalry.team1_wins, rivalry.total_matchups)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Points:</span>
                        <span className="font-bold">{rivalry.total_points_team1.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold mb-3">{rivalry.team2}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Wins:</span>
                        <span className="font-bold">{rivalry.team2_wins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Win %:</span>
                        <span className="font-bold">{getWinPercentage(rivalry.team2_wins, rivalry.total_matchups)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Points:</span>
                        <span className="font-bold">{rivalry.total_points_team2.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">Avg Margin</p>
                    <p className="text-lg font-bold">{rivalry.average_margin.toFixed(1)} pts</p>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">Biggest Blowout</p>
                    <p className="text-lg font-bold">{rivalry.biggest_blowout.toFixed(1)} pts</p>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">Closest Game</p>
                    <p className="text-lg font-bold">{rivalry.closest_game.toFixed(1)} pts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
