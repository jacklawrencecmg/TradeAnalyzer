import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Plus, X } from 'lucide-react';
import {
  fetchAllPlayers,
  analyzeTrade,
  type SleeperPlayer,
  type TradeAnalysis,
} from '../services/sleeperApi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface TradeAnalyzerProps {
  leagueId: string;
  onTradeSaved?: () => void;
}

export default function TradeAnalyzer({ leagueId, onTradeSaved }: TradeAnalyzerProps) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [teamAGives, setTeamAGives] = useState<string[]>([]);
  const [teamAGets, setTeamAGets] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

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

  function getFilteredPlayers(searchTerm: string): SleeperPlayer[] {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    return Object.values(players)
      .filter(
        (player) =>
          player.full_name?.toLowerCase().includes(term) &&
          player.position &&
          ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(player.position)
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
      .slice(0, 10);
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

  function removePlayer(playerId: string, team: 'A' | 'B', type: 'gives' | 'gets') {
    if (team === 'A' && type === 'gives') {
      setTeamAGives(teamAGives.filter((id) => id !== playerId));
    } else if (team === 'A' && type === 'gets') {
      setTeamAGets(teamAGets.filter((id) => id !== playerId));
    }
  }

  async function handleAnalyzeTrade() {
    if (teamAGives.length === 0 || teamAGets.length === 0) {
      alert('Please add players to both sides of the trade');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeTrade(leagueId, teamAGives, teamAGets);
      setAnalysis(result);

      if (user) {
        await saveTrade(result);
      }
    } catch (error) {
      console.error('Failed to analyze trade:', error);
      alert('Failed to analyze trade. Please try again.');
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
        team_a_gives: teamAGives,
        team_a_gets: teamAGets,
        team_a_value: result.teamAValue,
        team_b_value: result.teamBValue,
        difference: result.difference,
        winner: result.winner,
        fairness: result.fairness,
      });

      if (error) throw error;

      if (onTradeSaved) onTradeSaved();
    } catch (error) {
      console.error('Failed to save trade:', error);
    }
  }

  function clearTrade() {
    setTeamAGives([]);
    setTeamAGets([]);
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
          {(teamAGives.length > 0 || teamAGets.length > 0) && (
            <button
              onClick={clearTrade}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Trade
            </button>
          )}
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
                  placeholder="Search players..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>
              {searchTermA.length >= 2 && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                  {getFilteredPlayers(searchTermA).map((player) => (
                    <button
                      key={player.player_id}
                      onClick={() => addPlayer(player.player_id, 'A', 'gives')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-white font-medium">{player.full_name}</div>
                        <div className="text-sm text-gray-400">
                          {player.position} - {player.team || 'FA'}
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGives.map((playerId) => {
                  const player = players[playerId];
                  return (
                    <div
                      key={playerId}
                      className="flex items-center justify-between bg-gray-800 px-4 py-3 rounded-lg border border-gray-700"
                    >
                      <div>
                        <div className="text-white font-medium">{player.full_name}</div>
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
                  placeholder="Search players..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>
              {searchTermB.length >= 2 && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                  {getFilteredPlayers(searchTermB).map((player) => (
                    <button
                      key={player.player_id}
                      onClick={() => addPlayer(player.player_id, 'A', 'gets')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-white font-medium">{player.full_name}</div>
                        <div className="text-sm text-gray-400">
                          {player.position} - {player.team || 'FA'}
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-gray-500 group-hover:text-[#00d4ff]" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {teamAGets.map((playerId) => {
                  const player = players[playerId];
                  return (
                    <div
                      key={playerId}
                      className="flex items-center justify-between bg-gray-800 px-4 py-3 rounded-lg border border-gray-700"
                    >
                      <div>
                        <div className="text-white font-medium">{player.full_name}</div>
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
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAnalyzeTrade}
            disabled={analyzing || teamAGives.length === 0 || teamAGets.length === 0}
            className="w-full bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Trade'}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl animate-in fade-in duration-300">
          <h3 className="text-xl font-bold text-white mb-4">Trade Analysis Results</h3>

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
