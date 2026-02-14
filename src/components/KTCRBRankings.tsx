import React, { useState, useEffect } from 'react';
import { Search, Filter, Award } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';

interface RBValue {
  position_rank: number;
  full_name: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  value: number;
  captured_at: string;
}

export default function KTCRBRankings() {
  const [rbs, setRbs] = useState<RBValue[]>([]);
  const [filteredRbs, setFilteredRbs] = useState<RBValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [showFdpValue, setShowFdpValue] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const itemsPerPage = 25;

  useEffect(() => {
    fetchRBValues();
  }, []);

  useEffect(() => {
    filterRBs();
  }, [rbs, searchTerm, teamFilter]);

  const fetchRBValues = async () => {
    try {
      setLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ktc-rb-values?format=dynasty_sf`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch RB values');
      }

      const data = await response.json();
      setRbs(data);

      if (data.length > 0) {
        const latest = new Date(data[0].captured_at);
        setLastUpdated(latest.toLocaleString());
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RB rankings');
    } finally {
      setLoading(false);
    }
  };

  const filterRBs = () => {
    let filtered = [...rbs];

    if (searchTerm) {
      filtered = filtered.filter((rb) =>
        rb.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (teamFilter) {
      filtered = filtered.filter((rb) =>
        rb.team?.toLowerCase() === teamFilter.toLowerCase()
      );
    }

    setFilteredRbs(filtered);
    setCurrentPage(1);
  };

  const uniqueTeams = Array.from(new Set(rbs.map((rb) => rb.team).filter(Boolean))).sort();

  const paginatedRbs = filteredRbs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRbs.length / itemsPerPage);

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
        <p className="font-semibold">Error loading RB rankings</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchRBValues}
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
            <Award className="w-7 h-7 text-green-600" />
            Running Back Rankings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Dynasty Superflex values from KeepTradeCut
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated}</p>
          )}
        </div>
        <button
          onClick={fetchRBValues}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search running backs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
            >
              <option value="">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFdpValue}
                onChange={(e) => setShowFdpValue(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show FDP Values</span>
            </label>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Showing {filteredRbs.length} of {rbs.length} running backs
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {showFdpValue ? 'FDP Value' : 'KTC Value'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedRbs.map((rb) => (
                <tr key={`${rb.full_name}-${rb.position_rank}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold border ${getRankBadgeColor(rb.position_rank)}`}>
                      {rb.position_rank === 1 && '🥇'}
                      {rb.position_rank === 2 && '🥈'}
                      {rb.position_rank === 3 && '🥉'}
                      {rb.position_rank > 3 && `#${rb.position_rank}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{rb.full_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700 font-medium">{rb.team || 'FA'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-gray-900">
                      {showFdpValue ? rb.fdp_value.toLocaleString() : rb.ktc_value.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">About RB Rankings</h3>
        <p className="text-sm text-blue-800">
          Running back values are synced from KeepTradeCut and reflect dynasty superflex league formats.
          FDP values apply position multipliers to better reflect positional scarcity in your league format.
        </p>
      </div>
    </div>
  );
}
