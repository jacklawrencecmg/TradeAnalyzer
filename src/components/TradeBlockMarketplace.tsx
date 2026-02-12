import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPlayerValueById as getPlayerValue, fetchTradeBlockPlayers, TradeBlockPlayer } from '../services/sleeperApi';

interface TradeBlockItem {
  id: string;
  league_id: string;
  user_id: string;
  player_id: string;
  player_name: string;
  asking_value: number;
  notes: string;
  created_at: string;
}

interface TradeBlockMarketplaceProps {
  leagueId: string;
  userId: string;
}

export default function TradeBlockMarketplace({ leagueId, userId }: TradeBlockMarketplaceProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<TradeBlockItem[]>([]);
  const [sleeperPlayers, setSleeperPlayers] = useState<TradeBlockPlayer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', playerId: '', asking: 0, notes: '' });

  useEffect(() => {
    loadTradeBlock();
    syncSleeperTradeBlock();
  }, [leagueId]);

  const loadTradeBlock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trade_blocks')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading trade block:', error);
    }
    setLoading(false);
  };

  const addToTradeBlock = async () => {
    if (!newPlayer.name || !newPlayer.playerId) return;

    try {
      await supabase.from('trade_blocks').insert({
        league_id: leagueId,
        user_id: userId,
        player_id: newPlayer.playerId,
        player_name: newPlayer.name,
        asking_value: newPlayer.asking,
        notes: newPlayer.notes
      });

      setNewPlayer({ name: '', playerId: '', asking: 0, notes: '' });
      setShowAddForm(false);
      await loadTradeBlock();
    } catch (error) {
      console.error('Error adding to trade block:', error);
    }
  };

  const removeFromTradeBlock = async (id: string) => {
    try {
      await supabase.from('trade_blocks').delete().eq('id', id).eq('user_id', userId);
      await loadTradeBlock();
    } catch (error) {
      console.error('Error removing from trade block:', error);
    }
  };

  const syncSleeperTradeBlock = async () => {
    setSyncing(true);
    try {
      const players = await fetchTradeBlockPlayers(leagueId);
      setSleeperPlayers(players);
    } catch (error) {
      console.error('Error syncing Sleeper trade block:', error);
    }
    setSyncing(false);
  };

  const myItems = items.filter(item => item.user_id === userId);
  const otherItems = items.filter(item => item.user_id !== userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 text-fdp-text-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-fdp-accent-1" />
            <h1 className="text-3xl font-bold">Trade Block Marketplace</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={syncSleeperTradeBlock}
              disabled={syncing}
              className="px-6 py-2 bg-fdp-pos hover:opacity-90 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Sleeper'}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-6 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg font-semibold transition flex items-center gap-2 hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Player
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Player to Trade Block</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Player Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
              />
              <input
                type="text"
                placeholder="Player ID"
                value={newPlayer.playerId}
                onChange={(e) => setNewPlayer({ ...newPlayer, playerId: e.target.value })}
                className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
              />
              <input
                type="number"
                placeholder="Asking Value"
                value={newPlayer.asking}
                onChange={(e) => setNewPlayer({ ...newPlayer, asking: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
              />
              <textarea
                placeholder="Notes (optional)"
                value={newPlayer.notes}
                onChange={(e) => setNewPlayer({ ...newPlayer, notes: e.target.value })}
                className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={addToTradeBlock}
                  className="px-6 py-2 bg-fdp-pos hover:opacity-90 rounded-lg font-semibold transition"
                >
                  Add to Trade Block
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-fdp-surface-2 hover:bg-fdp-border-1 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-fdp-accent-1 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-fdp-text-3">Loading trade block...</p>
          </div>
        ) : (
          <>
            {sleeperPlayers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-fdp-pos" />
                  Sleeper Trade Block ({sleeperPlayers.length} players)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sleeperPlayers.map(player => (
                    <div key={`${player.roster_id}-${player.player_id}`} className="bg-fdp-pos/10 backdrop-blur-sm rounded-lg border border-fdp-pos/30 p-4 hover:border-fdp-pos transition">
                      <div className="flex items-start gap-3">
                        <img
                          src={`https://sleepercdn.com/content/nfl/players/thumb/${player.player_id}.jpg`}
                          alt={player.player_name}
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{player.player_name}</h3>
                          <div className="flex gap-2 text-sm text-fdp-text-3">
                            <span>{player.position}</span>
                            {player.team && <span>• {player.team}</span>}
                          </div>
                          <p className="text-sm text-fdp-pos mt-1">
                            Value: {player.value.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myItems.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Your Trade Block</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myItems.map(item => (
                    <div key={item.id} className="bg-fdp-accent-1/10 backdrop-blur-sm rounded-lg border border-fdp-accent-1/30 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{item.player_name}</h3>
                          <p className="text-sm text-fdp-text-3">Asking: {item.asking_value.toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => removeFromTradeBlock(item.id)}
                          className="p-2 bg-fdp-neg hover:opacity-90 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-fdp-text-2 mt-2">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold mb-4">League Trade Block</h2>
              {otherItems.length === 0 ? (
                <div className="text-center py-12 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
                  <ShoppingCart className="w-16 h-16 text-fdp-border-1 mx-auto mb-4" />
                  <p className="text-fdp-text-3">No players on trade block yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherItems.map(item => (
                    <div key={item.id} className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-4 hover:border-fdp-accent-1 transition">
                      <h3 className="font-bold text-lg">{item.player_name}</h3>
                      <p className="text-sm text-fdp-text-3">Asking: {item.asking_value.toLocaleString()}</p>
                      {item.notes && (
                        <p className="text-sm text-fdp-text-2 mt-2">{item.notes}</p>
                      )}
                      <p className="text-xs text-fdp-text-3 mt-2">
                        Posted {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
