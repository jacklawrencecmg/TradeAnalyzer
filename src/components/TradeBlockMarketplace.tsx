import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

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
  const [items, setItems] = useState<TradeBlockItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', playerId: '', asking: 0, notes: '' });

  useEffect(() => {
    loadTradeBlock();
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

  const myItems = items.filter(item => item.user_id === userId);
  const otherItems = items.filter(item => item.user_id !== userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Trade Block Marketplace</h1>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        </div>

        {showAddForm && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Player to Trade Block</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Player Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Player ID"
                value={newPlayer.playerId}
                onChange={(e) => setNewPlayer({ ...newPlayer, playerId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Asking Value"
                value={newPlayer.asking}
                onChange={(e) => setNewPlayer({ ...newPlayer, asking: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="Notes (optional)"
                value={newPlayer.notes}
                onChange={(e) => setNewPlayer({ ...newPlayer, notes: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={addToTradeBlock}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
                >
                  Add to Trade Block
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading trade block...</p>
          </div>
        ) : (
          <>
            {myItems.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Your Trade Block</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myItems.map(item => (
                    <div key={item.id} className="bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/30 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{item.player_name}</h3>
                          <p className="text-sm text-gray-400">Asking: {item.asking_value.toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => removeFromTradeBlock(item.id)}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-300 mt-2">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold mb-4">League Trade Block</h2>
              {otherItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                  <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No players on trade block yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherItems.map(item => (
                    <div key={item.id} className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 hover:border-blue-500 transition">
                      <h3 className="font-bold text-lg">{item.player_name}</h3>
                      <p className="text-sm text-gray-400">Asking: {item.asking_value.toLocaleString()}</p>
                      {item.notes && (
                        <p className="text-sm text-gray-300 mt-2">{item.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
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
