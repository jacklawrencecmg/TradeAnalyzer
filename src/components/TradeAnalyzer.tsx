import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Plus, X, Calendar, DollarSign, Settings, Info } from 'lucide-react';
import {
  fetchAllPlayers,
  analyzeTrade,
  getPlayerImageUrl,
  fetchLeagueRosters,
  fetchLeagueUsers,
  fetchTradedPicks,
  type SleeperPlayer,
  type SleeperRoster,
  type SleeperUser,
  type TradeAnalysis,
  type DraftPick,
  type LeagueSettings,
} from '../services/sleeperApi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import Tooltip from './Tooltip';
import { playerValuesApi } from '../services/playerValuesApi';
import { PlayerAvatar } from './PlayerAvatar';
import { StatSparkline } from './StatSparkline';
import { AchievementBadge } from './AchievementBadge';
import { TradeGrade, calculateTradeGrade } from './TradeGrade';
import { syncPlayerValuesToDatabase } from '../utils/syncPlayerValues';
import { getCurrentPhaseInfo, getPhaseEmoji } from '../lib/picks/seasonPhase';
import { getMultiplierPercentage } from '../lib/picks/phaseMultipliers';

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
  const [rosters, setRosters] = useState<SleeperRoster[]>([]);
  const [users, setUsers] = useState<SleeperUser[]>([]);
  const [tradedPicks, setTradedPicks] = useState<any[]>([]);
  const [teamAName, setTeamAName] = useState('Your Team');
  const [teamBName, setTeamBName] = useState('Their Team');
  const [selectedTeamA, setSelectedTeamA] = useState<string>('');
  const [selectedTeamB, setSelectedTeamB] = useState<string>('');
  const [assetTypeA, setAssetTypeA] = useState<'players' | 'picks' | 'faab'>('players');
  const [assetTypeB, setAssetTypeB] = useState<'players' | 'picks' | 'faab'>('players');
  const [tradeDirectionA, setTradeDirectionA] = useState<'gives' | 'gets'>('gives');
  const [tradeDirectionB, setTradeDirectionB] = useState<'gives' | 'gets'>('gets');
  const [enhancedPlayerData, setEnhancedPlayerData] = useState<Record<string, any>>({});
  const [leagueFormat, setLeagueFormat] = useState<'dynasty' | 'redraft'>('dynasty');
  const [scoringFormat, setScoringFormat] = useState<'ppr' | 'half' | 'standard'>('ppr');
  const [syncingValues, setSyncingValues] = useState(false);

  useEffect(() => {
    loadPlayers();
    checkAndSyncPlayerValues();
  }, []);

  useEffect(() => {
    if (leagueId) {
      loadLeagueData();
    }
  }, [leagueId]);

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

  async function checkAndSyncPlayerValues() {
    try {
      const { count, error } = await supabase
        .from('player_values')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      if (!count || count === 0) {
        console.log('No player values found in database, syncing from FDP API...');
        setSyncingValues(true);
        showToast('Initializing player values...', 'info');

        const synced = await syncPlayerValuesToDatabase(leagueSettings.isSuperflex);

        if (synced > 0) {
          showToast(`Successfully loaded ${synced} player values!`, 'success');
        } else {
          showToast('Failed to load player values, using fallback values', 'warning');
        }
        setSyncingValues(false);
      }
    } catch (error) {
      console.error('Error checking player values:', error);
      setSyncingValues(false);
    }
  }

  async function loadLeagueData() {
    if (!leagueId) return;

    try {
      const [rostersData, usersData, tradedPicksData] = await Promise.all([
        fetchLeagueRosters(leagueId),
        fetchLeagueUsers(leagueId),
        fetchTradedPicks(leagueId).catch(() => [])
      ]);

      setRosters(rostersData);
      setUsers(usersData);
      setTradedPicks(tradedPicksData);
    } catch (error) {
      console.error('Failed to load league data:', error);
      showToast('Failed to load league data', 'error');
    }
  }

  function getTeamName(rosterId: string): string {
    const roster = rosters.find(r => r.roster_id.toString() === rosterId);
    if (!roster) return 'Unknown Team';

    const user = users.find(u => u.user_id === roster.owner_id);
    if (!user) return 'Unknown Team';

    return user.metadata?.team_name || user.display_name || user.username;
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
            player.status !== 'Retired' && player.status !== 'Inactive'
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

  async function fetchEnhancedPlayerData(playerId: string, playerName: string) {
    if (enhancedPlayerData[playerId]) return;

    try {
      const details = await playerValuesApi.getPlayerDetailsFromSportsData(playerName);
      if (details) {
        setEnhancedPlayerData(prev => ({
          ...prev,
          [playerId]: details
        }));
      }
    } catch (error) {
      console.error('Failed to fetch enhanced player data:', error);
    }
  }

  function addPlayer(playerId: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    if (team === 'A' && type === 'gives') {
      if (teamAGives.includes(playerId)) {
        setTeamAGives(teamAGives.filter(id => id !== playerId));
      } else {
        setTeamAGives([...teamAGives, playerId]);
        const player = players[playerId];
        if (player) fetchEnhancedPlayerData(playerId, player.full_name);
      }
    } else if (team === 'A' && type === 'gets') {
      if (teamAGets.includes(playerId)) {
        setTeamAGets(teamAGets.filter(id => id !== playerId));
      } else {
        setTeamAGets([...teamAGets, playerId]);
        const player = players[playerId];
        if (player) fetchEnhancedPlayerData(playerId, player.full_name);
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
      pickNumber: pickNumber,
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
        !leagueId ? leagueSettings : undefined,
        leagueFormat,
        scoringFormat
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
          team_a_name: teamAName,
          team_b_name: teamBName,
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

  function getRosterPlayers(rosterId: string): string[] {
    const roster = rosters.find(r => r.roster_id.toString() === rosterId);
    return roster?.players || [];
  }

  function getRosterPicks(rosterId: string): DraftPick[] {
    const roster = rosters.find(r => r.roster_id.toString() === rosterId);
    if (!roster) return [];

    const picks: DraftPick[] = [];
    const pickKeys = new Set<string>();

    if (roster.draft_picks) {
      roster.draft_picks.forEach((pick, index) => {
        const key = `${pick.season}-${pick.round}`;
        if (!pickKeys.has(key)) {
          pickKeys.add(key);
          picks.push({
            id: `${pick.season}-${pick.round}-${roster.roster_id}-${index}`,
            year: pick.season,
            round: pick.round,
            displayName: `${pick.season} Round ${pick.round} Pick`,
            pickNumber: undefined,
          });
        }
      });
    }

    tradedPicks.forEach((pick: any) => {
      if (pick.owner_id === roster.roster_id || pick.roster_id === roster.roster_id) {
        const key = `${pick.season}-${pick.round}`;
        if (!pickKeys.has(key)) {
          pickKeys.add(key);
          picks.push({
            id: `${pick.season}-${pick.round}-${roster.roster_id}-traded`,
            year: pick.season,
            round: pick.round,
            displayName: `${pick.season} Round ${pick.round} Pick`,
            pickNumber: undefined,
          });
        }
      }
    });

    return picks.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });
  }

  function getRosterFAAB(rosterId: string): number {
    const roster = rosters.find(r => r.roster_id.toString() === rosterId);
    return roster?.settings?.waiver_budget_used
      ? (roster.settings.waiver_budget_used)
      : 0;
  }

  function addRosterPlayer(playerId: string, direction: 'gives' | 'gets') {
    if (direction === 'gives') {
      if (teamAGives.includes(playerId)) {
        setTeamAGives(teamAGives.filter(id => id !== playerId));
      } else {
        setTeamAGives([...teamAGives, playerId]);
        const player = players[playerId];
        if (player) fetchEnhancedPlayerData(playerId, player.full_name);
      }
    } else {
      if (teamAGets.includes(playerId)) {
        setTeamAGets(teamAGets.filter(id => id !== playerId));
      } else {
        setTeamAGets([...teamAGets, playerId]);
        const player = players[playerId];
        if (player) fetchEnhancedPlayerData(playerId, player.full_name);
      }
    }
  }

  function addRosterPick(pick: DraftPick, direction: 'gives' | 'gets') {
    if (direction === 'gives') {
      setTeamAGivesPicks([...teamAGivesPicks, pick]);
    } else {
      setTeamAGetsPicks([...teamAGetsPicks, pick]);
    }
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

        {leagueId && rosters.length > 0 && (
          <>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Select Teams</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Team 1</label>
                  <select
                    value={selectedTeamA}
                    onChange={(e) => {
                      setSelectedTeamA(e.target.value);
                      if (e.target.value) {
                        setTeamAName(getTeamName(e.target.value));
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                  >
                    <option value="">Select a team...</option>
                    {rosters.map((roster) => (
                      <option key={roster.roster_id} value={roster.roster_id.toString()}>
                        {getTeamName(roster.roster_id.toString())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Team 2</label>
                  <select
                    value={selectedTeamB}
                    onChange={(e) => {
                      setSelectedTeamB(e.target.value);
                      if (e.target.value) {
                        setTeamBName(getTeamName(e.target.value));
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                  >
                    <option value="">Select a team...</option>
                    {rosters.map((roster) => (
                      <option key={roster.roster_id} value={roster.roster_id.toString()}>
                        {getTeamName(roster.roster_id.toString())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {(selectedTeamA || selectedTeamB) && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Team Rosters</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {selectedTeamA && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-gray-300">{teamAName}</h4>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400">Add to:</label>
                          <select
                            value={tradeDirectionA}
                            onChange={(e) => setTradeDirectionA(e.target.value as 'gives' | 'gets')}
                            className="text-xs px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-[#00d4ff]"
                          >
                            <option value="gives">Gives</option>
                            <option value="gets">Gets</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setAssetTypeA('players')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeA === 'players'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Players
                        </button>
                        <button
                          onClick={() => setAssetTypeA('picks')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeA === 'picks'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Picks
                        </button>
                        <button
                          onClick={() => setAssetTypeA('faab')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeA === 'faab'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          FAAB
                        </button>
                      </div>

                      <div className="bg-gray-900 rounded-lg p-3 max-h-96 overflow-y-auto">
                        {assetTypeA === 'players' && (
                          <div className="space-y-2">
                            {getRosterPlayers(selectedTeamA).map((playerId) => {
                              const player = players[playerId];
                              if (!player) return null;
                              const isSelected = tradeDirectionA === 'gives'
                                ? teamAGives.includes(playerId)
                                : teamAGets.includes(playerId);

                              return (
                                <button
                                  key={playerId}
                                  onClick={() => addRosterPlayer(playerId, tradeDirectionA)}
                                  className={`w-full flex items-center gap-3 p-2 rounded transition-colors text-left ${
                                    isSelected
                                      ? 'bg-[#00d4ff]/20 border border-[#00d4ff] hover:bg-[#00d4ff]/30'
                                      : 'hover:bg-gray-800'
                                  }`}
                                >
                                  <div className="relative w-10 h-10 flex-shrink-0">
                                    <img
                                      src={getPlayerImageUrl(playerId)}
                                      alt={player.full_name}
                                      className="w-10 h-10 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && player) {
                                          const fallback = document.createElement('div');
                                          fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold text-sm ring-2 ring-gray-700';
                                          fallback.textContent = player.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-white text-sm font-medium">{player.full_name}</div>
                                    <div className="text-xs text-gray-400">
                                      {player.position} - {player.team || 'FA'}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <span className="text-xs text-green-400 font-medium">✓ Added</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {assetTypeA === 'picks' && (
                          <div className="space-y-2">
                            {getRosterPicks(selectedTeamA).map((pick) => {
                              const alreadyAdded = tradeDirectionA === 'gives'
                                ? teamAGivesPicks.some(p => p.year === pick.year && p.round === pick.round)
                                : teamAGetsPicks.some(p => p.year === pick.year && p.round === pick.round);

                              return (
                                <button
                                  key={pick.id}
                                  onClick={() => !alreadyAdded && addRosterPick(pick, tradeDirectionA)}
                                  disabled={alreadyAdded}
                                  className={`w-full flex items-center justify-between p-3 rounded hover:bg-gray-800 transition-colors ${
                                    alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-[#00d4ff]" />
                                    <span className="text-white text-sm">{pick.displayName}</span>
                                  </div>
                                  {alreadyAdded && (
                                    <span className="text-xs text-gray-500">Added</span>
                                  )}
                                </button>
                              );
                            })}
                            {getRosterPicks(selectedTeamA).length === 0 && (
                              <p className="text-gray-400 text-sm text-center py-4">No draft picks</p>
                            )}
                          </div>
                        )}

                        {assetTypeA === 'faab' && (
                          <div className="p-3">
                            <div className="text-gray-300 text-sm mb-2">
                              Available FAAB: ${getRosterFAAB(selectedTeamA)}
                            </div>
                            <p className="text-xs text-gray-400">
                              Use the FAAB input fields in the trade sections to add FAAB to the trade.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTeamB && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-gray-300">{teamBName}</h4>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400">Add to:</label>
                          <select
                            value={tradeDirectionB}
                            onChange={(e) => setTradeDirectionB(e.target.value as 'gives' | 'gets')}
                            className="text-xs px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-[#00d4ff]"
                          >
                            <option value="gives">Gives</option>
                            <option value="gets">Gets</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setAssetTypeB('players')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeB === 'players'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Players
                        </button>
                        <button
                          onClick={() => setAssetTypeB('picks')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeB === 'picks'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          Picks
                        </button>
                        <button
                          onClick={() => setAssetTypeB('faab')}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            assetTypeB === 'faab'
                              ? 'bg-[#00d4ff] text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          FAAB
                        </button>
                      </div>

                      <div className="bg-gray-900 rounded-lg p-3 max-h-96 overflow-y-auto">
                        {assetTypeB === 'players' && (
                          <div className="space-y-2">
                            {getRosterPlayers(selectedTeamB).map((playerId) => {
                              const player = players[playerId];
                              if (!player) return null;
                              const isSelected = tradeDirectionB === 'gives'
                                ? teamAGives.includes(playerId)
                                : teamAGets.includes(playerId);

                              return (
                                <button
                                  key={playerId}
                                  onClick={() => addRosterPlayer(playerId, tradeDirectionB)}
                                  className={`w-full flex items-center gap-3 p-2 rounded transition-colors text-left ${
                                    isSelected
                                      ? 'bg-[#00d4ff]/20 border border-[#00d4ff] hover:bg-[#00d4ff]/30'
                                      : 'hover:bg-gray-800'
                                  }`}
                                >
                                  <div className="relative w-10 h-10 flex-shrink-0">
                                    <img
                                      src={getPlayerImageUrl(playerId)}
                                      alt={player.full_name}
                                      className="w-10 h-10 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && player) {
                                          const fallback = document.createElement('div');
                                          fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold text-sm ring-2 ring-gray-700';
                                          fallback.textContent = player.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-white text-sm font-medium">{player.full_name}</div>
                                    <div className="text-xs text-gray-400">
                                      {player.position} - {player.team || 'FA'}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <span className="text-xs text-green-400 font-medium">✓ Added</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {assetTypeB === 'picks' && (
                          <div className="space-y-2">
                            {getRosterPicks(selectedTeamB).map((pick) => {
                              const alreadyAdded = tradeDirectionB === 'gives'
                                ? teamAGivesPicks.some(p => p.year === pick.year && p.round === pick.round)
                                : teamAGetsPicks.some(p => p.year === pick.year && p.round === pick.round);

                              return (
                                <button
                                  key={pick.id}
                                  onClick={() => !alreadyAdded && addRosterPick(pick, tradeDirectionB)}
                                  disabled={alreadyAdded}
                                  className={`w-full flex items-center justify-between p-3 rounded hover:bg-gray-800 transition-colors ${
                                    alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-[#00d4ff]" />
                                    <span className="text-white text-sm">{pick.displayName}</span>
                                  </div>
                                  {alreadyAdded && (
                                    <span className="text-xs text-gray-500">Added</span>
                                  )}
                                </button>
                              );
                            })}
                            {getRosterPicks(selectedTeamB).length === 0 && (
                              <p className="text-gray-400 text-sm text-center py-4">No draft picks</p>
                            )}
                          </div>
                        )}

                        {assetTypeB === 'faab' && (
                          <div className="p-3">
                            <div className="text-gray-300 text-sm mb-2">
                              Available FAAB: ${getRosterFAAB(selectedTeamB)}
                            </div>
                            <p className="text-xs text-gray-400">
                              Use the FAAB input fields in the trade sections to add FAAB to the trade.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-[#00d4ff]" />
            <h3 className="text-lg font-semibold text-white">{leagueId ? 'Search Settings' : 'League & Search Settings'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">League Format</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLeagueFormat('dynasty')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    leagueFormat === 'dynasty'
                      ? 'bg-[#00d4ff] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Dynasty
                </button>
                <button
                  onClick={() => setLeagueFormat('redraft')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    leagueFormat === 'redraft'
                      ? 'bg-[#00d4ff] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Redraft
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Scoring Format</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setScoringFormat('ppr')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    scoringFormat === 'ppr'
                      ? 'bg-[#00d4ff] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  PPR
                </button>
                <button
                  onClick={() => setScoringFormat('half')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    scoringFormat === 'half'
                      ? 'bg-[#00d4ff] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Half PPR
                </button>
                <button
                  onClick={() => setScoringFormat('standard')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    scoringFormat === 'standard'
                      ? 'bg-[#00d4ff] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <button
              onClick={async () => {
                setSyncingValues(true);
                showToast('Refreshing player values...', 'info');
                const synced = await syncPlayerValuesToDatabase(leagueSettings.isSuperflex);
                setSyncingValues(false);
                if (synced > 0) {
                  showToast(`Successfully refreshed ${synced} player values!`, 'success');
                } else {
                  showToast('Failed to refresh player values', 'error');
                }
              }}
              disabled={syncingValues}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {syncingValues ? 'Refreshing Player Values...' : 'Refresh Player Values'}
            </button>
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
          {!leagueId && (
            <div className="border-t border-gray-700 pt-3">
              <p className="text-sm text-gray-400">
                League settings adjust player values. Retired and inactive players are automatically hidden.
              </p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                {teamAName} Gives
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
                  {getFilteredResults(searchTermA).map((result, idx) => {
                    const isPlayerSelected = result.type === 'player' && result.player && teamAGives.includes(result.player.player_id);
                    return result.type === 'player' && result.player ? (
                      <button
                        key={result.player.player_id}
                        onClick={() => addPlayer(result.player!.player_id, 'A', 'gives')}
                        className={`w-full px-4 py-2 text-left transition-colors flex items-center gap-3 group ${
                          isPlayerSelected
                            ? 'bg-[#00d4ff]/20 border-l-4 border-[#00d4ff] hover:bg-[#00d4ff]/30'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <img
                            src={getPlayerImageUrl(result.player.player_id)}
                            alt={result.player.full_name}
                            className="w-12 h-12 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && result.player) {
                                const fallback = document.createElement('div');
                                fallback.className = 'w-12 h-12 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold ring-2 ring-gray-700';
                                fallback.textContent = result.player.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
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
                  })}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGives.map((playerId) => {
                  const player = players[playerId];
                  const enhanced = enhancedPlayerData[playerId];
                  const hasInjury = player.injury_status && ['Out', 'Doubtful', 'Questionable', 'IR', 'PUP'].includes(player.injury_status);
                  return (
                    <div
                      key={playerId}
                      className="flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg border border-gray-700 hover-lift card-enter"
                    >
                      <PlayerAvatar
                        playerName={player.full_name}
                        team={player.team}
                        position={player.position}
                        size="lg"
                        showTeamLogo={true}
                        showBadge={hasInjury}
                        badgeContent={hasInjury ? <AchievementBadge type="injury" size="sm" /> : undefined}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{player.full_name}</span>
                          {getInjuryStatusBadge(player)}
                          {enhanced && (
                            <Tooltip content={
                              <div className="space-y-2 text-xs">
                                {enhanced.projection && (
                                  <div>
                                    <div className="font-semibold text-[#00d4ff]">Projected Points</div>
                                    <div>{Math.round(enhanced.projection.FantasyPointsPPR || 0)} PPR pts</div>
                                  </div>
                                )}
                                {enhanced.injury && (
                                  <div>
                                    <div className="font-semibold text-orange-400">Injury</div>
                                    <div>{enhanced.injury.InjuryBodyPart}: {enhanced.injury.Status}</div>
                                    {enhanced.injury.InjuryNotes && (
                                      <div className="text-gray-400 mt-1">{enhanced.injury.InjuryNotes}</div>
                                    )}
                                  </div>
                                )}
                                {enhanced.news && enhanced.news.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-green-400">Latest News</div>
                                    <div className="text-gray-400">{enhanced.news[0].Title}</div>
                                  </div>
                                )}
                              </div>
                            }>
                              <Info className="w-4 h-4 text-[#00d4ff] cursor-help" />
                            </Tooltip>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <span>{player.position} - {player.team || 'FA'}</span>
                          {enhanced?.projection && (
                            <span className="text-[#00d4ff]">• {Math.round(enhanced.projection.FantasyPointsPPR || 0)} pts</span>
                          )}
                        </div>
                        {enhanced?.recentGames && enhanced.recentGames.length > 0 && (
                          <div className="mt-2">
                            <StatSparkline
                              data={enhanced.recentGames.map((g: any) => g.FantasyPointsPPR || 0).slice(-5)}
                              color="cyan"
                              height={24}
                            />
                          </div>
                        )}
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
                      Value: {teamAGivesFAAB.toFixed(1)} points
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                {teamAName} Gets
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
                  {getFilteredResults(searchTermB).map((result, idx) => {
                    const isPlayerSelected = result.type === 'player' && result.player && teamAGets.includes(result.player.player_id);
                    return result.type === 'player' && result.player ? (
                      <button
                        key={result.player.player_id}
                        onClick={() => addPlayer(result.player!.player_id, 'A', 'gets')}
                        className={`w-full px-4 py-2 text-left transition-colors flex items-center gap-3 group ${
                          isPlayerSelected
                            ? 'bg-[#00d4ff]/20 border-l-4 border-[#00d4ff] hover:bg-[#00d4ff]/30'
                            : 'hover:bg-gray-700'
                        }`}
                      >
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <img
                            src={getPlayerImageUrl(result.player.player_id)}
                            alt={result.player.full_name}
                            className="w-12 h-12 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && result.player) {
                                const fallback = document.createElement('div');
                                fallback.className = 'w-12 h-12 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold ring-2 ring-gray-700';
                                fallback.textContent = result.player.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
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
                  })}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGets.map((playerId) => {
                  const player = players[playerId];
                  const enhanced = enhancedPlayerData[playerId];
                  const hasInjury = player.injury_status && ['Out', 'Doubtful', 'Questionable', 'IR', 'PUP'].includes(player.injury_status);
                  return (
                    <div
                      key={playerId}
                      className="flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg border border-gray-700 hover-lift card-enter"
                    >
                      <PlayerAvatar
                        playerName={player.full_name}
                        team={player.team}
                        position={player.position}
                        size="lg"
                        showTeamLogo={true}
                        showBadge={hasInjury}
                        badgeContent={hasInjury ? <AchievementBadge type="injury" size="sm" /> : undefined}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{player.full_name}</span>
                          {getInjuryStatusBadge(player)}
                          {enhanced && (
                            <Tooltip content={
                              <div className="space-y-2 text-xs">
                                {enhanced.projection && (
                                  <div>
                                    <div className="font-semibold text-[#00d4ff]">Projected Points</div>
                                    <div>{Math.round(enhanced.projection.FantasyPointsPPR || 0)} PPR pts</div>
                                  </div>
                                )}
                                {enhanced.injury && (
                                  <div>
                                    <div className="font-semibold text-orange-400">Injury</div>
                                    <div>{enhanced.injury.InjuryBodyPart}: {enhanced.injury.Status}</div>
                                    {enhanced.injury.InjuryNotes && (
                                      <div className="text-gray-400 mt-1">{enhanced.injury.InjuryNotes}</div>
                                    )}
                                  </div>
                                )}
                                {enhanced.news && enhanced.news.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-green-400">Latest News</div>
                                    <div className="text-gray-400">{enhanced.news[0].Title}</div>
                                  </div>
                                )}
                              </div>
                            }>
                              <Info className="w-4 h-4 text-[#00d4ff] cursor-help" />
                            </Tooltip>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <span>{player.position} - {player.team || 'FA'}</span>
                          {enhanced?.projection && (
                            <span className="text-[#00d4ff]">• {Math.round(enhanced.projection.FantasyPointsPPR || 0)} pts</span>
                          )}
                        </div>
                        {enhanced?.recentGames && enhanced.recentGames.length > 0 && (
                          <div className="mt-2">
                            <StatSparkline
                              data={enhanced.recentGames.map((g: any) => g.FantasyPointsPPR || 0).slice(-5)}
                              color="cyan"
                              height={24}
                            />
                          </div>
                        )}
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
                      Value: {teamAGetsFAAB.toFixed(1)} points
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

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
              <h4 className="text-lg font-semibold text-white mb-3">{teamAName} Gives</h4>
              <div className="space-y-2">
                {analysis.teamAItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'player' && (
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <img
                            src={getPlayerImageUrl(item.id)}
                            alt={item.name}
                            className="w-10 h-10 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold text-sm ring-2 ring-gray-700';
                                fallback.textContent = item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      {item.type === 'pick' && (
                        <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center ring-2 ring-[#00d4ff]/30">
                          <Calendar className="w-5 h-5 text-[#00d4ff]" />
                        </div>
                      )}
                      {item.type === 'faab' && (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center ring-2 ring-green-500/30">
                          <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                      )}
                      <div>
                        <span className="text-white font-medium block">{item.name}</span>
                        {item.position && (
                          <span className="text-gray-400 text-xs">{item.position}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#00d4ff] font-bold text-base">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-600 flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-[#00d4ff]">{analysis.teamAValue}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-3">{teamAName} Gets</h4>
              <div className="space-y-2">
                {analysis.teamBItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'player' && (
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <img
                            src={getPlayerImageUrl(item.id)}
                            alt={item.name}
                            className="w-10 h-10 rounded-full object-cover bg-gradient-to-br from-[#00d4ff] to-[#0099cc] ring-2 ring-gray-700"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0099cc] flex items-center justify-center text-white font-bold text-sm ring-2 ring-gray-700';
                                fallback.textContent = item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      {item.type === 'pick' && (
                        <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center ring-2 ring-[#00d4ff]/30">
                          <Calendar className="w-5 h-5 text-[#00d4ff]" />
                        </div>
                      )}
                      {item.type === 'faab' && (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center ring-2 ring-green-500/30">
                          <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                      )}
                      <div>
                        <span className="text-white font-medium block">{item.name}</span>
                        {item.position && (
                          <span className="text-gray-400 text-xs">{item.position}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#00d4ff] font-bold text-base">{item.value}</span>
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
              <div className="text-sm text-gray-400 mb-1">{teamAName} Value</div>
              <div className="text-2xl font-bold text-white">{analysis.teamAValue}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">{teamBName} Value</div>
              <div className="text-2xl font-bold text-white">{analysis.teamBValue}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Difference</div>
              <div className="text-2xl font-bold text-[#00d4ff]">{analysis.difference}</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg">
            {(teamAGivesPicks.length > 0 || teamAGetsPicks.length > 0) && (() => {
              const phaseInfo = getCurrentPhaseInfo();
              const adjustment = getMultiplierPercentage(phaseInfo.phase);
              return (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-300">
                    <span className="text-lg">{getPhaseEmoji(phaseInfo.phase)}</span>
                    <span className="font-semibold">{phaseInfo.label}:</span>
                    <span>Rookie picks currently {adjustment.startsWith('+') ? 'inflated' : adjustment.startsWith('-') ? 'discounted' : 'at baseline'} ({adjustment})</span>
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    {phaseInfo.description}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col items-center gap-4 mb-4">
              <TradeGrade
                grade={calculateTradeGrade(
                  Math.max(analysis.teamAValue, analysis.teamBValue) > 0
                    ? 100 - (Math.abs(analysis.teamAValue - analysis.teamBValue) / Math.max(analysis.teamAValue, analysis.teamBValue) * 100)
                    : 100
                )}
                score={
                  Math.max(analysis.teamAValue, analysis.teamBValue) > 0
                    ? 100 - (Math.abs(analysis.teamAValue - analysis.teamBValue) / Math.max(analysis.teamAValue, analysis.teamBValue) * 100)
                    : 100
                }
                size="lg"
              />

              <div className="flex items-center gap-3">
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
            </div>

            {analysis.winner !== 'Fair' && (
              <p className="text-center text-gray-300 text-sm bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                Team {analysis.winner} receives approximately <span className="font-bold text-[#00d4ff]">{analysis.difference}</span> more value in
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
