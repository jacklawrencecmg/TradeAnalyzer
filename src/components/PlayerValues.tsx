import { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Info, DollarSign, Filter, RefreshCw } from 'lucide-react';
import { playerValuesApi, PlayerValue } from '../services/playerValuesApi';
import { useAuth } from '../hooks/useAuth';
import { ListSkeleton } from './LoadingSkeleton';
import { useToast } from './Toast';

interface PlayerValuesProps {
  leagueId: string;
  isSuperflex: boolean;
}

export function PlayerValues({ leagueId, isSuperflex }: PlayerValuesProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [players, setPlayers] = useState<PlayerValue[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [trendFilter, setTrendFilter] = useState<string>('ALL');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlayerValue[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPlayerValues();
  }, []);

  useEffect(() => {
    filterPlayers();
  }, [players, searchTerm, positionFilter, trendFilter, showOnlyDifferences]);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const loadPlayerValues = async () => {
    setLoading(true);
    try {
      const data = await playerValuesApi.getPlayerValues(undefined, 500);
      setPlayers(data);
    } catch (error) {
      console.error('Error loading player values:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncPlayerValues = async () => {
    if (!user) {
      showToast('Please sign in to sync player values', 'error');
      return;
    }

    setSyncing(true);
    try {
      const count = await playerValuesApi.syncPlayerValuesFromSportsData(isSuperflex);
      showToast(`Successfully synced ${count} players from SportsData.io`, 'success');
      await loadPlayerValues();
    } catch (error) {
      console.error('Error syncing player values:', error);
      showToast('Failed to sync player values', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchChange = async (value: string) => {
    setSearchTerm(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      setSearchLoading(true);
      setShowSuggestions(true);

      // Debounce API call by 300ms
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await playerValuesApi.searchPlayers(value.trim(), 10);
          setSuggestions(results);
        } catch (error) {
          console.error('Error searching players:', error);
          setSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
    }
  };

  const selectSuggestion = (player: PlayerValue) => {
    setSearchTerm(player.player_name);
    setShowSuggestions(false);
  };

  const filterPlayers = () => {
    let filtered = players;

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    if (trendFilter !== 'ALL') {
      filtered = filtered.filter(p => p.trend === trendFilter);
    }

    if (showOnlyDifferences) {
      filtered = filtered.filter(p => Math.abs(p.ktc_value - p.fdp_value) > 100);
    }

    setFilteredPlayers(filtered);
  };

  const getValueDifferenceColor = (ktcValue: number, fdpValue: number) => {
    const diff = fdpValue - ktcValue;
    const percentage = ktcValue !== 0 ? (diff / ktcValue) * 100 : 0;

    if (Math.abs(percentage) < 2) return 'text-fdp-text-3';
    if (diff > 0) return 'text-fdp-pos';
    return 'text-fdp-accent-2';
  };

  const getValueDifferenceText = (ktcValue: number, fdpValue: number) => {
    const diff = fdpValue - ktcValue;
    if (Math.abs(diff) < 20) return '≈';
    return diff > 0 ? `+${playerValuesApi.formatValue(diff)}` : playerValuesApi.formatValue(diff);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-fdp-pos" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-fdp-neg" />;
      default:
        return <Minus className="w-4 h-4 text-fdp-text-3" />;
    }
  };

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE'];
  const trends = ['ALL', 'up', 'down', 'stable'];

  if (loading) {
    return (
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-fdp-text-1">Loading Player Values...</h2>
        </div>
        <ListSkeleton count={10} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-fdp-text-1 flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Player Values
            </h2>
            <p className="text-fdp-text-3 text-sm mt-1">
              Powered by SportsData.io with FDP custom adjustments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={syncPlayerValues}
              disabled={syncing || !user}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              title={!user ? 'Sign in to sync player values' : 'Sync player values from SportsData.io'}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Data'}
            </button>
            <span title="FDP Values apply custom adjustments for playoff schedules, recent performance, team situations, and league settings to give you a competitive edge.">
              <Info className="w-5 h-5 text-fdp-text-3 cursor-help" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fdp-text-3 z-10" />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10">
                <div className="animate-spin w-4 h-4 border-2 border-fdp-accent-1 border-t-transparent rounded-full"></div>
              </div>
            )}
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchTerm.trim().length >= 2 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className="w-full pl-10 pr-10 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
            />

            {showSuggestions && (
              <div className="absolute z-50 w-full mt-2 bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                {searchLoading ? (
                  <div className="px-4 py-6 text-center">
                    <div className="animate-spin w-6 h-6 border-2 border-fdp-accent-1 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-fdp-text-3 text-sm">Searching players...</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => selectSuggestion(player)}
                      className="w-full px-4 py-3 text-left hover:bg-fdp-surface-2 transition-colors border-b border-fdp-border-1 last:border-b-0 group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-fdp-text-1 font-medium group-hover:text-fdp-accent-2 transition-colors">
                            {player.player_name}
                          </div>
                          <div className="text-fdp-text-3 text-sm flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2">
                              {player.position}
                            </span>
                            <span>{player.team || 'FA'}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-fdp-accent-2 font-bold text-lg">
                            {playerValuesApi.formatValue(player.fdp_value)}
                          </div>
                          <div className="text-fdp-text-3 text-xs">
                            KTC: {playerValuesApi.formatValue(player.ktc_value)}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getTrendIcon(player.trend)}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <Search className="w-8 h-8 text-fdp-text-3 mx-auto mb-2 opacity-50" />
                    <p className="text-fdp-text-3 text-sm">No players found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
          >
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos === 'ALL' ? 'All Positions' : pos}</option>
            ))}
          </select>

          <select
            value={trendFilter}
            onChange={(e) => setTrendFilter(e.target.value)}
            className="px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
          >
            {trends.map(trend => (
              <option key={trend} value={trend}>
                {trend === 'ALL' ? 'All Trends' : trend.charAt(0).toUpperCase() + trend.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
              showOnlyDifferences
                ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                : 'bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 hover:bg-fdp-border-1'
            }`}
          >
            <Filter className="w-4 h-4" />
            Key Differences
          </button>
        </div>

        {isSuperflex && (
          <div className="mb-4 p-3 bg-fdp-accent-1 bg-opacity-10 border border-fdp-accent-1 rounded-lg">
            <p className="text-fdp-text-1 text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Superflex league detected - QB values are boosted in FDP calculations
            </p>
          </div>
        )}

        <div className="bg-fdp-surface-2 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fdp-surface-1 border-b border-fdp-border-1">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    KTC Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    <span className="text-fdp-accent-2">FDP Value</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fdp-border-1">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-fdp-text-3">
                      No players found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => (
                    <tr
                      key={player.id}
                      className="hover:bg-fdp-surface-1 transition-colors"
                    >
                      <td className="px-4 py-3 text-fdp-text-3 text-sm">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-fdp-text-1">
                          {player.player_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2">
                          {player.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-fdp-text-2 text-sm">
                        {player.team || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getTrendIcon(player.trend)}
                      </td>
                      <td className="px-4 py-3 text-right text-fdp-text-1 font-medium">
                        {playerValuesApi.formatValue(player.ktc_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-fdp-accent-2 font-bold">
                        {playerValuesApi.formatValue(player.fdp_value)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${getValueDifferenceColor(player.ktc_value, player.fdp_value)}`}>
                          {getValueDifferenceText(player.ktc_value, player.fdp_value)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-fdp-text-3 mb-2">Total Players</h3>
            <p className="text-2xl font-bold text-fdp-text-1">{filteredPlayers.length}</p>
          </div>
          <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-fdp-text-3 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-fdp-pos" />
              Rising Value
            </h3>
            <p className="text-2xl font-bold text-fdp-text-1">
              {filteredPlayers.filter(p => p.trend === 'up').length}
            </p>
          </div>
          <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-fdp-text-3 mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-fdp-neg" />
              Falling Value
            </h3>
            <p className="text-2xl font-bold text-fdp-text-1">
              {filteredPlayers.filter(p => p.trend === 'down').length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-fdp-surface-1 to-fdp-surface-2 border border-fdp-accent-1 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-fdp-text-1 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          About FDP Value Adjustments
        </h3>
        <p className="text-sm text-fdp-text-3 mb-3">
          <span className="text-fdp-accent-2 font-medium">Data Source:</span> Player data from SportsData.io API combined with Keep Trade Cut dynasty rankings
        </p>
        <ul className="text-sm text-fdp-text-3 space-y-1">
          <li>• <span className="text-fdp-accent-2 font-medium">Playoff Schedule:</span> Adjusts for strength of schedule in weeks 15-17</li>
          <li>• <span className="text-fdp-accent-2 font-medium">Recent Performance:</span> Weights last 4 weeks more heavily</li>
          <li>• <span className="text-fdp-accent-2 font-medium">Team Situation:</span> Factors in coaching changes and offensive scheme</li>
          <li>• <span className="text-fdp-accent-2 font-medium">Injury Risk:</span> Applies discount for injury-prone players</li>
          <li>• <span className="text-fdp-accent-2 font-medium">League Settings:</span> Superflex leagues see QB value boosts</li>
        </ul>
      </div>
    </div>
  );
}
