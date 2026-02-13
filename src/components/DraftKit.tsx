import React, { useState, useEffect } from 'react';
import { Clipboard, Star, Search } from 'lucide-react';
import { getPlayerValueById as getPlayerValue } from '../services/sleeperApi';
import { supabase } from '../lib/supabase';

interface DraftPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  value: number;
  rank: number;
  tier: number;
  age?: number;
}

interface DraftKitProps {
  leagueId: string;
  userId: string;
}

export default function DraftKit({ leagueId, userId }: DraftKitProps) {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [draftedPlayers, setDraftedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDraftBoard();
  }, []);

  const loadDraftBoard = async () => {
    setLoading(true);
    try {
      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

      const playersWithValues = await Promise.all(
        Object.entries(allPlayers)
          .filter(([_, player]: [string, any]) =>
            ['QB', 'RB', 'WR', 'TE'].includes(player.position) &&
            player.status === 'Active'
          )
          .slice(0, 200)
          .map(async ([id, player]: [string, any], index) => {
            const value = await getPlayerValue(id);
            return {
              player_id: id,
              full_name: player.full_name || `${player.first_name} ${player.last_name}`,
              position: player.position,
              team: player.team || 'FA',
              value,
              rank: index + 1,
              tier: Math.floor(index / 20) + 1,
              age: player.age
            };
          })
      );

      const ranked = playersWithValues
        .filter(p => p.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((p, index) => ({ ...p, rank: index + 1, tier: Math.floor(index / 20) + 1 }));

      setPlayers(ranked);
    } catch (error) {
      console.error('Error loading draft board:', error);
    }
    setLoading(false);
  };

  const toggleDrafted = (playerId: string) => {
    const newDrafted = new Set(draftedPlayers);
    if (newDrafted.has(playerId)) {
      newDrafted.delete(playerId);
    } else {
      newDrafted.add(playerId);
    }
    setDraftedPlayers(newDrafted);
  };

  const saveRankings = async () => {
    try {
      const rankings = players.map(p => ({
        league_id: leagueId,
        user_id: userId,
        player_id: p.player_id,
        player_name: p.full_name,
        position: p.position,
        rank: p.rank,
        tier: p.tier
      }));

      await supabase.from('draft_rankings').delete().eq('user_id', userId).eq('league_id', leagueId);
      await supabase.from('draft_rankings').insert(rankings);

      alert('Rankings saved successfully!');
    } catch (error) {
      console.error('Error saving rankings:', error);
    }
  };

  const filteredPlayers = players.filter(p => {
    if (draftedPlayers.has(p.player_id)) return false;
    if (positionFilter !== 'ALL' && p.position !== positionFilter) return false;
    if (searchTerm && !p.full_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getTierColor = (tier: number) => {
    const colors = [
      'border-yellow-500 bg-yellow-500/10',
      'border-blue-500 bg-blue-500/10',
      'border-green-500 bg-green-500/10',
      'border-purple-500 bg-purple-500/10',
      'border-gray-500 bg-gray-500/10'
    ];
    return colors[Math.min(tier - 1, colors.length - 1)];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clipboard className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Draft Kit</h1>
          </div>
          <button
            onClick={saveRankings}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
          >
            Save Rankings
          </button>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
            <button
              onClick={loadDraftBoard}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Drafted:</span>
              <span className="font-bold">{draftedPlayers.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Available:</span>
              <span className="font-bold">{filteredPlayers.length}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading draft board...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlayers.map(player => (
              <div
                key={player.player_id}
                className={`backdrop-blur-sm rounded-lg border p-4 hover:border-blue-500 transition ${getTierColor(player.tier)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-500 w-12">{player.rank}</span>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">Tier</span>
                        <span className="text-lg font-bold">{player.tier}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{player.full_name}</h3>
                      <p className="text-sm text-gray-400">
                        {player.position} - {player.team}
                        {player.age && ` - ${player.age}yo`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Dynasty Value</p>
                      <p className="text-xl font-bold text-blue-400">{player.value.toLocaleString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleDrafted(player.player_id)}
                    className={`ml-4 px-6 py-2 rounded-lg font-semibold transition ${
                      draftedPlayers.has(player.player_id)
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {draftedPlayers.has(player.player_id) ? 'Undo' : 'Draft'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
