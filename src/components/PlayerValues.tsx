import { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Info, DollarSign, Filter, RefreshCw, Calendar, AlertCircle, Award, BarChart3, Star } from 'lucide-react';
import { playerValuesApi, PlayerValue, PlayerValueChange, DynastyDraftPick } from '../services/playerValuesApi';
import { useAuth } from '../hooks/useAuth';
import { ListSkeleton } from './LoadingSkeleton';
import { useToast } from './Toast';

interface PlayerValuesProps {
  leagueId: string;
  isSuperflex: boolean;
}

type ViewMode = 'players' | 'picks' | 'movers' | 'rookies';

export function PlayerValues({ leagueId, isSuperflex }: PlayerValuesProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [players, setPlayers] = useState<PlayerValue[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerValue[]>([]);
  const [valueChanges, setValueChanges] = useState<Map<string, PlayerValueChange>>(new Map());
  const [draftPicks, setDraftPicks] = useState<DynastyDraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [trendFilter, setTrendFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [injuryFilter, setInjuryFilter] = useState<string>('ALL');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PlayerValue[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('players');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [movers, setMovers] = useState<{risers: PlayerValue[], fallers: PlayerValue[]}>({risers: [], fallers: []});
  const [moversPeriod, setMoversPeriod] = useState<'7d' | '30d' | 'season'>('7d');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPlayerValues();
    loadDraftPicks();
  }, []);

  useEffect(() => {
    filterPlayers();
  }, [players, searchTerm, positionFilter, trendFilter, tierFilter, injuryFilter, showOnlyDifferences]);

  useEffect(() => {
    if (viewMode === 'movers') {
      loadMovers();
    } else if (viewMode === 'picks') {
      loadDraftPicks();
    }
  }, [viewMode, moversPeriod, selectedYear]);

  useEffect(() => {
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

      const playerIds = data.map(p => p.player_id);
      const changes = await playerValuesApi.getPlayerValueChanges(playerIds);
      const changesMap = new Map(changes.map(c => [c.player_id, c]));
      setValueChanges(changesMap);
    } catch (error) {
      console.error('Error loading player values:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDraftPicks = async () => {
    try {
      const picks = await playerValuesApi.getDynastyDraftPicks(selectedYear);
      setDraftPicks(picks);
    } catch (error) {
      console.error('Error loading draft picks:', error);
    }
  };

  const loadMovers = async () => {
    try {
      const data = await playerValuesApi.getBiggestMovers(moversPeriod, 10);
      setMovers(data);
    } catch (error) {
      console.error('Error loading movers:', error);
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

    if (tierFilter !== 'ALL') {
      filtered = filtered.filter(p => p.tier === tierFilter);
    }

    if (injuryFilter !== 'ALL') {
      filtered = filtered.filter(p => p.injury_status === injuryFilter);
    }

    if (showOnlyDifferences) {
      filtered = filtered.filter(p => Math.abs(p.ktc_value - p.fdp_value) > 100);
    }

    if (viewMode === 'rookies') {
      const currentYear = new Date().getFullYear();
      filtered = filtered.filter(p => p.draft_year === currentYear);
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

  const getValueChangeDisplay = (playerId: string, period: '7d' | '30d' | 'season') => {
    const change = valueChanges.get(playerId);
    if (!change) return null;

    const value = period === '7d' ? change.change_7d : period === '30d' ? change.change_30d : change.change_season;
    const percent = period === '7d' ? change.percent_7d : period === '30d' ? change.percent_30d : change.percent_season;

    if (value === 0) return <span className="text-fdp-text-3 text-xs">-</span>;

    const color = value > 0 ? 'text-fdp-pos' : 'text-fdp-neg';
    return (
      <span className={`text-xs font-medium ${color}`}>
        {value > 0 ? '+' : ''}{playerValuesApi.formatValue(value)} ({percent > 0 ? '+' : ''}{percent.toFixed(1)}%)
      </span>
    );
  };

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE'];
  const trends = ['ALL', 'up', 'down', 'stable'];
  const tiers = ['ALL', 'elite', 'tier1', 'tier2', 'tier3', 'flex', 'depth'];
  const injuryStatuses = ['ALL', 'healthy', 'questionable', 'doubtful', 'out', 'ir'];

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
              Dynasty rankings powered by Keep Trade Cut with FDP enhancements
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={syncPlayerValues}
              disabled={syncing || !user}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              title={!user ? 'Sign in to sync player values' : 'Sync player values from Keep Trade Cut'}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync KTC Data'}
            </button>
            <span title="FDP Values apply custom adjustments for playoff schedules, recent performance, team situations, and league settings to give you a competitive edge.">
              <Info className="w-5 h-5 text-fdp-text-3 cursor-help" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-fdp-border-1">
          <button
            onClick={() => setViewMode('players')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              viewMode === 'players'
                ? 'border-fdp-accent-2 text-fdp-accent-2'
                : 'border-transparent text-fdp-text-3 hover:text-fdp-text-1'
            }`}
          >
            <Star className="w-4 h-4" />
            All Players
          </button>
          <button
            onClick={() => setViewMode('movers')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              viewMode === 'movers'
                ? 'border-fdp-accent-2 text-fdp-accent-2'
                : 'border-transparent text-fdp-text-3 hover:text-fdp-text-1'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Biggest Movers
          </button>
          <button
            onClick={() => setViewMode('picks')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              viewMode === 'picks'
                ? 'border-fdp-accent-2 text-fdp-accent-2'
                : 'border-transparent text-fdp-text-3 hover:text-fdp-text-1'
            }`}
          >
            <Award className="w-4 h-4" />
            Draft Picks
          </button>
          <button
            onClick={() => setViewMode('rookies')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              viewMode === 'rookies'
                ? 'border-fdp-accent-2 text-fdp-accent-2'
                : 'border-transparent text-fdp-text-3 hover:text-fdp-text-1'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Rookies
          </button>
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

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
          >
            {tiers.map(tier => (
              <option key={tier} value={tier}>
                {tier === 'ALL' ? 'All Tiers' : tier.charAt(0).toUpperCase() + tier.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <select
            value={injuryFilter}
            onChange={(e) => setInjuryFilter(e.target.value)}
            className="px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
          >
            {injuryStatuses.map(status => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Injury Status' : status.charAt(0).toUpperCase() + status.slice(1)}
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

{viewMode === 'picks' ? (
          <div className="bg-fdp-surface-2 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-fdp-text-1">Dynasty Draft Pick Values</h3>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-fdp-surface-1 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(round => (
                <div key={round} className="space-y-3">
                  <h4 className="font-semibold text-fdp-text-1 border-b border-fdp-border-1 pb-2">Round {round}</h4>
                  {draftPicks.filter(p => p.round === round).map((pick) => (
                    <div key={pick.id} className="flex items-center justify-between p-3 bg-fdp-surface-1 rounded-lg border border-fdp-border-1 hover:border-fdp-accent-1 transition-colors">
                      <span className="text-fdp-text-2 font-medium">{pick.display_name}</span>
                      <span className="text-fdp-accent-2 font-bold">{playerValuesApi.formatValue(pick.value)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'movers' ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-fdp-text-3 text-sm">Period:</span>
              {(['7d', '30d', 'season'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setMoversPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    moversPeriod === period
                      ? 'bg-fdp-accent-2 text-fdp-bg-0'
                      : 'bg-fdp-surface-2 text-fdp-text-2 hover:bg-fdp-border-1'
                  }`}
                >
                  {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'Season'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-fdp-surface-2 rounded-lg p-6">
                <h3 className="text-lg font-bold text-fdp-pos mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Biggest Risers
                </h3>
                <div className="space-y-3">
                  {movers.risers.length === 0 ? (
                    <p className="text-fdp-text-3 text-sm text-center py-4">No data available yet</p>
                  ) : (
                    movers.risers.map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
                        <div className="flex items-center gap-3">
                          <span className="text-fdp-text-3 font-bold">#{index + 1}</span>
                          <div>
                            <div className="text-fdp-text-1 font-medium">{player.player_name}</div>
                            <div className="text-fdp-text-3 text-xs">{player.position} - {player.team}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-fdp-accent-2 font-bold">{playerValuesApi.formatValue(player.fdp_value)}</div>
                          {getValueChangeDisplay(player.player_id, moversPeriod)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-fdp-surface-2 rounded-lg p-6">
                <h3 className="text-lg font-bold text-fdp-neg mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  Biggest Fallers
                </h3>
                <div className="space-y-3">
                  {movers.fallers.length === 0 ? (
                    <p className="text-fdp-text-3 text-sm text-center py-4">No data available yet</p>
                  ) : (
                    movers.fallers.map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
                        <div className="flex items-center gap-3">
                          <span className="text-fdp-text-3 font-bold">#{index + 1}</span>
                          <div>
                            <div className="text-fdp-text-1 font-medium">{player.player_name}</div>
                            <div className="text-fdp-text-3 text-xs">{player.position} - {player.team}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-fdp-accent-2 font-bold">{playerValuesApi.formatValue(player.fdp_value)}</div>
                          {getValueChangeDisplay(player.player_id, moversPeriod)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-fdp-surface-2 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-fdp-surface-1 border-b border-fdp-border-1">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">Player</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">Details</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">7d Change</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-fdp-text-3 uppercase tracking-wider">KTC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-fdp-text-3 uppercase tracking-wider"><span className="text-fdp-accent-2">FDP</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fdp-border-1">
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-fdp-text-3">No players found</td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player, index) => (
                      <tr key={player.id} className="hover:bg-fdp-surface-1 transition-colors">
                        <td className="px-4 py-3 text-fdp-text-3 text-sm">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-fdp-text-1">{player.player_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2">
                              {player.position}
                            </span>
                            <span className="text-fdp-text-3 text-xs">{player.team || 'FA'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            {player.age && <span className="text-fdp-text-3 text-xs">Age: {player.age}</span>}
                            {player.injury_status && player.injury_status !== 'healthy' && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${playerValuesApi.getInjuryBadgeColor(player.injury_status)}`}>
                                <AlertCircle className="w-3 h-3" />
                                {player.injury_status.toUpperCase()}
                              </span>
                            )}
                            {player.tier && (
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border ${playerValuesApi.getTierBadgeColor(player.tier)}`}>
                                {player.tier.charAt(0).toUpperCase() + player.tier.slice(1)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{getValueChangeDisplay(player.player_id, '7d')}</td>
                        <td className="px-4 py-3 text-right text-fdp-text-1 font-medium">{playerValuesApi.formatValue(player.ktc_value)}</td>
                        <td className="px-4 py-3 text-right text-fdp-accent-2 font-bold">{playerValuesApi.formatValue(player.fdp_value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
