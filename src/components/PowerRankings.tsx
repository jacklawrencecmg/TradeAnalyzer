import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users, X, ChevronLeft, ChevronRight, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { calculatePowerRankings, type TeamRanking } from '../services/sleeperApi';
import { playerValuesApi } from '../services/playerValuesApi';

interface PowerRankingsProps {
  leagueId: string;
}

export default function PowerRankings({ leagueId }: PowerRankingsProps) {
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamRanking | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  async function syncPlayerValues() {
    setSyncing(true);
    setError(null);
    try {
      const count = await playerValuesApi.syncPlayerValuesFromSportsData(false);
      console.log(`Synced ${count} player values from SportsData.io`);
      await loadRankings();
    } catch (err) {
      console.error('Failed to sync player values:', err);
      setError('Failed to sync player values from SportsData.io. Please try again.');
    } finally {
      setSyncing(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={syncPlayerValues}
              disabled={syncing}
              className="text-sm px-4 py-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] rounded-lg transition-colors border border-[#00d4ff]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Sync player values from SportsData.io"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Values'}
            </button>
            <button
              onClick={loadRankings}
              disabled={loading}
              className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {rankings.map((team) => (
            <div
              key={team.roster_id}
              className={`bg-gray-800 rounded-lg border ${
                team.rank <= 3 ? 'border-[#00d4ff]' : 'border-gray-700'
              } overflow-hidden hover:border-[#00d4ff] transition-all duration-300 ${
                team.rank <= 3 ? 'shadow-lg shadow-[#00d4ff]/20' : ''
              }`}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    {getRankBadge(team.rank)}
                    <div className="flex-1">
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
                  <div className="text-right ml-4">
                    <div className="text-sm text-gray-400 mb-1">Total Value</div>
                    <div className="text-2xl font-bold text-[#00d4ff]">
                      {team.total_value.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Players</div>
                    <div className="text-lg font-bold text-white">{team.all_players.length}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Draft Picks</div>
                    <div className="text-lg font-bold text-white">{team.draft_picks.length}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">FAAB</div>
                    <div className="text-lg font-bold text-white">${team.faab_remaining}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Avg Player</div>
                    <div className="text-lg font-bold text-white">
                      {team.all_players.length > 0
                        ? (team.total_value / team.all_players.length).toFixed(1)
                        : '0.0'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTeam(team)}
                  className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-[#00d4ff] rounded-lg transition-colors border border-gray-700 text-sm font-semibold"
                >
                  View Full Roster
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTeam && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center gap-4">
                {getRankBadge(selectedTeam.rank)}
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedTeam.team_name}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-gray-400">
                      <Users className="w-4 h-4" />
                      {selectedTeam.record}
                    </span>
                    <span className="text-gray-400">{selectedTeam.points_for.toFixed(1)} pts</span>
                    <span className="text-[#00d4ff] font-semibold">
                      Value: {selectedTeam.total_value.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-[#00d4ff]" />
                      <div className="text-sm text-gray-400">Total Players</div>
                    </div>
                    <div className="text-3xl font-bold text-white">{selectedTeam.all_players.length}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-[#00d4ff]" />
                      <div className="text-sm text-gray-400">Draft Picks</div>
                    </div>
                    <div className="text-3xl font-bold text-white">{selectedTeam.draft_picks.length}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-[#00d4ff]" />
                      <div className="text-sm text-gray-400">FAAB Left</div>
                    </div>
                    <div className="text-3xl font-bold text-white">${selectedTeam.faab_remaining}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="w-6 h-6 text-[#00d4ff]" />
                      Roster
                    </h3>
                    <div className="text-sm text-gray-400">
                      {selectedTeam.all_players.length} players
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {selectedTeam.all_players.map((player, idx) => (
                      <div
                        key={player.player_id}
                        className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-[#00d4ff] transition-all duration-200 hover:shadow-lg hover:shadow-[#00d4ff]/10"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={`https://sleepercdn.com/content/nfl/players/thumb/${player.player_id}.jpg`}
                              alt={player.name}
                              className="w-16 h-16 rounded-full object-cover bg-gray-900 border-2 border-gray-700"
                              onError={(e) => {
                                e.currentTarget.src = `https://sleepercdn.com/images/v2/icons/player_default.webp`;
                              }}
                            />
                            <span className="absolute -top-1 -right-1 text-xs font-bold text-[#00d4ff] bg-gray-900 px-1.5 py-0.5 rounded-full border border-[#00d4ff]/30">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="text-sm font-semibold text-white truncate" title={player.name}>
                                {player.name}
                              </div>
                              <span className="text-xs px-2 py-1 bg-gray-900 rounded text-gray-300 font-semibold flex-shrink-0">
                                {player.position}
                              </span>
                            </div>
                            {player.team && (
                              <div className="text-xs text-gray-500 mb-2">{player.team}</div>
                            )}
                            <div className="text-xs font-medium text-[#00d4ff] bg-[#00d4ff]/10 px-2 py-1 rounded inline-block">
                              {player.value.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTeam.draft_picks.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-[#00d4ff]" />
                        Draft Picks
                      </h3>
                      <div className="text-sm text-gray-400">
                        {selectedTeam.draft_picks.length} picks
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {selectedTeam.draft_picks.map((pick, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center hover:border-[#00d4ff] transition-colors"
                        >
                          <div className="text-sm font-bold text-white mb-1">
                            {pick.season}
                          </div>
                          <div className="text-xs text-[#00d4ff] font-semibold mb-1">
                            Round {pick.round}
                          </div>
                          <div className="text-xs text-gray-400">
                            {pick.original_owner_id === selectedTeam.roster_id.toString()
                              ? 'Own'
                              : `R${pick.original_owner_id}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
