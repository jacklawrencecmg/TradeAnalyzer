import React, { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, Award, Zap } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';
import { PlayerAvatar } from './PlayerAvatar';

interface TEValue {
  position_rank: number;
  full_name: string;
  player_id?: string;
  team: string | null;
  value: number;
  captured_at: string;
}

export default function KTCTERankings() {
  const [tes, setTes] = useState<TEValue[]>([]);
  const [filteredTes, setFilteredTes] = useState<TEValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchTEValues();
  }, []);

  useEffect(() => {
    filterTEs();
  }, [tes, searchTerm, teamFilter]);

  const fetchTEValues = async () => {
    try {
      setLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ktc-te-values?format=dynasty_sf`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch TE values');
      }

      const data = await response.json();
      setTes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TE rankings');
    } finally {
      setLoading(false);
    }
  };

  const filterTEs = () => {
    let filtered = [...tes];

    if (searchTerm) {
      filtered = filtered.filter((te) =>
        te.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (teamFilter) {
      filtered = filtered.filter((te) =>
        te.team?.toLowerCase() === teamFilter.toLowerCase()
      );
    }

    setFilteredTes(filtered);
    setCurrentPage(1);
  };

  const uniqueTeams = Array.from(new Set(tes.map((te) => te.team).filter(Boolean))).sort();

  const paginatedTes = filteredTes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredTes.length / itemsPerPage);

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank <= 3) return 'bg-gray-100 text-gray-700 border-gray-300';
    if (rank <= 6) return 'bg-green-50 text-green-700 border-green-200';
    if (rank <= 12) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (rank <= 18) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getTierLabel = (rank: number) => {
    if (rank <= 6) return 'Elite TE';
    if (rank <= 12) return 'TE1';
    if (rank <= 24) return 'TE2';
    return 'Depth';
  };

  const isPremium = (rank: number) => rank <= 6;

  if (loading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error loading TE rankings</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchTEValues}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-orange-600" />
            Tight End Rankings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Dynasty Superflex values from Fantasy Draft Pros
          </p>
        </div>
        <button
          onClick={fetchTEValues}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 text-orange-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-orange-900">TE Premium Impact</h3>
            <p className="text-sm text-orange-700 mt-1">
              Tight ends have significant value variance. Elite TEs (Top 6) provide massive positional advantage in dynasty formats, especially in TE Premium leagues.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tight ends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
            >
              <option value="">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team || ''}>
                  {team}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Rank
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Player
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Team
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tier
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTes.map((te) => (
                <tr
                  key={`${te.full_name}-${te.position_rank}`}
                  className={`transition-colors ${
                    isPremium(te.position_rank)
                      ? 'bg-orange-50 hover:bg-orange-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold ${getRankBadgeColor(
                          te.position_rank
                        )}`}
                      >
                        {te.position_rank}
                      </div>
                      {isPremium(te.position_rank) && (
                        <Award className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        playerId={te.player_id}
                        playerName={te.full_name}
                        team={te.team || undefined}
                        position="TE"
                        size="md"
                      />
                      <div>
                        <div className="font-semibold text-gray-900">{te.full_name}</div>
                        <div className="text-xs text-gray-500">Tight End</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {te.team || 'FA'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      isPremium(te.position_rank) ? 'text-orange-700' : 'text-gray-700'
                    }`}>
                      {getTierLabel(te.position_rank)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-lg font-bold text-gray-900">{te.value}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredTes.length)} of {filteredTes.length}{' '}
              tight ends
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {filteredTes.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No tight ends found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
