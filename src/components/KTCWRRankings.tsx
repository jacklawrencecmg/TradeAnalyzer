import React, { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, Award, Radio } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';
import { PlayerAvatar } from './PlayerAvatar';
import { supabase } from '../lib/supabase';

interface WRValue {
  position_rank: number;
  full_name: string;
  player_name: string;
  player_id?: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
}

export default function KTCWRRankings() {
  const [wrs, setWrs] = useState<WRValue[]>([]);
  const [filteredWrs, setFilteredWrs] = useState<WRValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchWRValues();
  }, []);

  useEffect(() => {
    filterWRs();
  }, [wrs, searchTerm, teamFilter]);

  const fetchWRValues = async () => {
    try {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_latest_values', {
        p_format: 'dynasty_sf',
        p_position: 'WR',
        p_limit: null
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setWrs(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load WR rankings');
    } finally {
      setLoading(false);
    }
  };

  const filterWRs = () => {
    let filtered = [...wrs];

    if (searchTerm) {
      filtered = filtered.filter((wr) =>
        wr.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (teamFilter) {
      filtered = filtered.filter((wr) =>
        wr.team?.toLowerCase() === teamFilter.toLowerCase()
      );
    }

    setFilteredWrs(filtered);
    setCurrentPage(1);
  };

  const uniqueTeams = Array.from(new Set(wrs.map((wr) => wr.team).filter(Boolean))).sort();

  const paginatedWrs = filteredWrs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredWrs.length / itemsPerPage);

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank <= 3) return 'bg-gray-100 text-gray-700 border-gray-300';
    if (rank <= 12) return 'bg-green-50 text-green-700 border-green-200';
    if (rank <= 24) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (rank <= 36) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getTierLabel = (rank: number) => {
    if (rank <= 12) return 'WR1';
    if (rank <= 24) return 'WR2';
    if (rank <= 36) return 'WR3';
    if (rank <= 48) return 'WR4';
    return 'Depth';
  };

  if (loading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Error loading WR rankings</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchWRValues}
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
            <Radio className="w-7 h-7 text-blue-600" />
            Wide Receiver Rankings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Dynasty Superflex values from Fantasy Draft Pros
          </p>
        </div>
        <button
          onClick={fetchWRValues}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search wide receivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
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
              {paginatedWrs.map((wr) => (
                <tr
                  key={`${wr.full_name}-${wr.position_rank}`}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold ${getRankBadgeColor(
                        wr.position_rank
                      )}`}
                    >
                      {wr.position_rank}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        playerId={wr.player_id}
                        playerName={wr.full_name}
                        team={wr.team || undefined}
                        position="WR"
                        size="md"
                      />
                      <div>
                        <div className="font-semibold text-gray-900">{wr.full_name}</div>
                        <div className="text-xs text-gray-500">Wide Receiver</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {wr.team || 'FA'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">
                      {getTierLabel(wr.position_rank)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-lg font-bold text-gray-900">{wr.fdp_value || wr.ktc_value}</span>
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
              {Math.min(currentPage * itemsPerPage, filteredWrs.length)} of {filteredWrs.length}{' '}
              wide receivers
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

      {filteredWrs.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No wide receivers found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
