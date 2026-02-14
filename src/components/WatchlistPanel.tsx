import { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, X, ExternalLink } from 'lucide-react';
import { getSessionId } from '../lib/session/getSessionId';

interface WatchlistPlayer {
  player_id: string;
  added_at: string;
  notes: string | null;
  player_name: string;
  player_position: string;
  team: string | null;
  value_now: number;
  change_7d: number;
  change_30d: number;
  trend_tag: string;
}

interface WatchlistPanelProps {
  onSelectPlayer?: (playerId: string) => void;
}

export default function WatchlistPanel({ onSelectPlayer }: WatchlistPanelProps) {
  const [players, setPlayers] = useState<WatchlistPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const sessionId = getSessionId();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/watchlist-get`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Session-Id': sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch watchlist');
      }

      setPlayers(data.players || []);
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (playerId: string) => {
    try {
      setRemoving(playerId);
      const sessionId = getSessionId();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/watchlist-remove`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Session-Id': sessionId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ player_id: playerId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove player');
      }

      setPlayers(players.filter(p => p.player_id !== playerId));
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    } finally {
      setRemoving(null);
    }
  };

  const getTrendColor = (tag: string) => {
    switch (tag) {
      case 'buy_low': return 'text-green-600 bg-green-50';
      case 'sell_high': return 'text-red-600 bg-red-50';
      case 'rising': return 'text-blue-600 bg-blue-50';
      case 'falling': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrendLabel = (tag: string) => {
    switch (tag) {
      case 'buy_low': return 'Buy Low';
      case 'sell_high': return 'Sell High';
      case 'rising': return 'Rising';
      case 'falling': return 'Falling';
      default: return 'Stable';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-600 text-sm">Loading watchlist...</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-700 mb-2">Your Watchlist is Empty</h3>
        <p className="text-gray-500 mb-6">
          Follow players to receive alerts when their values change significantly
        </p>
        <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-gray-700">
            Click the star icon on any player card to add them to your watchlist
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Watchlist</h2>
            <p className="text-gray-600 mt-1">
              Following {players.length} {players.length === 1 ? 'player' : 'players'}
            </p>
          </div>
          <button
            onClick={fetchWatchlist}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Player Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player) => (
          <div
            key={player.player_id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => onSelectPlayer?.(player.player_id)}
              >
                <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600">
                  {player.player_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-gray-600">
                    {player.player_position}
                  </span>
                  {player.team && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">{player.team}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(player.player_id)}
                disabled={removing === player.player_id}
                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                title="Remove from watchlist"
              >
                {removing === player.player_id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Value */}
            <div className="mb-3">
              <div className="text-sm text-gray-500">Current Value</div>
              <div className="text-2xl font-bold text-gray-900">
                {player.value_now.toLocaleString()}
              </div>
            </div>

            {/* Changes */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-600 mb-1">7-Day</div>
                <div className={`text-sm font-bold flex items-center gap-1 ${
                  player.change_7d > 0 ? 'text-green-600' : player.change_7d < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {player.change_7d > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : player.change_7d < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : null}
                  {player.change_7d > 0 ? '+' : ''}{player.change_7d.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-xs text-gray-600 mb-1">30-Day</div>
                <div className={`text-sm font-bold flex items-center gap-1 ${
                  player.change_30d > 0 ? 'text-green-600' : player.change_30d < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {player.change_30d > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : player.change_30d < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : null}
                  {player.change_30d > 0 ? '+' : ''}{player.change_30d.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Trend Tag */}
            {player.trend_tag && player.trend_tag !== 'stable' && (
              <div className={`px-2 py-1 rounded text-xs font-bold ${getTrendColor(player.trend_tag)}`}>
                {getTrendLabel(player.trend_tag)}
              </div>
            )}

            {/* Added Date */}
            <div className="text-xs text-gray-400 mt-3">
              Added {new Date(player.added_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
