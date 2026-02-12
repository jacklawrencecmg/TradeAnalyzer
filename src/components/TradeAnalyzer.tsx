import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Plus, X, Calendar, DollarSign, Settings, AlertTriangle } from 'lucide-react';
import {
  fetchAllPlayers,
  analyzeTrade,
  getPlayerImageUrl,
  type SleeperPlayer,
  type TradeAnalysis,
  type DraftPick,
  type LeagueSettings,
} from '../services/sleeperApi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import Tooltip from './Tooltip';

interface TradeAnalyzerProps {
  leagueId?: string;
  onTradeSaved?: () => void;
}

export default function TradeAnalyzer({ leagueId, onTradeSaved }: TradeAnalyzerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [players, setPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [teamAGives, setTeamAGives] = useState<string[]>([]);
  const [teamAGets, setTeamAGets] = useState<string[]>([]);
  const [teamAGivesPicks, setTeamAGivesPicks] = useState<DraftPick[]>([]);
  const [teamAGetsPicks, setTeamAGetsPicks] = useState<DraftPick[]>([]);
  const [teamAGivesFAAB, setTeamAGivesFAAB] = useState<number>(0);
  const [teamAGetsFAAB, setTeamAGetsFAAB] = useState<number>(0);
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [leagueSettings, setLeagueSettings] = useState<Partial<LeagueSettings>>({
    isSuperflex: false,
    isTEPremium: false,
  });
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [showInactivePlayers, setShowInactivePlayers] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    try {
      const allPlayers = await fetchAllPlayers();
      setPlayers(allPlayers);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  }

  type SearchResult = {
    type: 'player' | 'pick';
    player?: SleeperPlayer;
    pick?: { year: number; round: number; pickNumber?: number; displayName: string };
  };

  function getFilteredResults(searchTerm: string): SearchResult[] {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Check if searching for specific pick number (e.g., "2026 1.01", "2026 1", "1.05")
    const yearPickPattern = /(\d{4})?\s*(\d)[.\s]?(\d{1,2})?/;
    const match = term.match(yearPickPattern);

    const currentYear = new Date().getFullYear();
    const pickKeywords = ['pick', '1st', '2nd', '3rd', '4th', 'first', 'second', 'third', 'fourth', 'round'];
    const isPickSearch = pickKeywords.some(keyword => term.includes(keyword)) || match;

    // Add draft picks if searching for picks
    if (isPickSearch && match) {
      const searchYear = match[1] ? parseInt(match[1]) : null;
      const searchRound = match[2] ? parseInt(match[2]) : null;
      const searchPick = match[3] ? parseInt(match[3]) : null;

      const yearsToSearch = searchYear ? [searchYear] : [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
      const maxRounds = leagueSettings.draftRounds || 5;
      const roundsToSearch = searchRound ? [searchRound] : Array.from({ length: maxRounds }, (_, i) => i + 1);

      for (const year of yearsToSearch) {
        for (const round of roundsToSearch) {
          if (round < 1 || round > maxRounds) continue;

          const numTeams = leagueSettings.numTeams || 12;
          // If specific pick number is provided, show only that pick
          if (searchPick !== null && searchPick >= 1 && searchPick <= numTeams) {
            const pickNum = searchPick;
            const displayName = `${year} Pick ${round}.${pickNum.toString().padStart(2, '0')}`;
            results.push({
              type: 'pick',
              pick: { year, round, pickNumber: pickNum, displayName }
            });
          } else {
            // Show all picks for that round
            for (let pickNum = 1; pickNum <= numTeams; pickNum++) {
              const displayName = `${year} Pick ${round}.${pickNum.toString().padStart(2, '0')}`;
              const searchableText = `${year} ${round}.${pickNum.toString().padStart(2, '0')} pick`.toLowerCase();

              if (searchableText.includes(term) || term.includes(`${year} ${round}`) || term === `${round}`) {
                results.push({
                  type: 'pick',
                  pick: { year, round, pickNumber: pickNum, displayName }
                });
              }
            }
          }
        }
      }
    } else if (isPickSearch) {
      // General pick search without specific numbers
      const maxRounds = leagueSettings.draftRounds || 5;
      const numTeams = leagueSettings.numTeams || 12;
      for (let year = currentYear; year <= currentYear + 4; year++) {
        for (let round = 1; round <= maxRounds; round++) {
          for (let pickNum = 1; pickNum <= numTeams; pickNum++) {
            const displayName = `${year} Pick ${round}.${pickNum.toString().padStart(2, '0')}`;
            const searchableText = `${year} ${getOrdinal(round)} round pick ${round}.${pickNum.toString().padStart(2, '0')}`.toLowerCase();

            if (searchableText.includes(term)) {
              results.push({
                type: 'pick',
                pick: { year, round, pickNumber: pickNum, displayName }
              });
            }
          }
        }
      }
    }

    // Add players (only if not a clear pick search)
    if (!match || results.length < 5) {
      const filteredPlayers = Object.values(players)
        .filter(
          (player) =>
            player.full_name?.toLowerCase().includes(term) &&
            player.position &&
            ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(player.position) &&
            (showInactivePlayers || (player.status !== 'Retired' && player.status !== 'Inactive'))
        )
        .sort((a, b) => {
          const aName = a.full_name?.toLowerCase() || '';
          const bName = b.full_name?.toLowerCase() || '';
          const aStartsWith = aName.startsWith(term);
          const bStartsWith = bName.startsWith(term);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return aName.localeCompare(bName);
        })
        .slice(0, 8);

      results.push(...filteredPlayers.map(player => ({ type: 'player' as const, player })));
    }

    return results.slice(0, 12);
  }

  function addPlayer(playerId: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    if (team === 'A' && type === 'gives') {
      if (!teamAGives.includes(playerId)) {
        setTeamAGives([...teamAGives, playerId]);
      }
    } else if (team === 'A' && type === 'gets') {
      if (!teamAGets.includes(playerId)) {
        setTeamAGets([...teamAGets, playerId]);
      }
    }
    setSearchTermA('');
    setSearchTermB('');
  }

  function addPickFromSearch(year: number, round: number, pickNumber: number | undefined, displayName: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    const pick: DraftPick = {
      id: `${year}-${round}-${pickNumber || 0}-${Date.now()}`,
      year,
      round,
      displayName,
    };

    if (team === 'A' && type === 'gives') {
      setTeamAGivesPicks([...teamAGivesPicks, pick]);
    } else if (team === 'A' && type === 'gets') {
      setTeamAGetsPicks([...teamAGetsPicks, pick]);
    }

    setSearchTermA('');
    setSearchTermB('');
  }

  function removePlayer(playerId: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    if (team === 'A' && type === 'gives') {
      setTeamAGives(teamAGives.filter((id) => id !== playerId));
    } else if (team === 'A' && type === 'gets') {
      setTeamAGets(teamAGets.filter((id) => id !== playerId));
    }
  }

  function removeDraftPick(pickId: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    if (team === 'A' && type === 'gives') {
      setTeamAGivesPicks(teamAGivesPicks.filter((p) => p.id !== pickId));
    } else if (team === 'A' && type === 'gets') {
      setTeamAGetsPicks(teamAGetsPicks.filter((p) => p.id !== pickId));
    }
  }

  function getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getInjuryStatusBadge(player: SleeperPlayer) {
    const status = player.injury_status || (player as any).status;

    if (!status) return null;

    const statusConfig: Record<string, { label: string; className: string }> = {
      'Out': { label: 'OUT', className: 'bg-red-600 text-white' },
      'Doubtful': { label: 'D', className: 'bg-red-500 text-white' },
      'Questionable': { label: 'Q', className: 'bg-yellow-500 text-white' },
      'IR': { label: 'IR', className: 'bg-red-700 text-white' },
      'PUP': { label: 'PUP', className: 'bg-red-600 text-white' },
      'COV': { label: 'COV', className: 'bg-red-600 text-white' },
      'Inactive': { label: 'INACTIVE', className: 'bg-gray-600 text-white' },
      'Retired': { label: 'RETIRED', className: 'bg-gray-700 text-white' },
    };

    const config = statusConfig[status];
    if (!config) return null;

    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.className}`}>
        {config.label}
      </span>
    );
  }

  function isPlayerInactive(player: SleeperPlayer): boolean {
    const status = player.injury_status || (player as any).status;
    return ['Inactive', 'Retired', 'IR', 'Out', 'PUP', 'COV'].includes(status || '');
  }

  function checkForInactivePlayers() {
    const allPlayerIds = [...teamAGives, ...teamAGets];
    const hasInactive = allPlayerIds.some(id => {
      const player = players[id];
      return player && isPlayerInactive(player);
    });
    setShowInactiveWarning(hasInactive);
  }

  useEffect(() => {
    checkForInactivePlayers();
  }, [teamAGives, teamAGets, players]);

  async function handleAnalyzeTrade() {
    if (
      teamAGives.length === 0 &&
      teamAGivesPicks.length === 0 &&
      teamAGivesFAAB === 0 &&
      teamAGets.length === 0 &&
      teamAGetsPicks.length === 0 &&
      teamAGetsFAAB === 0
    ) {
      alert('Please add players, picks, or FAAB to both sides of the trade');
      return;
    }

    if (
      (teamAGives.length === 0 && teamAGivesPicks.length === 0 && teamAGivesFAAB === 0) ||
      (teamAGets.length === 0 && teamAGetsPicks.length === 0 && teamAGetsFAAB === 0)
    ) {
      alert('Please add items to both sides of the trade');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeTrade(
        leagueId,
        teamAGives,
        teamAGets,
        teamAGivesPicks,
        teamAGetsPicks,
        teamAGivesFAAB,
        teamAGetsFAAB,
        !leagueId ? leagueSettings : undefined
      );
      setAnalysis(result);

      if (user) {
        await saveTrade(result);
      }
      showToast('Trade analyzed successfully!', 'success');
    } catch (error) {
      console.error('Failed to analyze trade:', error);
      showToast('Failed to analyze trade. Please try again.', 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveTrade(result: TradeAnalysis) {
    if (!user) return;

    try {
      const { error } = await supabase.from('saved_trades').insert({
        user_id: user.id,
        league_id: leagueId,
        trade_data: {
          team_a_gives: teamAGives,
          team_a_gets: teamAGets,
          team_a_gives_picks: teamAGivesPicks,
          team_a_gets_picks: teamAGetsPicks,
          team_a_gives_faab: teamAGivesFAAB,
          team_a_gets_faab: teamAGetsFAAB,
        },
        trade_result: {
          team_a_value: result.teamAValue,
          team_b_value: result.teamBValue,
          difference: result.difference,
          winner: result.winner,
          fairness: result.fairness,
          team_a_items: result.teamAItems,
          team_b_items: result.teamBItems,
        },
      });

      if (error) throw error;

      if (onTradeSaved) onTradeSaved();
      showToast('Trade saved to history', 'info');
    } catch (error) {
      console.error('Failed to save trade:', error);
      showToast('Failed to save trade to history', 'error');
    }
  }

  function clearTrade() {
    setTeamAGives([]);
    setTeamAGets([]);
    setTeamAGivesPicks([]);
    setTeamAGetsPicks([]);
    setTeamAGivesFAAB(0);
    setTeamAGetsFAAB(0);
    setAnalysis(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#00d4ff]" />
            Trade Analyzer
          </h2>
          {(teamAGives.length > 0 ||
            teamAGets.length > 0 ||
            teamAGivesPicks.length > 0 ||
            teamAGetsPicks.length > 0 ||
            teamAGivesFAAB > 0 ||
            teamAGetsFAAB > 0) && (
            <button
              onClick={clearTrade}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Trade
            </button>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-[#00d4ff]" />
            <h3 className="text-lg font-semibold text-white">{leagueId ? 'Search Settings' : 'League & Search Settings'}</h3>
          </div>
          {!leagueId && (
            <div className="flex flex-wrap gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leagueSettings.isSuperflex}
                  onChange={(e) =>
                    setLeagueSettings({ ...leagueSettings, isSuperflex: e.target.checked })
                  }
                  className="w-4 h-4 text-[#00d4ff] bg-gray-700 border-gray-600 rounded focus:ring-[#00d4ff] focus:ring-2"
                />
                <span className="text-gray-300">Superflex League</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leagueSettings.isTEPremium}
                  onChange={(e) =>
                    setLeagueSettings({ ...leagueSettings, isTEPremium: e.target.checked })
                  }
                  className="w-4 h-4 text-[#00d4ff] bg-gray-700 border-gray-600 rounded focus:ring-[#00d4ff] focus:ring-2"
                />
                <span className="text-gray-300">TE Premium</span>
              </label>
            </div>
          )}
          <div className={!leagueId ? 'border-t border-gray-700 pt-3' : ''}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactivePlayers}
                onChange={(e) => setShowInactivePlayers(e.target.checked)}
                className="w-4 h-4 text-[#00d4ff] bg-gray-700 border-gray-600 rounded focus:ring-[#00d4ff] focus:ring-2"
              />
              <span className="text-gray-300">Show Retired/Inactive Players</span>
            </label>
            <p className="text-sm text-gray-400 mt-2">
              {!leagueId && 'League settings adjust player values. '}By default, retired and inactive players are hidden from search results to prevent trading for players who aren't playing.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Team A Gives
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTermA}
                  onChange={(e) => setSearchTermA(e.target.value)}
                  placeholder="Search players or draft picks..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>
              {searchTermA.length >= 2 && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                  {getFilteredResults(searchTermA).map((result, idx) => (
                    result.type === 'player' && result.player ? (
                      <button
                        key={result.player.player_id}
                        onClick={() => addPlayer(result.player!.player_id, 'A', 'gives')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                      >
                        <img
                          src={getPlayerImageUrl(result.player.player_id)}
                          alt={result.player.full_name}
                          className="w-12 h-12 rounded-full object-cover bg-gray-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{result.player.full_name}</span>
                            {getInjuryStatusBadge(result.player)}
                          </div>
                          <div className="text-sm text-gray-400">
                            {result.player.position} - {result.player.team || 'FA'}
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                      </button>
                    ) : result.type === 'pick' && result.pick ? (
                      <button
                        key={`pick-${result.pick.year}-${result.pick.round}-${result.pick.pickNumber}-${idx}`}
                        onClick={() => addPickFromSearch(result.pick!.year, result.pick!.round, result.pick!.pickNumber, result.pick!.displayName, 'A', 'gives')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#00d4ff]" />
                          <div>
                            <div className="text-white font-medium">{result.pick.displayName}</div>
                            <div className="text-sm text-gray-400">Draft Pick</div>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                      </button>
                    ) : null
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGives.map((playerId) => {
                  const player = players[playerId];
                  const inactive = isPlayerInactive(player);
                  return (
                    <div
                      key={playerId}
                      className={`flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg border ${
                        inactive ? 'border-red-500 bg-red-950 bg-opacity-20' : 'border-gray-700'
                      }`}
                    >
                      <img
                        src={getPlayerImageUrl(playerId)}
                        alt={player.full_name}
                        className="w-12 h-12 rounded-full object-cover bg-gray-700"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{player.full_name}</span>
                          {getInjuryStatusBadge(player)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {player.position} - {player.team || 'FA'}
                        </div>
                      </div>
                      <button
                        onClick={() => removePlayer(playerId, 'A', 'gives')}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
                {teamAGivesPicks.map((pick) => (
                  <div
                    key={pick.id}
                    className="flex items-center justify-between bg-gray-800 px-4 py-3 rounded-lg border border-[#00d4ff]"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#00d4ff]" />
                      <div className="text-white font-medium">{pick.displayName}</div>
                    </div>
                    <button
                      onClick={() => removeDraftPick(pick.id, 'A', 'gives')}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    FAAB Money
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={teamAGivesFAAB || ''}
                      onChange={(e) => setTeamAGivesFAAB(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                    />
                  </div>
                  {teamAGivesFAAB > 0 && (
                    <div className="mt-2 text-sm text-gray-400">
                      Value: {(teamAGivesFAAB * 5).toLocaleString()} points
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Team A Gets
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTermB}
                  onChange={(e) => setSearchTermB(e.target.value)}
                  placeholder="Search players or draft picks..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>
              {searchTermB.length >= 2 && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                  {getFilteredResults(searchTermB).map((result, idx) => (
                    result.type === 'player' && result.player ? (
                      <button
                        key={result.player.player_id}
                        onClick={() => addPlayer(result.player!.player_id, 'A', 'gets')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                      >
                        <img
                          src={getPlayerImageUrl(result.player.player_id)}
                          alt={result.player.full_name}
                          className="w-12 h-12 rounded-full object-cover bg-gray-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{result.player.full_name}</span>
                            {getInjuryStatusBadge(result.player)}
                          </div>
                          <div className="text-sm text-gray-400">
                            {result.player.position} - {result.player.team || 'FA'}
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                      </button>
                    ) : result.type === 'pick' && result.pick ? (
                      <button
                        key={`pick-${result.pick.year}-${result.pick.round}-${result.pick.pickNumber}-${idx}`}
                        onClick={() => addPickFromSearch(result.pick!.year, result.pick!.round, result.pick!.pickNumber, result.pick!.displayName, 'A', 'gets')}
                        className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#00d4ff]" />
                          <div>
                            <div className="text-white font-medium">{result.pick.displayName}</div>
                            <div className="text-sm text-gray-400">Draft Pick</div>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                      </button>
                    ) : null
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGets.map((playerId) => {
                  const player = players[playerId];
                  const inactive = isPlayerInactive(player);
                  return (
                    <div
                      key={playerId}
                      className={`flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg border ${
                        inactive ? 'border-red-500 bg-red-950 bg-opacity-20' : 'border-gray-700'
                      }`}
                    >
                      <img
                        src={getPlayerImageUrl(playerId)}
                        alt={player.full_name}
                        className="w-12 h-12 rounded-full object-cover bg-gray-700"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{player.full_name}</span>
                          {getInjuryStatusBadge(player)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {player.position} - {player.team || 'FA'}
                        </div>
                      </div>
                      <button
                        onClick={() => removePlayer(playerId, 'A', 'gets')}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
                {teamAGetsPicks.map((pick) => (
                  <div
                    key={pick.id}
                    className="flex items-center justify-between bg-gray-800 px-4 py-3 rounded-lg border border-[#00d4ff]"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#00d4ff]" />
                      <div className="text-white font-medium">{pick.displayName}</div>
                    </div>
                    <button
                      onClick={() => removeDraftPick(pick.id, 'A', 'gets')}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    FAAB Money
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={teamAGetsFAAB || ''}
                      onChange={(e) => setTeamAGetsFAAB(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                    />
                  </div>
                  {teamAGetsFAAB > 0 && (
                    <div className="mt-2 text-sm text-gray-400">
                      Value: {(teamAGetsFAAB * 5).toLocaleString()} points
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showInactiveWarning && (
          <div className="mt-4 bg-yellow-900 bg-opacity-30 border border-yellow-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-yellow-400 font-semibold mb-1">Inactive Players Detected</h4>
                <p className="text-sm text-gray-300">
                  This trade includes players who are injured, on IR, or inactive. Their values have been adjusted, but verify their status before accepting the trade.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleAnalyzeTrade}
            disabled={
              analyzing ||
              (teamAGives.length === 0 && teamAGivesPicks.length === 0 && teamAGivesFAAB === 0) ||
              (teamAGets.length === 0 && teamAGetsPicks.length === 0 && teamAGetsFAAB === 0)
            }
            className="w-full bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Trade'}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl animate-in fade-in duration-300">
          <h3 className="text-xl font-bold text-white mb-4">Trade Analysis Results</h3>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-3">Team A Gives</h4>
              <div className="space-y-2">
                {analysis.teamAItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {item.type === 'player' && (
                        <img
                          src={getPlayerImageUrl(item.id)}
                          alt={item.name}
                          className="w-8 h-8 rounded-full object-cover bg-gray-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      {item.type === 'pick' && (
                        <Calendar className="w-3 h-3 text-[#00d4ff]" />
                      )}
                      {item.type === 'faab' && (
                        <DollarSign className="w-3 h-3 text-green-400" />
                      )}
                      <span className="text-gray-300">
                        {item.name}
                        {item.position && (
                          <span className="text-gray-500 ml-1">({item.position})</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-600 flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-[#00d4ff]">{analysis.teamAValue}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-3">Team A Gets</h4>
              <div className="space-y-2">
                {analysis.teamBItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {item.type === 'player' && (
                        <img
                          src={getPlayerImageUrl(item.id)}
                          alt={item.name}
                          className="w-8 h-8 rounded-full object-cover bg-gray-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      {item.type === 'pick' && (
                        <Calendar className="w-3 h-3 text-[#00d4ff]" />
                      )}
                      {item.type === 'faab' && (
                        <DollarSign className="w-3 h-3 text-green-400" />
                      )}
                      <span className="text-gray-300">
                        {item.name}
                        {item.position && (
                          <span className="text-gray-500 ml-1">({item.position})</span>
                        )}
                      </span>
                    </div>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-600 flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-[#00d4ff]">{analysis.teamBValue}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Team A Value</div>
              <div className="text-2xl font-bold text-white">{analysis.teamAValue}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Team B Value</div>
              <div className="text-2xl font-bold text-white">{analysis.teamBValue}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Difference</div>
              <div className="text-2xl font-bold text-[#00d4ff]">{analysis.difference}</div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-center gap-3 mb-4">
              {analysis.winner === 'Fair' ? (
                <Minus className="w-8 h-8 text-yellow-400" />
              ) : analysis.winner === 'A' ? (
                <TrendingUp className="w-8 h-8 text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {analysis.winner === 'Fair'
                    ? 'Fair Trade'
                    : `Team ${analysis.winner} Wins`}
                </div>
                <div className="text-sm text-gray-400 mt-1">{analysis.fairness}</div>
              </div>
            </div>

            {analysis.winner !== 'Fair' && (
              <p className="text-center text-gray-300 text-sm">
                Team {analysis.winner} receives approximately {analysis.difference} more value in
                this trade.
              </p>
            )}
          </div>

          {user && (
            <div className="mt-4 text-center text-sm text-gray-400">
              This trade has been saved to your history
            </div>
          )}
        </div>
      )}
    </div>
  );
}
