import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { getSessionId } from '../lib/session/getSessionId';

interface WatchlistButtonProps {
  playerId: string;
  playerName?: string;
  variant?: 'default' | 'small' | 'icon';
  onToggle?: (isWatching: boolean) => void;
}

export default function WatchlistButton({
  playerId,
  playerName,
  variant = 'default',
  onToggle,
}: WatchlistButtonProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkWatchlistStatus();
  }, [playerId]);

  const checkWatchlistStatus = async () => {
    try {
      setChecking(true);
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

      if (response.ok && data.players) {
        const isInWatchlist = data.players.some((p: any) => p.player_id === playerId);
        setIsWatching(isInWatchlist);
      }
    } catch (err) {
      console.error('Error checking watchlist status:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = async () => {
    try {
      setLoading(true);
      const sessionId = getSessionId();

      const endpoint = isWatching ? 'watchlist-remove' : 'watchlist-add';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
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
        throw new Error(data.error || 'Failed to update watchlist');
      }

      const newStatus = !isWatching;
      setIsWatching(newStatus);
      onToggle?.(newStatus);
    } catch (err) {
      console.error('Error toggling watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`p-2 rounded-lg transition-all ${
          isWatching
            ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
            : 'text-gray-400 hover:text-yellow-500 bg-gray-50 hover:bg-yellow-50'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
        ) : (
          <Star className={`w-5 h-5 ${isWatching ? 'fill-current' : ''}`} />
        )}
      </button>
    );
  }

  if (variant === 'small') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          isWatching
            ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'
            : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        ) : (
          <Star className={`w-4 h-4 ${isWatching ? 'fill-current' : ''}`} />
        )}
        {isWatching ? 'Watching' : 'Watch'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
        isWatching
          ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-300'
          : 'text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-300 hover:border-yellow-300'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
          <span>Processing...</span>
        </>
      ) : (
        <>
          <Star className={`w-5 h-5 ${isWatching ? 'fill-current' : ''}`} />
          <span>{isWatching ? 'Remove from Watchlist' : 'Add to Watchlist'}</span>
        </>
      )}
    </button>
  );
}
