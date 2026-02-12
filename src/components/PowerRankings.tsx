import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { calculatePowerRankings, type TeamRanking } from '../services/sleeperApi';

interface PowerRankingsProps {
  leagueId: string;
}

export default function PowerRankings({ leagueId }: PowerRankingsProps) {
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRankings();
  }, [leagueId]);

  async function loadRankings() {
    setLoading(true);
    setError(null);
    try {
      const data = await calculatePowerRankings(leagueId);
      setRankings(data);
    } catch (err) {
      console.error('Failed to load power rankings:', err);
      setError('Failed to load power rankings. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading power rankings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadRankings}
          className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  function getRankBadge(rank: number) {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">1st</span>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full">
          <Trophy className="w-4 h-4 text-gray-700" />
          <span className="text-gray-700 font-bold text-sm">2nd</span>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-600 to-orange-700 rounded-full">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">3rd</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center w-10 h-10 bg-gray-800 rounded-full border border-gray-700">
          <span className="text-gray-400 font-bold">{rank}</span>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#00d4ff]" />
            Power Rankings
          </h2>
          <button
            onClick={loadRankings}
            className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-4">
          {rankings.map((team) => (
            <div
              key={team.roster_id}
              className={`bg-gray-800 rounded-lg border ${
                team.rank <= 3 ? 'border-[#00d4ff]' : 'border-gray-700'
              } p-5 hover:border-[#00d4ff] transition-all duration-300 ${
                team.rank <= 3 ? 'shadow-lg shadow-[#00d4ff]/20' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {getRankBadge(team.rank)}
                  <div>
                    <h3 className="text-xl font-bold text-white">{team.team_name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {team.record}
                      </span>
                      <span>{team.points_for.toFixed(1)} pts</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">Total Value</div>
                  <div className="text-2xl font-bold text-[#00d4ff]">
                    {team.total_value.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-semibold text-gray-400 mb-3">Top 5 Players</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {team.top_players.map((player, idx) => (
                    <div
                      key={player.player_id}
                      className="bg-gray-900 rounded-lg p-3 border border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#00d4ff]">#{idx + 1}</span>
                        <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300 font-medium">
                          {player.position}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white mb-1 truncate">
                        {player.name}
                      </div>
                      <div className="text-xs text-gray-400">Value: {player.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
