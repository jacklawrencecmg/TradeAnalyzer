import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface KeeperPlayer {
  player_id: string;
  name: string;
  position: string;
  value: number;
  cost: number;
  surplus: number;
  recommendation: 'keep' | 'cut';
}

interface KeeperCalculatorProps {
  leagueId: string;
  rosterId: string;
}

export default function KeeperCalculator({ leagueId, rosterId }: KeeperCalculatorProps) {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<KeeperPlayer[]>([]);
  const [keeperLimit, setKeeperLimit] = useState(3);
  const [defaultCost, setDefaultCost] = useState(1000);

  useEffect(() => {
    loadRosterAndCalculate();
  }, [leagueId, rosterId]);

  const loadRosterAndCalculate = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const userRoster = rosters.find((r: any) => r.roster_id.toString() === rosterId);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

      const keeperPlayers = await Promise.all(
        (userRoster.players || []).map(async (playerId: string) => {
          const playerData = allPlayers[playerId];
          if (!playerData) return null;

          const value = await getPlayerValue(playerId);
          const cost = defaultCost;
          const surplus = value - cost;

          return {
            player_id: playerId,
            name: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
            position: playerData.position,
            value,
            cost,
            surplus,
            recommendation: surplus > 500 ? 'keep' : 'cut'
          } as KeeperPlayer;
        })
      );

      const valid = keeperPlayers
        .filter((p): p is KeeperPlayer => p !== null)
        .sort((a, b) => b.surplus - a.surplus);

      setPlayers(valid);
    } catch (error) {
      console.error('Error loading roster:', error);
    }
    setLoading(false);
  };

  const updatePlayerCost = (playerId: string, newCost: number) => {
    setPlayers(players.map(p => {
      if (p.player_id === playerId) {
        const surplus = p.value - newCost;
        return {
          ...p,
          cost: newCost,
          surplus,
          recommendation: surplus > 500 ? 'keep' : 'cut'
        };
      }
      return p;
    }).sort((a, b) => b.surplus - a.surplus));
  };

  const topKeepers = players.slice(0, keeperLimit);
  const totalKeeperValue = topKeepers.reduce((sum, p) => sum + p.value, 0);
  const totalKeeperCost = topKeepers.reduce((sum, p) => sum + p.cost, 0);
  const totalSurplus = totalKeeperValue - totalKeeperCost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Keeper Value Calculator</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Keeper Limit</label>
              <input
                type="number"
                value={keeperLimit}
                onChange={(e) => setKeeperLimit(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Keeper Cost</label>
              <input
                type="number"
                value={defaultCost}
                onChange={(e) => {
                  const newCost = parseInt(e.target.value) || 0;
                  setDefaultCost(newCost);
                  setPlayers(players.map(p => ({
                    ...p,
                    cost: newCost,
                    surplus: p.value - newCost,
                    recommendation: (p.value - newCost) > 500 ? 'keep' : 'cut'
                  })));
                }}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
            <p className="text-gray-400 mb-2">Total Keeper Value</p>
            <p className="text-3xl font-bold text-green-400">{totalKeeperValue.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
            <p className="text-gray-400 mb-2">Total Cost</p>
            <p className="text-3xl font-bold text-red-400">{totalKeeperCost.toLocaleString()}</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
            <p className="text-gray-400 mb-2">Total Surplus Value</p>
            <p className="text-3xl font-bold text-blue-400">+{totalSurplus.toLocaleString()}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Calculating keeper values...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Keeper Recommendations</h2>
            {players.map((player, index) => (
              <div
                key={player.player_id}
                className={`backdrop-blur-sm rounded-lg border p-6 transition ${
                  index < keeperLimit
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {index < keeperLimit && (
                        <Shield className="w-6 h-6 text-green-400" />
                      )}
                      <div>
                        <h3 className="text-xl font-bold">{player.name}</h3>
                        <p className="text-gray-400">{player.position}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Current Value</p>
                        <p className="text-xl font-bold">{player.value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Keeper Cost</p>
                        <input
                          type="number"
                          value={player.cost}
                          onChange={(e) => updatePlayerCost(player.player_id, parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-gray-700/50 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-lg font-bold"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Surplus Value</p>
                        <p className={`text-xl font-bold ${
                          player.surplus > 1000 ? 'text-green-400' :
                          player.surplus > 0 ? 'text-blue-400' : 'text-red-400'
                        }`}>
                          {player.surplus > 0 ? '+' : ''}{player.surplus.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Recommendation</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                          player.recommendation === 'keep'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {player.recommendation === 'keep' ? 'KEEP' : 'CUT'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            How Keeper Value is Calculated
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>Keeper value is calculated as:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Surplus Value = Current Player Value - Keeper Cost</li>
              <li>Higher surplus value indicates better keeper value</li>
              <li>Players with surplus value over 500 are recommended as keepers</li>
              <li>Adjust individual keeper costs to match your league settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
