import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users, X, ChevronLeft, ChevronRight, Calendar, DollarSign } from 'lucide-react';
import { calculatePowerRankings, type TeamRanking } from '../services/sleeperApi';

interface PowerRankingsProps {
  leagueId: string;
}

export default function PowerRankings({ leagueId }: PowerRankingsProps) {
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamRanking | null>(null);

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
                    <h3
                      className="text-xl font-bold text-white hover:text-[#00d4ff] cursor-pointer transition-colors"
                      onClick={() => setSelectedTeam(team)}
                    >
                      {team.team_name}
                    </h3>
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
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-400">
                    All Players ({team.all_players.length})
                  </div>
                  <button
                    onClick={() => setSelectedTeam(team)}
                    className="text-xs text-[#00d4ff] hover:text-[#00a8cc] transition-colors"
                  >
                    View Full Team
                  </button>
                </div>
                <div className="relative">
                  <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                    <div className="flex gap-3 min-w-max">
                      {team.all_players.slice(0, 15).map((player, idx) => (
                        <div
                          key={player.player_id}
                          className="bg-gray-900 rounded-lg p-3 border border-gray-700 min-w-[160px]"
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
                          {player.team && (
                            <div className="text-xs text-gray-500 mb-1">{player.team}</div>
                          )}
                          <div className="text-xs text-gray-400">Value: {player.value}</div>
                        </div>
                      ))}
                      {team.all_players.length > 15 && (
                        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 min-w-[160px] flex items-center justify-center">
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="text-[#00d4ff] hover:text-[#00a8cc] transition-colors text-sm"
                          >
                            +{team.all_players.length - 15} more
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTeam && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-4">
                {getRankBadge(selectedTeam.rank)}
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedTeam.team_name}</h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {selectedTeam.record}
                    </span>
                    <span>{selectedTeam.points_for.toFixed(1)} pts</span>
                    <span className="text-[#00d4ff] font-semibold">
                      Total Value: {selectedTeam.total_value.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00d4ff]" />
                    Full Roster ({selectedTeam.all_players.length} Players)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedTeam.all_players.map((player, idx) => (
                      <div
                        key={player.player_id}
                        className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-[#00d4ff] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#00d4ff]">#{idx + 1}</span>
                          <span className="text-xs px-2 py-1 bg-gray-900 rounded text-gray-300 font-medium">
                            {player.position}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-white mb-1">
                          {player.name}
                        </div>
                        {player.team && (
                          <div className="text-xs text-gray-500 mb-1">{player.team}</div>
                        )}
                        <div className="text-xs text-gray-400">Value: {player.value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#00d4ff]" />
                    Draft Picks ({selectedTeam.draft_picks.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedTeam.draft_picks.map((pick, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                      >
                        <div className="text-sm font-bold text-white mb-1">
                          {pick.season} Round {pick.round}
                        </div>
                        <div className="text-xs text-gray-400">
                          {pick.original_owner_id === selectedTeam.roster_id.toString()
                            ? 'Own Pick'
                            : `Roster ${pick.original_owner_id}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#00d4ff]" />
                    FAAB Remaining
                  </h3>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-3xl font-bold text-[#00d4ff]">
                      ${selectedTeam.faab_remaining}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Available for waivers</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
