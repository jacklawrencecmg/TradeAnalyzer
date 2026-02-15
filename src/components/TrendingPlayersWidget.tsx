/**
 * Trending Players Widget
 *
 * Homepage widget showing today's biggest value movers.
 * Displays explanations for why players are trending.
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface TrendingPlayer {
  playerId: string;
  playerName: string;
  position: string;
  delta: number;
  percentChange: number;
  rankChange: number;
  explanationText: string;
  primaryReason: string;
}

interface TrendingPlayersWidgetProps {
  format?: 'dynasty' | 'redraft';
  limit?: number;
}

export function TrendingPlayersWidget({
  format = 'dynasty',
  limit = 10,
}: TrendingPlayersWidgetProps) {
  const [risers, setRisers] = useState<TrendingPlayer[]>([]);
  const [fallers, setFallers] = useState<TrendingPlayer[]>([]);
  const [activeTab, setActiveTab] = useState<'risers' | 'fallers'>('risers');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendingPlayers();
  }, [format]);

  async function loadTrendingPlayers() {
    setLoading(true);

    try {
      // TODO: Implement API calls
      // const risersData = await fetch(`/api/changes/today?format=${format}&type=riser&limit=${limit}`).then(r => r.json());
      // const fallersData = await fetch(`/api/changes/today?format=${format}&type=faller&limit=${limit}`).then(r => r.json());

      // setRisers(risersData);
      // setFallers(fallersData);
    } catch (error) {
      console.error('Error loading trending players:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-600 animate-spin" />
          <h2 className="text-xl font-bold text-gray-900">Loading Trending Players...</h2>
        </div>
      </div>
    );
  }

  const displayPlayers = activeTab === 'risers' ? risers : fallers;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Trending Players Today</h2>
        <p className="text-sm text-gray-600">Biggest value movers with explanations</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('risers')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'risers'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Risers ({risers.length})</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('fallers')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'fallers'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingDown className="w-4 h-4" />
            <span>Fallers ({fallers.length})</span>
          </div>
        </button>
      </div>

      {/* Player List */}
      <div className="divide-y divide-gray-200">
        {displayPlayers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No trending players today</p>
            <p className="text-xs mt-1">Check back after the nightly update</p>
          </div>
        ) : (
          displayPlayers.map((player) => (
            <PlayerCard key={player.playerId} player={player} type={activeTab} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Individual player card
 */
function PlayerCard({
  player,
  type,
}: {
  player: TrendingPlayer;
  type: 'risers' | 'fallers';
}) {
  const isPositive = type === 'risers';
  const arrowColor = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';
  const Arrow = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${bgColor} p-2 rounded-lg flex-shrink-0`}>
          <Arrow className={`w-5 h-5 ${arrowColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-semibold text-gray-900">{player.playerName}</h3>
              <p className="text-sm text-gray-600">{player.position}</p>
            </div>

            <div className="text-right flex-shrink-0">
              <div className={`text-lg font-bold ${arrowColor}`}>
                {isPositive ? '+' : ''}
                {player.delta}
              </div>
              <div className="text-xs text-gray-600">
                {isPositive ? '+' : ''}
                {player.percentChange.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-sm text-gray-700 leading-relaxed">{player.explanationText}</p>

          {/* Rank Change */}
          {player.rankChange !== 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Rank movement: {player.rankChange > 0 ? '↓' : '↑'}{' '}
              {Math.abs(player.rankChange)} spots
            </div>
          )}

          {/* Reason Badge */}
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
              {player.primaryReason}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrendingPlayersWidget;
