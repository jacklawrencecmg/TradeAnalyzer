import { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Plus, Clock, CheckCircle, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getPlayerTeamHistory,
  getPlayerTransactions,
  recordManualTeamChange,
  TeamHistoryRecord,
  TransactionRecord,
} from '../lib/players/getPlayerTeamAtDate';
import { resolvePlayerId } from '../lib/players/resolvePlayerId';

interface Player {
  id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  status: string;
}

export default function PlayerTeamHistoryAdmin() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [teamHistory, setTeamHistory] = useState<TeamHistoryRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newTeamForm, setNewTeamForm] = useState({
    team: '',
    changeDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlayers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  async function searchPlayers() {
    try {
      const result = await resolvePlayerId({
        name: searchQuery,
        fuzzyThreshold: 0.5,
        autoQuarantine: false,
      });

      if (result.success && result.player_id) {
        const { data, error } = await supabase
          .from('nfl_players')
          .select('id, full_name, player_position, team, status')
          .eq('id', result.player_id)
          .single();

        if (!error && data) {
          setSearchResults([data]);
        }
      } else if (result.suggestions && result.suggestions.length > 0) {
        const playerIds = result.suggestions.map(s => s.player_id);
        const { data, error } = await supabase
          .from('nfl_players')
          .select('id, full_name, player_position, team, status')
          .in('id', playerIds);

        if (!error && data) {
          setSearchResults(data);
        }
      }
    } catch (err) {
      console.error('Error searching players:', err);
    }
  }

  async function selectPlayer(player: Player) {
    setSelectedPlayer(player);
    setLoading(true);
    setMessage(null);

    try {
      const [historyData, txData] = await Promise.all([
        getPlayerTeamHistory(player.id),
        getPlayerTransactions(player.id),
      ]);

      setTeamHistory(historyData);
      setTransactions(txData);
      setNewTeamForm({ team: player.team || '', changeDate: new Date().toISOString().split('T')[0] });
    } catch (err) {
      console.error('Error loading player data:', err);
      setMessage({ type: 'error', text: 'Failed to load player history' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTeamChange() {
    if (!selectedPlayer || !newTeamForm.team) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const changeDate = new Date(newTeamForm.changeDate);
      const success = await recordManualTeamChange(selectedPlayer.id, newTeamForm.team, changeDate);

      if (success) {
        setMessage({ type: 'success', text: 'Team change recorded successfully' });
        await selectPlayer(selectedPlayer);
        setNewTeamForm({ team: '', changeDate: new Date().toISOString().split('T')[0] });
      } else {
        setMessage({ type: 'error', text: 'Failed to record team change' });
      }
    } catch (err) {
      console.error('Error recording team change:', err);
      setMessage({ type: 'error', text: 'Error recording team change' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHistory(historyId: string) {
    if (!confirm('Are you sure you want to delete this team history record?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('player_team_history')
        .delete()
        .eq('id', historyId);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Team history record deleted' });
      if (selectedPlayer) {
        await selectPlayer(selectedPlayer);
      }
    } catch (err) {
      console.error('Error deleting history:', err);
      setMessage({ type: 'error', text: 'Failed to delete team history record' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('player_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Transaction deleted' });
      if (selectedPlayer) {
        await selectPlayer(selectedPlayer);
      }
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setMessage({ type: 'error', text: 'Failed to delete transaction' });
    } finally {
      setSaving(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Player Team History Admin
        </h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a player..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((player) => (
              <button
                key={player.id}
                onClick={() => selectPlayer(player)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{player.full_name}</p>
                    <p className="text-sm text-gray-600">
                      {player.player_position} - {player.team || 'Free Agent'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">{player.status}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p
            className={
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {message.text}
          </p>
        </div>
      )}

      {selectedPlayer && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {selectedPlayer.full_name}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedPlayer.player_position} - Current Team: {selectedPlayer.team || 'Free Agent'}
            </p>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Record Team Change
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Team
                  </label>
                  <input
                    type="text"
                    value={newTeamForm.team}
                    onChange={(e) =>
                      setNewTeamForm({ ...newTeamForm, team: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., KC, SF, DAL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Change Date
                  </label>
                  <input
                    type="date"
                    value={newTeamForm.changeDate}
                    onChange={(e) =>
                      setNewTeamForm({ ...newTeamForm, changeDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleAddTeamChange}
                    disabled={saving || !newTeamForm.team}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Recording...' : 'Record Change'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Team History
            </h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : teamHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No team history found</p>
            ) : (
              <div className="space-y-3">
                {teamHistory.map((history) => (
                  <div
                    key={history.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-lg text-gray-900">
                            {history.team}
                          </span>
                          {history.is_current && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Current
                            </span>
                          )}
                          <span className="text-xs text-gray-500 uppercase">
                            {history.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{formatDate(history.from_date)}</span>
                          <ArrowRight className="w-4 h-4" />
                          <span>{history.to_date ? formatDate(history.to_date) : 'Present'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHistory(history.id)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete history record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Transactions
            </h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions found</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-gray-900 capitalize">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">
                            {tx.source}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {tx.team_from && tx.team_to && (
                            <span>
                              {tx.team_from} → {tx.team_to}
                            </span>
                          )}
                          {tx.team_to && !tx.team_from && <span>To: {tx.team_to}</span>}
                          {tx.team_from && !tx.team_to && <span>From: {tx.team_from}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(tx.transaction_date)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
