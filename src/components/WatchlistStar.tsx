/**
 * Watchlist Star Component
 *
 * Toggle button for adding/removing players from watchlist.
 * Shows filled star if player is watched, outline if not.
 * Appears on player cards, player details, etc.
 */

import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../lib/notifications/notificationsApi';
import { useAuth } from '../hooks/useAuth';

interface WatchlistStarProps {
  playerId: string;
  playerName: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function WatchlistStar({
  playerId,
  playerName,
  size = 'md',
  showLabel = false,
}: WatchlistStarProps) {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if player is in watchlist
  useEffect(() => {
    if (!user) {
      setIsWatched(false);
      return;
    }

    checkWatchlist();
  }, [user, playerId]);

  async function checkWatchlist() {
    if (!user) return;

    const watched = await isInWatchlist(user.id, playerId);
    setIsWatched(watched);
  }

  async function handleToggle() {
    if (!user) {
      // TODO: Show login prompt
      alert('Please log in to use watchlists');
      return;
    }

    setLoading(true);

    try {
      if (isWatched) {
        const success = await removeFromWatchlist(user.id, playerId);
        if (success) {
          setIsWatched(false);
          showToast(`Removed ${playerName} from watchlist`);
        }
      } else {
        const success = await addToWatchlist(user.id, playerId);
        if (success) {
          setIsWatched(true);
          showToast(`Added ${playerName} to watchlist`);
        }
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = sizeClasses[size];

  if (!user) {
    return null; // Hide for non-authenticated users
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 p-1.5 rounded transition-colors ${
        isWatched
          ? 'text-yellow-500 hover:text-yellow-600'
          : 'text-gray-400 hover:text-gray-600'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <Star
        className={iconSize}
        fill={isWatched ? 'currentColor' : 'none'}
      />
      {showLabel && (
        <span className="text-sm font-medium">
          {isWatched ? 'Watching' : 'Watch'}
        </span>
      )}
    </button>
  );
}

/**
 * Show toast notification (placeholder)
 */
function showToast(message: string) {
  // TODO: Implement proper toast notification system
  console.log('Toast:', message);
}

export default WatchlistStar;
