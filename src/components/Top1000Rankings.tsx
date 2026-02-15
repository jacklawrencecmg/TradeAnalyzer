import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Filter, TrendingUp, Users, Shield, RefreshCw, Calendar } from 'lucide-react';

interface Top1000Player {
  rank: number;
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  dynasty_value: number;
  redraft_value: number;
  overall_value: number;
  status: string;
  age: number | null;
  source: string;
  captured_at: string;
}

interface Top1000Response {
  as_of_date: string;
  format: string;
  filters: {
    include_idp: boolean;
    position: string | null;
    team: string | null;
  };
  stats: {
    total: number;
    offense: number;
    idp: number;
  };
  players: Top1000Player[];
  meta: {
    created_at: string;
    offense_count: number;
    idp_count: number;
    total_count: number;
  };
}

type ViewMode = 'all' | 'offense' | 'idp';
type ValueMode = 'both' | 'dynasty' | 'redraft';

export default function Top1000Rankings() {
  const [data, setData] = useState<Top1000Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [valueMode, setValueMode] = useState<ValueMode>('both');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');

  useEffect(() => {
    loadTop1000();
  }, []);

  async function loadTop1000() {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/get-top1000`;

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result: Top1000Response = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading Top 1000:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = useMemo(() => {
    if (!data) return [];

    let players = data.players;

    // View mode filter
    if (viewMode === 'offense') {
      players = players.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
    } else if (viewMode === 'idp') {
      players = players.filter(p => ['DL', 'LB', 'DB'].includes(p.position));
    }

    // Position filter
    if (positionFilter) {
      players = players.filter(p => p.position === positionFilter);
    }

    // Team filter
    if (teamFilter) {
      players = players.filter(p => p.team === teamFilter);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      players = players.filter(p =>
        p.full_name.toLowerCase().includes(search) ||
        p.position.toLowerCase().includes(search) ||
        (p.team && p.team.toLowerCase().includes(search))
      );
    }

    // Re-rank after filtering
    return players.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [data, viewMode, positionFilter, teamFilter, searchTerm]);

  const positions = useMemo(() => {
    if (!data) return [];
    const posSet = new Set(data.players.map(p => p.position));
    return Array.from(posSet).sort();
  }, [data]);

  const teams = useMemo(() => {
    if (!data) return [];
    const teamSet = new Set(data.players.filter(p => p.team).map(p => p.team!));
    return Array.from(teamSet).sort();
  }, [data]);

  async function exportToCSV() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/get-top1000?export=csv`;

      const response = await fetch(apiUrl);
      const csvData = await response.text();

      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `top1000_${data?.as_of_date || 'latest'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-[#00d4ff] mx-auto mb-4" />
          <p className="text-gray-400">Loading Top 1000 rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadTop1000}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Top 1000 Fantasy Players</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>As of {data.as_of_date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{data.stats.total} players</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTop1000}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-[#00d4ff] hover:bg-[#00b8e6] text-gray-900 rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setViewMode('all')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
            viewMode === 'all'
              ? 'text-[#00d4ff] border-[#00d4ff]'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          Overall ({data.stats.total})
        </button>
        <button
          onClick={() => setViewMode('offense')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
            viewMode === 'offense'
              ? 'text-[#00d4ff] border-[#00d4ff]'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Users className="w-5 h-5" />
          Offense ({data.stats.offense})
        </button>
        <button
          onClick={() => setViewMode('idp')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
            viewMode === 'idp'
              ? 'text-[#00d4ff] border-[#00d4ff]'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Shield className="w-5 h-5" />
          IDP ({data.stats.idp})
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff]"
            />
          </div>

          {/* Position Filter */}
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff]"
          >
            <option value="">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff]"
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          {/* Value Mode */}
          <select
            value={valueMode}
            onChange={(e) => setValueMode(e.target.value as ValueMode)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff]"
          >
            <option value="both">Both Values</option>
            <option value="dynasty">Dynasty Only</option>
            <option value="redraft">Redraft Only</option>
          </select>
        </div>

        {(searchTerm || positionFilter || teamFilter) && (
          <div className="mt-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              Showing {filteredPlayers.length} of {data.players.length} players
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setPositionFilter('');
                setTeamFilter('');
              }}
              className="ml-auto text-sm text-[#00d4ff] hover:text-[#00b8e6]"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Rankings Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Pos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                {(valueMode === 'both' || valueMode === 'dynasty') && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Dynasty
                  </th>
                )}
                {(valueMode === 'both' || valueMode === 'redraft') && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Redraft
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Overall
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Age
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredPlayers.map((player) => (
                <tr key={player.player_id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-300">
                    #{player.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-white">{player.full_name}</div>
                      <div className="text-xs text-gray-500">{player.status}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      player.position === 'QB' ? 'bg-red-900/30 text-red-400' :
                      player.position === 'RB' ? 'bg-green-900/30 text-green-400' :
                      player.position === 'WR' ? 'bg-blue-900/30 text-blue-400' :
                      player.position === 'TE' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-purple-900/30 text-purple-400'
                    }`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {player.team || '-'}
                  </td>
                  {(valueMode === 'both' || valueMode === 'dynasty') && (
                    <td className="px-4 py-3 text-sm text-right font-medium text-[#00d4ff]">
                      {player.dynasty_value.toLocaleString()}
                    </td>
                  )}
                  {(valueMode === 'both' || valueMode === 'redraft') && (
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-400">
                      {player.redraft_value.toLocaleString()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-right font-bold text-white">
                    {player.overall_value.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {player.age || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No players match the current filters
          </div>
        )}
      </div>
    </div>
  );
}
