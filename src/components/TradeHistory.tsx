import { useState, useEffect } from 'react';
import { History, Trash2, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { supabase, type SavedTrade } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { fetchAllPlayers, getPlayerImageUrl, type SleeperPlayer } from '../services/sleeperApi';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { TradeCardSkeleton } from './LoadingSkeleton';

interface TradeHistoryProps {
  leagueId: string;
}

export default function TradeHistory({ leagueId }: TradeHistoryProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [trades, setTrades] = useState<SavedTrade[]>([]);
  const [players, setPlayers] = useState<Record<string, SleeperPlayer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [leagueId, user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [tradesData, playersData] = await Promise.all([loadTrades(), fetchAllPlayers()]);

      setTrades(tradesData);
      setPlayers(playersData);
    } catch (err) {
      console.error('Failed to load trade history:', err);
      setError('Failed to load trade history. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTrades(): Promise<SavedTrade[]> {
    if (!user) return [];

    const { data, error } = await supabase
      .from('saved_trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function deleteTrade(tradeId: string) {
    try {
      const { error } = await supabase.from('saved_trades').delete().eq('id', tradeId);

      if (error) throw error;

      setTrades(trades.filter((t) => t.id !== tradeId));
      showToast('Trade deleted successfully', 'success');
    } catch (err) {
      console.error('Failed to delete trade:', err);
      showToast('Failed to delete trade. Please try again.', 'error');
    }
  }

  function getPlayerName(playerId: string): string {
    return players[playerId]?.full_name || 'Unknown Player';
  }

  function getWinnerIcon(winner: string) {
    if (winner === 'Fair') {
      return <Minus className="w-5 h-5 text-yellow-400" />;
    } else if (winner === 'A') {
      return <TrendingUp className="w-5 h-5 text-green-400" />;
    } else {
      return <TrendingDown className="w-5 h-5 text-red-400" />;
    }
  }

  function getWinnerColor(winner: string): string {
    if (winner === 'Fair') return 'text-yellow-400';
    if (winner === 'A') return 'text-green-400';
    return 'text-red-400';
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <TradeCardSkeleton />
        <TradeCardSkeleton />
        <TradeCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-12 text-center">
        <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-xl font-bold text-white mb-2">No Trade History</h3>
        <p className="text-gray-400">
          Analyzed trades will be automatically saved here for future reference.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-7 h-7 text-[#00d4ff]" />
            Trade History
          </h2>
          <div className="text-sm text-gray-400">{trades.length} saved trades</div>
        </div>

        <div className="space-y-4">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="bg-gray-800 rounded-lg border border-gray-700 p-5 hover:border-[#00d4ff] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getWinnerIcon(trade.trade_result?.winner || trade.winner)}
                  <div>
                    <div
                      className={`font-bold text-lg ${getWinnerColor(
                        trade.trade_result?.winner || trade.winner || 'Fair'
                      )}`}
                    >
                      {(trade.trade_result?.winner || trade.winner) === 'Fair'
                        ? 'Fair Trade'
                        : `Team ${trade.trade_result?.winner || trade.winner} Wins`}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(trade.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(trade.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-2"
                  title="Delete trade"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Team A Value</div>
                  <div className="text-2xl font-bold text-white">
                    {trade.trade_result?.team_a_value || trade.team_a_value}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Team B Value</div>
                  <div className="text-2xl font-bold text-white">
                    {trade.trade_result?.team_b_value || trade.team_b_value}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Difference</div>
                  <div className="text-2xl font-bold text-[#00d4ff]">
                    {trade.trade_result?.difference || trade.difference}
                  </div>
                </div>
              </div>

              {trade.trade_result?.team_a_items ? (
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-400 mb-2">Team A Gives</div>
                    <div className="space-y-1">
                      {trade.trade_result.team_a_items.map((item) => (
                        <div
                          key={item.id}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {item.type === 'player' && (
                              <img
                                src={getPlayerImageUrl(item.id)}
                                alt={item.name}
                                className="w-6 h-6 rounded-full object-cover bg-gray-700"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            {item.type === 'pick' && (
                              <Calendar className="w-3 h-3 text-[#00d4ff]" />
                            )}
                            <span>
                              {item.name}
                              {item.position && (
                                <span className="text-gray-500 ml-1">({item.position})</span>
                              )}
                            </span>
                          </div>
                          <span className="text-gray-400">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-400 mb-2">Team A Gets</div>
                    <div className="space-y-1">
                      {trade.trade_result.team_b_items.map((item) => (
                        <div
                          key={item.id}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {item.type === 'player' && (
                              <img
                                src={getPlayerImageUrl(item.id)}
                                alt={item.name}
                                className="w-6 h-6 rounded-full object-cover bg-gray-700"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            {item.type === 'pick' && (
                              <Calendar className="w-3 h-3 text-[#00d4ff]" />
                            )}
                            <span>
                              {item.name}
                              {item.position && (
                                <span className="text-gray-500 ml-1">({item.position})</span>
                              )}
                            </span>
                          </div>
                          <span className="text-gray-400">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-400 mb-2">Team A Gives</div>
                    <div className="space-y-1">
                      {trade.trade_data?.team_a_gives?.map((playerId: string) => (
                        <div
                          key={playerId}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                        >
                          <img
                            src={getPlayerImageUrl(playerId)}
                            alt={getPlayerName(playerId)}
                            className="w-6 h-6 rounded-full object-cover bg-gray-700"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          {getPlayerName(playerId)}
                        </div>
                      )) ||
                        trade.team_a_gives?.map((playerId: string) => (
                          <div
                            key={playerId}
                            className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                          >
                            <img
                              src={getPlayerImageUrl(playerId)}
                              alt={getPlayerName(playerId)}
                              className="w-6 h-6 rounded-full object-cover bg-gray-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {getPlayerName(playerId)}
                          </div>
                        ))}
                      {trade.trade_data?.team_a_gives_picks?.map((pick) => (
                        <div
                          key={pick.id}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                        >
                          <Calendar className="w-3 h-3 text-[#00d4ff]" />
                          {pick.displayName}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-400 mb-2">Team A Gets</div>
                    <div className="space-y-1">
                      {trade.trade_data?.team_a_gets?.map((playerId: string) => (
                        <div
                          key={playerId}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                        >
                          <img
                            src={getPlayerImageUrl(playerId)}
                            alt={getPlayerName(playerId)}
                            className="w-6 h-6 rounded-full object-cover bg-gray-700"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          {getPlayerName(playerId)}
                        </div>
                      )) ||
                        trade.team_a_gets?.map((playerId: string) => (
                          <div
                            key={playerId}
                            className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                          >
                            <img
                              src={getPlayerImageUrl(playerId)}
                              alt={getPlayerName(playerId)}
                              className="w-6 h-6 rounded-full object-cover bg-gray-700"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {getPlayerName(playerId)}
                          </div>
                        ))}
                      {trade.trade_data?.team_a_gets_picks?.map((pick) => (
                        <div
                          key={pick.id}
                          className="text-sm bg-gray-900 px-3 py-2 rounded border border-gray-700 text-white flex items-center gap-2"
                        >
                          <Calendar className="w-3 h-3 text-[#00d4ff]" />
                          {pick.displayName}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Analysis</div>
                <p className="text-white">{trade.trade_result?.fairness || trade.fairness}</p>
              </div>

              {trade.notes && (
                <div className="mt-4 bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Notes</div>
                  <p className="text-white">{trade.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteTrade(deleteConfirm)}
        title="Delete Trade Analysis"
        message="Are you sure you want to delete this trade analysis? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
