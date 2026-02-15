import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { getTrendingPlayers } from '../lib/adjustments/getEffectiveValue';
import ValueAdjustmentBadge from './ValueAdjustmentBadge';

export default function TrendingPlayersPanel() {
  const [trendingPlayers, setTrendingPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadTrendingPlayers();
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadTrendingPlayers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadTrendingPlayers() {
    setLoading(true);
    try {
      const players = await getTrendingPlayers(100);
      setTrendingPlayers(players);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading trending players:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = trendingPlayers.filter(p => {
    if (filter === 'up') return p.total_delta > 0;
    if (filter === 'down') return p.total_delta < 0;
    return true;
  });

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-[#00d4ff]" />
            <div>
              <h2 className="text-xl font-bold text-white">Trending Players</h2>
              <p className="text-sm text-gray-400">Real-time value adjustments</p>
            </div>
          </div>
          <button
            onClick={loadTrendingPlayers}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-[#00d4ff] text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All ({trendingPlayers.length})
          </button>
          <button
            onClick={() => setFilter('up')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === 'up'
                ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Rising ({trendingPlayers.filter(p => p.total_delta > 0).length})
          </button>
          <button
            onClick={() => setFilter('down')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === 'down'
                ? 'bg-red-900/30 text-red-400 border border-red-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <TrendingDown className="w-4 h-4 inline mr-1" />
            Falling ({trendingPlayers.filter(p => p.total_delta < 0).length})
          </button>
        </div>

        {/* Last Update */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border-b border-blue-500/30 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            Adjustments are temporary overlays on base values. They react to injuries, role changes, and transactions,
            and reset during nightly rebuilds. Base rankings remain stable.
          </p>
        </div>
      </div>

      {/* Player List */}
      <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading trending players...</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No trending players at the moment</p>
            <p className="text-sm mt-1">Check back after injuries or transactions</p>
          </div>
        ) : (
          filteredPlayers.map((player) => (
            <div key={player.id} className="p-4 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium truncate">{player.full_name}</h3>
                    <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                      {player.player_position}
                    </span>
                    {player.team && (
                      <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                        {player.team}
                      </span>
                    )}
                  </div>

                  {/* Sources */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {player.sources && player.sources.map((source: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 capitalize"
                      >
                        {source.replace('_', ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Expiry */}
                  {player.latest_expiry && (
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        Expires: {new Date(player.latest_expiry).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Adjustment Badge */}
                <div className="flex flex-col items-end gap-2">
                  <ValueAdjustmentBadge
                    adjustment={player.total_delta}
                    adjustments={[]}
                    size="lg"
                    showTooltip={false}
                  />
                  <div className="text-xs text-gray-500">
                    {player.adjustment_count} adjustment{player.adjustment_count !== 1 ? 's' : ''}
                  </div>
                  {player.max_confidence && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-1.5 h-1.5 rounded-full ${
                            level <= player.max_confidence ? 'bg-blue-400' : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredPlayers.length > 0 && (
        <div className="border-t border-gray-700 p-3 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            Showing {filteredPlayers.length} of {trendingPlayers.length} trending players
            • Max adjustment: ±1500 per player
          </p>
        </div>
      )}
    </div>
  );
}
