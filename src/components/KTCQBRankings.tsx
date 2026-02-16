import React, { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';
import { PlayerAvatar } from './PlayerAvatar';

interface QBValue {
  position_rank: number;
  full_name: string;
  player_id?: string;
  team: string | null;
  value: number;
  captured_at: string;
}

export default function KTCQBRankings() {
  const [qbs, setQbs] = useState<QBValue[]>([]);
  const [filteredQbs, setFilteredQbs] = useState<QBValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchQBValues();
  }, []);

  useEffect(() => {
    filterQBs();
  }, [qbs, searchTerm, teamFilter]);

  const fetchQBValues = async () => {
    try {
      setLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ktc-qb-values?format=dynasty_sf`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch QB values');
      }

      const data = await response.json();
      setQbs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QB rankings');
    } finally {
      setLoading(false);
    }
  };

  const filterQBs = () => {
    let filtered = [...qbs];

    if (searchTerm) {
      filtered = filtered.filter((qb) =>
        qb.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (teamFilter) {
      filtered = filtered.filter((qb) =>
        qb.team?.toLowerCase() === teamFilter.toLowerCase()
      );
    }

    setFilteredQbs(filtered);
    setCurrentPage(1);
  };

  const uniqueTeams = Array.from(new Set(qbs.map((qb) => qb.team).filter(Boolean))).sort();

  const paginatedQbs = filteredQbs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredQbs.length / itemsPerPage);

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank <= 3) return 'bg-gray-100 text-gray-700 border-gray-300';
    if (rank <= 12) return 'bg-green-50 text-green-700 border-green-200';
    if (rank <= 24) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  if (loading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error loading QB rankings</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchQBValues}
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
          <h2 className="text-2xl font-bold text-gray-900">Dynasty QB Rankings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Superflex format • Powered by Fantasy Draft Pros
          </p>
        </div>
        <button
          onClick={fetchQBValues}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by player name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
          >
            <option value="">All Teams</option>
            {uniqueTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedQbs.map((qb) => (
                <tr key={qb.full_name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold ${getRankBadgeColor(
                        qb.position_rank
                      )}`}
                    >
                      {qb.position_rank === 1 && <Award className="w-5 h-5" />}
                      {qb.position_rank !== 1 && qb.position_rank}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        playerId={qb.player_id}
                        playerName={qb.full_name}
                        team={qb.team || undefined}
                        position="QB"
                        size="md"
                      />
                      <div>
                        <div className="font-semibold text-gray-900">{qb.full_name}</div>
                        <div className="text-sm text-gray-500">QB{qb.position_rank}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {qb.team || 'FA'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{qb.value}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(qb.captured_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredQbs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No quarterbacks found matching your criteria</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredQbs.length)} of{' '}
              {filteredQbs.length} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
