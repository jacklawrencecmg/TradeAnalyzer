import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Search, Filter, Users, AlertCircle } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';

interface Player {
  position_rank: number;
  full_name: string;
  position: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
}

type Position = 'QB' | 'RB' | 'WR' | 'TE';
type Format = 'dynasty_sf' | 'dynasty_1qb' | 'dynasty_tep';
type ValueSource = 'fdp' | 'ktc';

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];

const FORMAT_OPTIONS = [
  { value: 'dynasty_sf', label: 'Superflex', abbr: 'SF' },
  { value: 'dynasty_1qb', label: '1QB', abbr: '1QB' },
  { value: 'dynasty_tep', label: 'TEP', abbr: 'TEP' },
];

const VALUE_SOURCE_OPTIONS = [
  { value: 'fdp', label: 'FDP Values' },
  { value: 'ktc', label: 'KTC Values' },
];

export default function UnifiedRankings() {
  const [selectedPosition, setSelectedPosition] = useState<Position>('QB');
  const [selectedFormat, setSelectedFormat] = useState<Format>('dynasty_sf');
  const [valueSource, setValueSource] = useState<ValueSource>('fdp');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  useEffect(() => {
    loadRankings();
  }, [selectedPosition, selectedFormat]);

  const loadRankings = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ktc-rankings?position=${selectedPosition}&format=${selectedFormat}`
      );

      if (!response.ok) {
        throw new Error('Failed to load rankings');
      }

      const data = await response.json();
      setPlayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = !teamFilter || player.team === teamFilter;
    return matchesSearch && matchesTeam;
  });

  const teams = Array.from(new Set(players.map((p) => p.team).filter(Boolean))).sort();

  const getValueColor = (value: number): string => {
    if (value >= 8000) return 'text-green-600';
    if (value >= 5000) return 'text-blue-600';
    if (value >= 3000) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getRankBadgeColor = (rank: number): string => {
    if (rank <= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank <= 12) return 'bg-green-100 text-green-800 border-green-300';
    if (rank <= 24) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-10 h-10 text-yellow-300" />
              <h1 className="text-4xl font-bold text-white">Dynasty Rankings</h1>
            </div>
            <p className="text-blue-100 text-lg">
              KeepTradeCut player values and rankings
            </p>
          </div>

          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position
                </label>
                <div className="flex gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setSelectedPosition(pos)}
                      className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        selectedPosition === pos
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value as Format)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectedFormat === format.value
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={format.label}
                    >
                      {format.abbr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value Source
                </label>
                <div className="flex gap-2">
                  {VALUE_SOURCE_OPTIONS.map((source) => (
                    <button
                      key={source.value}
                      onClick={() => setValueSource(source.value as ValueSource)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        valueSource === source.value
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Players
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Team
                </label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">All Teams</option>
                    {teams.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <ListSkeleton count={10} />
            ) : error ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error Loading Rankings</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-600">No players found</p>
                <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {filteredPlayers.length} of {players.length} players
                  </p>
                  {players.length > 0 && (
                    <p className="text-sm text-gray-500">
                      Last updated: {new Date(players[0].captured_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Rank
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Player
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Team
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Position
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPlayers.map((player) => (
                        <tr
                          key={`${player.full_name}-${player.position_rank}`}
                          className="hover:bg-blue-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border-2 font-bold ${getRankBadgeColor(
                                player.position_rank
                              )}`}
                            >
                              {player.position_rank}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-900">
                              {player.full_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-600 font-medium">
                              {player.team || 'FA'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {player.position}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(() => {
                                const displayValue = valueSource === 'fdp' ? player.fdp_value : player.ktc_value;
                                return (
                                  <>
                                    <TrendingUp className={`w-4 h-4 ${getValueColor(displayValue)}`} />
                                    <span className={`text-lg font-bold ${getValueColor(displayValue)}`}>
                                      {displayValue.toLocaleString()}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-3">About These Rankings</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
            <div>
              <p className="font-medium text-gray-700 mb-1">Data Source</p>
              <p>Rankings from KeepTradeCut dynasty values</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Update Frequency</p>
              <p>Synced daily via automated cron jobs</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Format Support</p>
              <p>SF (Superflex), 1QB (Standard), TEP (TE Premium)</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Value Types</p>
              <p>KTC (raw) and FDP (format-adjusted)</p>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="font-medium text-gray-700 mb-2">FDP Value Adjustments</p>
            <p className="text-sm text-gray-600 mb-2">
              FantasyDraftPros (FDP) values apply format-specific multipliers to KTC base values:
            </p>
            <div className="grid md:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="bg-gray-50 p-2 rounded">
                <p className="font-semibold text-gray-700">Superflex</p>
                <p>QB: 1.35x | RB: 1.15x | WR: 1.0x | TE: 1.10x</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="font-semibold text-gray-700">1QB</p>
                <p>QB: 1.0x | RB: 1.18x | WR: 1.0x | TE: 1.10x</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="font-semibold text-gray-700">TE Premium</p>
                <p>QB: 1.35x | RB: 1.15x | WR: 1.0x | TE: 1.25x</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
