import React, { useState } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface Player {
  id: string;
  name: string;
  value: number;
}

interface CounterOffer {
  original_value: number;
  counter_value: number;
  difference: number;
  fairness: number;
  suggestions: Player[];
}

export default function CounterOfferGenerator() {
  const [loading, setLoading] = useState(false);
  const [receivingPlayers, setReceivingPlayers] = useState<Player[]>([]);
  const [givingPlayers, setGivingPlayers] = useState<Player[]>([]);
  const [counterOffer, setCounterOffer] = useState<CounterOffer | null>(null);
  const [newPlayer, setNewPlayer] = useState({ id: '', name: '', list: 'receiving' });

  const addPlayer = async () => {
    if (!newPlayer.id || !newPlayer.name) return;

    try {
      const value = await getPlayerValue(newPlayer.id);
      const player = { id: newPlayer.id, name: newPlayer.name, value };

      if (newPlayer.list === 'receiving') {
        setReceivingPlayers([...receivingPlayers, player]);
      } else {
        setGivingPlayers([...givingPlayers, player]);
      }

      setNewPlayer({ id: '', name: '', list: 'receiving' });
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const removePlayer = (id: string, list: 'receiving' | 'giving') => {
    if (list === 'receiving') {
      setReceivingPlayers(receivingPlayers.filter(p => p.id !== id));
    } else {
      setGivingPlayers(givingPlayers.filter(p => p.id !== id));
    }
  };

  const generateCounterOffer = () => {
    const receivingValue = receivingPlayers.reduce((sum, p) => sum + p.value, 0);
    const givingValue = givingPlayers.reduce((sum, p) => sum + p.value, 0);
    const difference = receivingValue - givingValue;

    const fairness = 100 - (Math.abs(difference) / Math.max(receivingValue, givingValue, 1)) * 100;

    const counter: CounterOffer = {
      original_value: receivingValue,
      counter_value: givingValue,
      difference,
      fairness,
      suggestions: []
    };

    setCounterOffer(counter);
  };

  const receivingTotal = receivingPlayers.reduce((sum, p) => sum + p.value, 0);
  const givingTotal = givingPlayers.reduce((sum, p) => sum + p.value, 0);
  const balance = receivingTotal - givingTotal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <RefreshCw className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Counter-Offer Generator</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Players to Trade</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Player ID"
              value={newPlayer.id}
              onChange={(e) => setNewPlayer({ ...newPlayer, id: e.target.value })}
              className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Player Name"
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <select
              value={newPlayer.list}
              onChange={(e) => setNewPlayer({ ...newPlayer, list: e.target.value as 'receiving' | 'giving' })}
              className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="receiving">Receiving</option>
              <option value="giving">Giving</option>
            </select>
            <button
              onClick={addPlayer}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>You Receive</span>
              <span className="text-green-400">{receivingTotal.toLocaleString()}</span>
            </h3>
            {receivingPlayers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No players added yet</p>
            ) : (
              <div className="space-y-2">
                {receivingPlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-gray-400">Value: {player.value.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id, 'receiving')}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>You Give</span>
              <span className="text-red-400">{givingTotal.toLocaleString()}</span>
            </h3>
            {givingPlayers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No players added yet</p>
            ) : (
              <div className="space-y-2">
                {givingPlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                    <div>
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-gray-400">Value: {player.value.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id, 'giving')}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-3 gap-6 mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Net Value</p>
              <p className={`text-2xl font-bold ${balance > 0 ? 'text-green-400' : balance < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {balance > 0 ? '+' : ''}{balance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Trade Balance</p>
              <p className="text-2xl font-bold">
                {balance === 0 ? 'Even' : balance > 0 ? 'You Win' : 'You Lose'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Fairness</p>
              <p className="text-2xl font-bold text-blue-400">
                {receivingTotal && givingTotal ? (
                  (100 - (Math.abs(balance) / Math.max(receivingTotal, givingTotal)) * 100).toFixed(0)
                ) : 0}%
              </p>
            </div>
          </div>

          <button
            onClick={generateCounterOffer}
            disabled={receivingPlayers.length === 0 || givingPlayers.length === 0}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
          >
            Generate Counter-Offer
          </button>
        </div>

        {counterOffer && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
            <h3 className="text-xl font-bold mb-4">Counter-Offer Analysis</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/30 rounded-lg">
                <p className="text-gray-300">
                  {counterOffer.difference > 0 ? (
                    <>This trade favors you by <span className="text-green-400 font-bold">{counterOffer.difference.toLocaleString()}</span> points.</>
                  ) : counterOffer.difference < 0 ? (
                    <>This trade favors them by <span className="text-red-400 font-bold">{Math.abs(counterOffer.difference).toLocaleString()}</span> points.</>
                  ) : (
                    <>This is a perfectly balanced trade.</>
                  )}
                </p>
                <p className="text-gray-300 mt-2">
                  Trade fairness score: <span className="text-blue-400 font-bold">{counterOffer.fairness.toFixed(1)}%</span>
                </p>
              </div>

              {Math.abs(counterOffer.difference) > 500 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 font-semibold">Suggestion:</p>
                  <p className="text-gray-300 mt-2">
                    {counterOffer.difference > 0 ? (
                      <>Consider removing a player worth approximately {counterOffer.difference.toLocaleString()} or asking for an additional piece to balance the trade.</>
                    ) : (
                      <>Consider adding a player worth approximately {Math.abs(counterOffer.difference).toLocaleString()} to make the offer more appealing.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
